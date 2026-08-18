import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { generateCourseCharge } from "@/lib/server/billing-generation";
import {
  computeTransferConversion,
  getEnrollmentLearningSnapshot,
  resolveEnrollmentUnitPrice,
} from "@/lib/server/enrollment-learning";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền kết thúc lớp" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetClassId = String(body.targetClassId ?? "").trim();
  const reason = String(body.reason ?? "").trim() || "CSO chốt kết thúc lớp";

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      nextClass: { include: { course: true } },
      enrollments: {
        where: { status: "ACTIVE" },
        include: { class: { include: { course: true, nextClass: { include: { course: true } } } } },
      },
    },
  });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if (cls.status === "COMPLETED") {
    return NextResponse.json({ error: "Lớp này đã được kết thúc trước đó." }, { status: 409 });
  }

  const finalTargetClassId = targetClassId || cls.nextClassId || "";
  const snapshots = await Promise.all(
    cls.enrollments.map(async (enrollment) => ({
      enrollment,
      snapshot: await getEnrollmentLearningSnapshot(prisma, enrollment),
    })),
  );
  const needTransfer = snapshots.filter((item) => item.snapshot.remainingMainSessions > 0);

  let targetClass: {
    id: string;
    branchId: string;
    className: string;
    tuitionPerSession: number | null;
    isRemedial: boolean;
    status: string;
    course: { tuitionPerSession: number } | null;
  } | null = null;
  if (needTransfer.length > 0) {
    if (!finalTargetClassId) {
      return NextResponse.json({ error: "Lớp còn học viên chưa học đủ nhưng chưa cấu hình lớp tiếp theo." }, { status: 400 });
    }
    if (finalTargetClassId === cls.id) {
      return NextResponse.json({ error: "Lớp tiếp theo không được là chính lớp hiện tại." }, { status: 400 });
    }
    targetClass = await prisma.class.findUnique({ where: { id: finalTargetClassId }, include: { course: true } });
    if (!targetClass || targetClass.branchId !== cls.branchId || targetClass.isRemedial || targetClass.status !== "ACTIVE") {
      return NextResponse.json({ error: "Lớp tiếp theo không hợp lệ, không cùng cơ sở hoặc không còn ACTIVE." }, { status: 400 });
    }

    const conflicts = await prisma.enrollment.findMany({
      where: {
        classId: targetClass.id,
        status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
        studentId: { in: needTransfer.map((item) => item.enrollment.studentId) },
      },
      select: { studentId: true },
    });
    if (conflicts.length > 0) {
      return NextResponse.json({ error: `${conflicts.length} học viên đã có ghi danh mở ở lớp tiếp theo, cần xử lý thủ công trước.` }, { status: 409 });
    }
  }

  const now = new Date();
  const createdEnrollmentIds: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    let completed = 0;
    let transferred = 0;
    let freeExtraCarried = 0;
    let transferValueAmount = 0;

    for (const { enrollment, snapshot } of snapshots) {
      if (snapshot.remainingMainSessions <= 0) {
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { status: "COMPLETED", endDate: now, continuationStatus: "COMPLETED" },
        });
        await tx.enrollmentStatusHistory.create({
          data: {
            studentId: enrollment.studentId,
            enrollmentId: enrollment.id,
            fromStatus: enrollment.status,
            toStatus: "COMPLETED",
            reason,
            changedById: user.id,
          },
        });
        completed += 1;
        continue;
      }

      if (!targetClass) throw new Error("Thiếu lớp tiếp theo.");
      const oldUnitPrice = resolveEnrollmentUnitPrice(enrollment);
      const newUnitPrice = targetClass.tuitionPerSession ?? targetClass.course?.tuitionPerSession ?? 0;
      if (!Number.isInteger(newUnitPrice) || newUnitPrice <= 0) {
        throw new Error(`Lớp tiếp theo "${targetClass.className}" chưa có đơn giá/buổi hợp lệ.`);
      }

      const conversion = computeTransferConversion(snapshot.paidRemainingSessions, oldUnitPrice, newUnitPrice);
      if (conversion.convertedSessionCount <= 0 && snapshot.manualExtraRemainingSessions <= 0) {
        throw new Error(`Học viên ${enrollment.studentId} không còn đủ tiền hoặc buổi cộng thêm để chuyển lớp.`);
      }

      const note = [
        `Kết thúc lớp ${cls.className}, chuyển sang ${targetClass.className}`,
        `Còn tiền: ${snapshot.paidRemainingSessions} buổi x ${oldUnitPrice.toLocaleString("vi-VN")}đ = ${conversion.remainingValue.toLocaleString("vi-VN")}đ`,
        conversion.convertedSessionCount > 0 ? `Quy đổi ${conversion.convertedSessionCount} buổi ở lớp mới` : null,
        snapshot.manualExtraRemainingSessions > 0 ? `Mang theo ${snapshot.manualExtraRemainingSessions} buổi cộng linh động` : null,
        conversion.remainingCashAmount > 0 ? `Dư ${conversion.remainingCashAmount.toLocaleString("vi-VN")}đ` : null,
        `Lý do: ${reason}`,
      ].filter(Boolean).join(" · ");

      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "TRANSFERRED",
          endDate: now,
          continuationStatus: "TRANSFERRED",
          notes: [enrollment.notes, note].filter(Boolean).join("\n"),
        },
      });
      await tx.enrollmentStatusHistory.create({
        data: {
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          fromStatus: enrollment.status,
          toStatus: "TRANSFERRED",
          reason: note,
          changedById: user.id,
        },
      });

      const nextEnrollment = await tx.enrollment.create({
        data: {
          studentId: enrollment.studentId,
          classId: targetClass.id,
          status: "ACTIVE",
          billingModel: enrollment.billingModel,
          enrollDate: now,
          learningStartDate: now,
          purchasedMainSessionCount: conversion.convertedSessionCount,
          manualExtraSessionCount: snapshot.manualExtraRemainingSessions,
          tuitionUnitPriceSnapshot: newUnitPrice,
          paidCatchupSessionCount: 0,
          paidCatchupUnitPrice: newUnitPrice,
          pricingBasis: "CONTINUATION_TRANSFER",
          transferredFromEnrollmentId: enrollment.id,
          transferredValueAmount: conversion.remainingValue,
          transferredConvertedSessionCount: conversion.convertedSessionCount,
          transferredRemainingCashAmount: conversion.remainingCashAmount,
          notes: note,
        },
      });
      createdEnrollmentIds.push(nextEnrollment.id);

      if (conversion.remainingCashAmount > 0) {
        await tx.creditBalance.create({
          data: {
            studentId: enrollment.studentId,
            amount: conversion.remainingCashAmount,
            reason: `Tiền lẻ sau khi kết thúc lớp ${cls.className} và chuyển sang ${targetClass.className}`,
          },
        });
      }

      await syncStudentDerivedFields(enrollment.studentId, tx);
      transferred += 1;
      freeExtraCarried += snapshot.manualExtraRemainingSessions;
      transferValueAmount += conversion.remainingValue;
    }

    await tx.class.update({ where: { id: cls.id }, data: { status: "COMPLETED" } });
    return { completed, transferred, freeExtraCarried, transferValueAmount };
  });

  const billingWarnings: string[] = [];
  for (const enrollmentId of createdEnrollmentIds) {
    const chargeResult = await generateCourseCharge(enrollmentId);
    if (chargeResult && "error" in chargeResult && chargeResult.error) billingWarnings.push(chargeResult.error);
  }
  await Promise.all(snapshots.map(({ enrollment }) => syncStudentDerivedFields(enrollment.studentId)));

  return NextResponse.json({
    ok: true,
    ...result,
    targetClassId: targetClass?.id ?? null,
    targetClassName: targetClass?.className ?? null,
    billingWarnings,
  });
}
