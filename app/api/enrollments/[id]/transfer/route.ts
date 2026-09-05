import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { generateCourseCharge } from "@/lib/server/billing-generation";
import { computeTransferConversion, getEnrollmentLearningSnapshot } from "@/lib/server/enrollment-learning";
import { computeEffectiveUnitPrice } from "@/lib/server/tuition-rules";

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
  if (!existing.class) return NextResponse.json({ error: "Gói học chưa được gán vào lớp cụ thể để thực hiện chuyển lớp." }, { status: 400 });

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

  // snapshot.unitPrice đã trừ học bổng/điều chỉnh đang hiệu lực (xem
  // getEnrollmentLearningSnapshot) — dùng đúng số này để quy đổi, không tự lấy lại
  // giá gốc, nếu không số xem trước và số thực tế chuyển lớp sẽ lệch nhau.
  const oldUnitPrice = snapshot.unitPrice;

  // Học bổng gắn theo TỪNG enrollment (không tự động theo học viên) — admin phải
  // CHỦ ĐỘNG chọn % mang sang cho enrollment MỚI (0..% hiện tại), không tự động giữ
  // 100% và cũng không tự động bỏ 100% — vì chuyển sang lớp nâng cao có thể cần GIẢM
  // % chứ không phải giữ nguyên hay mất trắng. Không cho vượt quá % hiện tại qua
  // thao tác chuyển lớp này (cấp thêm ưu đãi mới là việc của ScholarshipAdjustmentForm).
  const rawScholarshipPct = Number(body.scholarshipPct ?? 0);
  if (!Number.isFinite(rawScholarshipPct) || rawScholarshipPct < 0 || rawScholarshipPct > snapshot.scholarshipPct) {
    return NextResponse.json({ error: "Phan tram hoc bong khong hop le." }, { status: 400 });
  }
  const chosenScholarshipPct = rawScholarshipPct;
  const rawNewUnitPrice = Number(body.newUnitPrice ?? targetClass.tuitionPerSession ?? targetClass.course?.tuitionPerSession ?? 0);
  if (!Number.isInteger(rawNewUnitPrice) || rawNewUnitPrice <= 0) {
    return NextResponse.json({ error: "Lop moi chua co don gia/buoi hop le." }, { status: 400 });
  }

  // Gia dung de quy doi (va gia snapshot cho enrollment moi) phai la gia DA AP DUNG %
  // admin vua chon, khong phai gia goc — neu khong, tien vao bao nhieu se khong con
  // quy dung ra tung do buoi o lop moi (2 lop cung "ngan xep" thuong gia bang nhau,
  // nen khi giu dung % thi so buoi quy doi phai ~ bang so buoi con lai, khong bi lech
  // do vo tinh dung gia goc lam mau so). Dung dung adjustmentPct that cua snapshot,
  // khong hardcode 0.
  const newUnitPrice = chosenScholarshipPct > 0
    ? computeEffectiveUnitPrice(rawNewUnitPrice, chosenScholarshipPct, snapshot.adjustmentPct)
    : rawNewUnitPrice;

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
    snapshot.scholarshipPct > 0
      ? chosenScholarshipPct > 0
        ? `Mang hoc bong ${Math.round(chosenScholarshipPct * 100)}% sang lop moi (truoc do ${Math.round(snapshot.scholarshipPct * 100)}%)`
        : `Khong mang hoc bong ${Math.round(snapshot.scholarshipPct * 100)}% sang lop moi`
      : null,
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

    if (chosenScholarshipPct > 0) {
      await tx.scholarship.create({
        data: {
          studentId: existing.studentId,
          enrollmentId: nextEnrollment.id,
          percentage: chosenScholarshipPct,
          reason: `Admin chon giu ${Math.round(chosenScholarshipPct * 100)}% tu enrollment cu khi chuyen lop: ${existing.class?.className ?? "Gói cũ"} -> ${targetClass.className}`,
          effectiveFrom: now,
          effectiveTo: null,
        },
      });
    }

    if (conversion.remainingCashAmount > 0) {
      await tx.creditBalance.create({
        data: {
          studentId: existing.studentId,
          amount: conversion.remainingCashAmount,
          reason: `Tien le sau quy doi chuyen lop: ${existing.class?.className ?? "Gói cũ"} -> ${targetClass.className}`,
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
