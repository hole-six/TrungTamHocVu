import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { generateCourseCharge } from "@/lib/server/billing-generation";
import { computeTransferConversion, getEnrollmentLearningSnapshot, resolveEnrollmentUnitPrice } from "@/lib/server/enrollment-learning";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chua dang nhap" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Ban khong co quyen chuyen lop hoc vien" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const existing = await prisma.enrollment.findUnique({
    where: { id: params.id },
    include: { class: { include: { course: true, nextClass: { include: { course: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Khong tim thay ghi danh" }, { status: 404 });
  if (existing.status !== "ACTIVE") return NextResponse.json({ error: "Chi chuyen lop cho enrollment dang ACTIVE." }, { status: 409 });

  const targetClassId = String(body.targetClassId ?? existing.class.nextClassId ?? "").trim();
  if (!targetClassId) return NextResponse.json({ error: "Lop hien tai chua cau hinh lop tiep theo." }, { status: 400 });
  if (targetClassId === existing.classId) return NextResponse.json({ error: "Lop moi phai khac lop hien tai." }, { status: 400 });

  const targetClass = await prisma.class.findUnique({ where: { id: targetClassId }, include: { course: true } });
  if (!targetClass) return NextResponse.json({ error: "Khong tim thay lop moi" }, { status: 404 });
  if (targetClass.branchId !== existing.class.branchId) {
    return NextResponse.json({ error: "Lop moi phai cung co so voi lop hien tai." }, { status: 400 });
  }

  const existingActive = await prisma.enrollment.findFirst({
    where: { studentId: existing.studentId, classId: targetClass.id, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
  });
  if (existingActive) return NextResponse.json({ error: "Hoc vien da co enrollment dang mo o lop moi." }, { status: 409 });

  const snapshot = await getEnrollmentLearningSnapshot(prisma, existing);
  if (snapshot.remainingMainSessions <= 0) {
    return NextResponse.json({ error: "Hoc vien da hoc du so buoi chinh, khong con gia tri de chuyen lop." }, { status: 409 });
  }

  const oldUnitPrice = resolveEnrollmentUnitPrice(existing);
  const newUnitPrice = Number(body.newUnitPrice ?? targetClass.tuitionPerSession ?? targetClass.course?.tuitionPerSession ?? 0);
  if (!Number.isInteger(newUnitPrice) || newUnitPrice <= 0) {
    return NextResponse.json({ error: "Lop moi chua co don gia/buoi hop le." }, { status: 400 });
  }

  const conversion = computeTransferConversion(snapshot.paidRemainingSessions, oldUnitPrice, newUnitPrice);
  if (conversion.convertedSessionCount <= 0 && snapshot.manualExtraRemainingSessions <= 0) {
    return NextResponse.json({ error: "Tien con lai khong du quy doi thanh 1 buoi o lop moi." }, { status: 409 });
  }

  const now = new Date();
  const note = [
    `Chuyen tu ${existing.class.className} sang ${targetClass.className}`,
    `Con ${snapshot.paidRemainingSessions} buoi co phi x ${oldUnitPrice.toLocaleString("vi-VN")}d = ${conversion.remainingValue.toLocaleString("vi-VN")}d`,
    conversion.convertedSessionCount > 0 ? `Quy sang ${conversion.convertedSessionCount} buoi x ${newUnitPrice.toLocaleString("vi-VN")}d` : null,
    snapshot.manualExtraRemainingSessions > 0 ? `Mang theo ${snapshot.manualExtraRemainingSessions} buoi cong linh dong` : null,
    conversion.remainingCashAmount > 0 ? `Du ${conversion.remainingCashAmount.toLocaleString("vi-VN")}d` : null,
    body.reason ? `Ly do: ${String(body.reason).trim()}` : null,
  ].filter(Boolean).join(" · ");

  const created = await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: existing.id },
      data: { status: "TRANSFERRED", endDate: now, continuationStatus: "TRANSFERRED", notes: [existing.notes, note].filter(Boolean).join("\n") },
    });
    await tx.enrollmentStatusHistory.create({
      data: {
        studentId: existing.studentId,
        enrollmentId: existing.id,
        fromStatus: existing.status,
        toStatus: "TRANSFERRED",
        reason: note,
        changedById: user.id,
      },
    });

    const nextEnrollment = await tx.enrollment.create({
      data: {
        studentId: existing.studentId,
        classId: targetClass.id,
        status: "ACTIVE",
        billingModel: existing.billingModel,
        enrollDate: now,
        learningStartDate: now,
        purchasedMainSessionCount: conversion.convertedSessionCount,
        manualExtraSessionCount: snapshot.manualExtraRemainingSessions,
        tuitionUnitPriceSnapshot: newUnitPrice,
        paidCatchupSessionCount: 0,
        paidCatchupUnitPrice: newUnitPrice,
        pricingBasis: "CONTINUATION_TRANSFER",
        transferredFromEnrollmentId: existing.id,
        transferredValueAmount: conversion.remainingValue,
        transferredConvertedSessionCount: conversion.convertedSessionCount,
        transferredRemainingCashAmount: conversion.remainingCashAmount,
        notes: note,
      },
    });

    if (conversion.remainingCashAmount > 0) {
      await tx.creditBalance.create({
        data: {
          studentId: existing.studentId,
          amount: conversion.remainingCashAmount,
          reason: `Tien le sau quy doi chuyen lop: ${existing.class.className} -> ${targetClass.className}`,
        },
      });
    }

    await syncStudentDerivedFields(existing.studentId, tx);
    return nextEnrollment;
  });

  const chargeResult = created.billingModel === "COURSE" && !targetClass.isRemedial ? await generateCourseCharge(created.id) : null;
  const syncedStudent = await syncStudentDerivedFields(existing.studentId);

  return NextResponse.json({
    item: created,
    student: syncedStudent,
    conversion,
    billingWarning: chargeResult && "error" in chargeResult ? chargeResult.error : undefined,
  });
}
