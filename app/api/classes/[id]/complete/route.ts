import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { generateCourseCharge, getPeriodCourseRemaining } from "@/lib/server/billing-generation";
import {
  computeTransferConversionFromValue,
  getEnrollmentLearningSnapshot,
} from "@/lib/server/enrollment-learning";
import { computeEffectiveUnitPrice } from "@/lib/server/tuition-rules";
import { getWalletBalance, transferWalletToNewEnrollment } from "@/lib/server/enrollment-wallet";
import { attachCourseBookRequirements } from "@/lib/server/enrollment-materials";

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

  // COURSE/INSTALLMENT: "hết buổi thật sự" (remainingMainSessions<=0) thì tất toán
  // luôn, không cần lớp tiếp theo — giữ nguyên hành vi cũ.
  // PERIOD: không có khái niệm "hết buổi" (quyền học nằm trong Ví, không phải
  // purchasedMainSessionCount) — nếu CÓ lớp tiếp theo thì LUÔN chuyển tiếp bất kể ví
  // còn bao nhiêu (chốt nghiệp vụ); nếu KHÔNG có lớp tiếp theo thì kết thúc luôn, ví
  // còn dư giữ nguyên trên enrollment đã đóng để xử lý hoàn/giữ thủ công sau (mục 3.10).
  const isPeriod = (billingModel: string) => billingModel === "PERIOD";
  const courseNeedTransfer = snapshots.filter(
    (item) => !isPeriod(item.enrollment.billingModel) && item.snapshot.remainingMainSessions > 0,
  );
  // Đóng theo tháng có số buổi khóa mà đã lập phiếu đủ khóa và ví hết buổi = ĐÃ HỌC XONG
  // KHÓA: kết thúc luôn, không chuyển sang lớp tiếp theo (chuyển là thu thêm khóa mới
  // mà phụ huynh chưa đăng ký). Phần khóa còn lại của người được chuyển đi theo sang lớp mới.
  const periodCourseRemainingById = new Map<string, number | null>();
  const periodFinishedIds = new Set<string>();
  for (const { enrollment } of snapshots) {
    if (!isPeriod(enrollment.billingModel)) continue;
    const remaining = await getPeriodCourseRemaining(enrollment);
    periodCourseRemainingById.set(enrollment.id, remaining);
    if (remaining === 0 && (await getWalletBalance(prisma, enrollment.id)) <= 0) periodFinishedIds.add(enrollment.id);
  }
  const periodAll = snapshots.filter((item) => isPeriod(item.enrollment.billingModel) && !periodFinishedIds.has(item.enrollment.id));
  const willTransferPeriod = Boolean(finalTargetClassId);
  const transferGroup = willTransferPeriod ? [...courseNeedTransfer, ...periodAll] : courseNeedTransfer;
  const completeOutrightGroup = snapshots.filter((item) => !transferGroup.includes(item));

  let targetClass: {
    id: string;
    branchId: string;
    className: string;
    courseId: string | null;
    tuitionPerSession: number | null;
    isRemedial: boolean;
    status: string;
    course: { tuitionPerSession: number } | null;
  } | null = null;
  if (courseNeedTransfer.length > 0 && !finalTargetClassId) {
    return NextResponse.json({ error: "Lớp còn học viên chưa học đủ nhưng chưa cấu hình lớp tiếp theo." }, { status: 400 });
  }
  if (transferGroup.length > 0) {
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
        studentId: { in: transferGroup.map((item) => item.enrollment.studentId) },
      },
      select: { studentId: true },
    });
    if (conflicts.length > 0) {
      return NextResponse.json({ error: `${conflicts.length} học viên đã có ghi danh mở ở lớp tiếp theo, cần xử lý thủ công trước.` }, { status: 409 });
    }
  }

  // Học bổng gắn theo TỪNG enrollment — không tự động giữ hay bỏ khi chuyển hàng loạt.
  // Admin phải chọn rõ % cho MỖI học viên đang có học bổng (giữ nguyên/giảm/bỏ), 400
  // nếu thiếu quyết định cho ai đó, để không lỡ tay tính sai giá cho ai. Áp dụng cho
  // cả PERIOD lẫn COURSE trong transferGroup — học bổng không phụ thuộc billingModel.
  const decisionsRaw: unknown[] = Array.isArray(body.decisions) ? body.decisions : [];
  const decisionByEnrollmentId = new Map<string, number>(
    decisionsRaw
      .filter((item): item is { enrollmentId: string; scholarshipPct: unknown } =>
        Boolean(item) && typeof (item as { enrollmentId?: unknown }).enrollmentId === "string")
      .map((item) => [item.enrollmentId, Number(item.scholarshipPct)]),
  );
  const scholarshipPctByEnrollmentId = new Map<string, number>();
  for (const { enrollment, snapshot } of transferGroup) {
    if (snapshot.scholarshipPct <= 0) continue;
    if (!decisionByEnrollmentId.has(enrollment.id)) {
      return NextResponse.json(
        { error: `Học viên ${enrollment.studentId} đang có học bổng ${Math.round(snapshot.scholarshipPct * 100)}% — cần chọn giữ nguyên, giảm hay bỏ trước khi kết thúc lớp.` },
        { status: 400 },
      );
    }
    const chosen = decisionByEnrollmentId.get(enrollment.id)!;
    if (!Number.isFinite(chosen) || chosen < 0 || chosen > snapshot.scholarshipPct) {
      return NextResponse.json(
        { error: `Phần trăm học bổng không hợp lệ cho học viên ${enrollment.studentId}.` },
        { status: 400 },
      );
    }
    scholarshipPctByEnrollmentId.set(enrollment.id, chosen);
  }

  const now = new Date();
  const createdEnrollmentIds: string[] = [];
  const createdEnrollmentBillingModel = new Map<string, string>();
  const result = await prisma.$transaction(async (tx) => {
    let completed = 0;
    let transferred = 0;
    let freeExtraCarried = 0;
    let transferValueAmount = 0;

    for (const { enrollment, snapshot } of completeOutrightGroup) {
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
      void snapshot; // giữ tham chiếu để không phải đổi kiểu dữ liệu của mảng, không dùng tới cho nhánh này
    }

    for (const { enrollment, snapshot } of transferGroup) {
      if (!targetClass) throw new Error("Thiếu lớp tiếp theo.");
      const enrollmentIsPeriod = isPeriod(enrollment.billingModel);
      // snapshot.unitPrice đã trừ học bổng/điều chỉnh đang hiệu lực của đúng học viên
      // này — mỗi học viên trong danh sách transferGroup có thể có mức giảm khác
      // nhau, nên không dùng lại resolveEnrollmentUnitPrice() (giá gốc) ở đây.
      const oldUnitPrice = snapshot.unitPrice;
      const chosenScholarshipPct = scholarshipPctByEnrollmentId.get(enrollment.id) ?? 0;
      const rawNewUnitPrice = targetClass.tuitionPerSession ?? targetClass.course?.tuitionPerSession ?? 0;
      const newUnitPrice = chosenScholarshipPct > 0
        ? computeEffectiveUnitPrice(rawNewUnitPrice, chosenScholarshipPct, snapshot.adjustmentPct)
        : rawNewUnitPrice;
      if (!Number.isInteger(newUnitPrice) || newUnitPrice <= 0) {
        throw new Error(`Lớp tiếp theo "${targetClass.className}" chưa có đơn giá/buổi hợp lệ.`);
      }

      // PERIOD: quy đổi qua Ví (mục 3.9) — không có "hết buổi thì chặn", ví có thể
      // đang = 0 mà vẫn chuyển bình thường, chỉ là enrollment mới bắt đầu ví trống.
      // COURSE: giữ nguyên công thức cũ dựa trên purchasedMainSessionCount.
      const walletBalanceBefore = enrollmentIsPeriod ? await getWalletBalance(tx, enrollment.id) : 0;
      const conversion = enrollmentIsPeriod
        ? (() => {
            const remainingValue = walletBalanceBefore * Math.max(0, oldUnitPrice);
            const convertedSessionCount = newUnitPrice > 0 ? Math.floor(remainingValue / newUnitPrice) : 0;
            return {
              remainingValue,
              convertedSessionCount,
              remainingCashAmount: newUnitPrice > 0 ? remainingValue - convertedSessionCount * newUnitPrice : remainingValue,
            };
          })()
        : computeTransferConversionFromValue(snapshot.transferableValue, newUnitPrice);

      // KHÔNG chặn khi quy đổi ra 0 buổi. Lớp đang đóng lại, học viên bắt buộc phải có
      // chỗ đi tiếp — chặn ở đây nghĩa là 1 người còn nợ học phí sẽ khóa luôn thao tác
      // kết thúc lớp của CẢ lớp, và người đó bị kẹt lại trong lớp đã đóng. Đúng nghiệp
      // vụ: vẫn chuyển sang lớp mới với đúng giá trị đang có (có thể là 0), khoản nợ cũ
      // vẫn nằm nguyên trên charge cũ để kế toán tiếp tục thu.

      const note = [
        `Kết thúc lớp ${cls.className}, chuyển sang ${targetClass.className}`,
        enrollmentIsPeriod
          ? `Còn ${walletBalanceBefore} buổi trong ví x ${oldUnitPrice.toLocaleString("vi-VN")}đ = ${conversion.remainingValue.toLocaleString("vi-VN")}đ`
          : `Còn tiền: ${snapshot.transferableSessions} buổi × ${oldUnitPrice.toLocaleString("vi-VN")}đ = ${conversion.remainingValue.toLocaleString("vi-VN")}đ (đã thu ${(snapshot.paidTuitionAmount ?? 0).toLocaleString("vi-VN")}đ học phí)`,
        conversion.convertedSessionCount > 0 ? `Quy đổi ${conversion.convertedSessionCount} buổi ở lớp mới` : null,
        !enrollmentIsPeriod && snapshot.manualExtraRemainingSessions > 0 ? `Mang theo ${snapshot.manualExtraRemainingSessions} buổi cộng linh động` : null,
        conversion.remainingCashAmount > 0 ? `Dư ${conversion.remainingCashAmount.toLocaleString("vi-VN")}đ` : null,
        snapshot.scholarshipPct > 0
          ? chosenScholarshipPct > 0
            ? `Admin chọn mang học bổng ${Math.round(chosenScholarshipPct * 100)}% sang lớp mới (trước đó ${Math.round(snapshot.scholarshipPct * 100)}%)`
            : `Admin chọn không mang học bổng ${Math.round(snapshot.scholarshipPct * 100)}% sang lớp mới`
          : null,
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
          // Gắn đúng khóa học của lớp — trước đây bỏ trống nên mọi ghi danh tạo qua giao
          // diện đều mất liên kết khóa, các màn hình phải tự suy ngược từ class.courseId.
          courseId: targetClass.courseId,
          status: "ACTIVE",
          billingModel: enrollment.billingModel,
          enrollDate: now,
          learningStartDate: now,
          purchasedMainSessionCount: enrollmentIsPeriod ? null : conversion.convertedSessionCount,
          periodCourseSessionCount: enrollmentIsPeriod ? periodCourseRemainingById.get(enrollment.id) ?? null : null,
          manualExtraSessionCount: enrollmentIsPeriod ? 0 : snapshot.manualExtraRemainingSessions,
          // Tiến độ điểm danh đi xuyên suốt các lớp nối tiếp, không reset khi lớp cũ
          // kết thúc và chuyển sang lớp mới (cùng lý do như route transfer đơn lẻ).
          usedSessionCount: enrollment.usedSessionCount,
          tuitionUnitPriceSnapshot: newUnitPrice,
          paidCatchupSessionCount: 0,
          paidCatchupUnitPrice: newUnitPrice,
          pricingBasis: "CONTINUATION_TRANSFER",
          transferredFromEnrollmentId: enrollment.id,
          transferredValueAmount: conversion.remainingValue,
          transferredConvertedSessionCount: conversion.convertedSessionCount,
          transferredRemainingCashAmount: conversion.remainingCashAmount,
          // Nhãn gói hiển thị trên hồ sơ học viên (xem ghi chú cùng chỗ ở route chuyển lớp đơn lẻ).
          packageLabel: enrollmentIsPeriod
            ? `${targetClass.className} (đóng theo tháng)`
            : conversion.convertedSessionCount > 0
              ? `${targetClass.className} ${conversion.convertedSessionCount} buổi (chuyển lớp)`
              : `${targetClass.className} (chuyển lớp — chưa có buổi đã đóng)`,
          notes: note,
        },
      });
      createdEnrollmentIds.push(nextEnrollment.id);
      createdEnrollmentBillingModel.set(nextEnrollment.id, enrollment.billingModel);

      // Bộ giáo trình chuẩn của lớp mới — trước đây chỉ luồng ghi danh tay mới gắn.
      await attachCourseBookRequirements(tx, { studentId: enrollment.studentId, classId: targetClass.id, enrollmentId: nextEnrollment.id });

      if (enrollmentIsPeriod) {
        await transferWalletToNewEnrollment(tx, {
          fromEnrollmentId: enrollment.id,
          toEnrollmentId: nextEnrollment.id,
          oldUnitPrice,
          newUnitPrice,
        });
      }

      if (chosenScholarshipPct > 0) {
        await tx.scholarship.create({
          data: {
            studentId: enrollment.studentId,
            enrollmentId: nextEnrollment.id,
            percentage: chosenScholarshipPct,
            reason: `Admin chọn giữ ${Math.round(chosenScholarshipPct * 100)}% khi kết thúc lớp: ${cls.className} -> ${targetClass.className}`,
            effectiveFrom: now,
            effectiveTo: null,
          },
        });
      }

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
      freeExtraCarried += enrollmentIsPeriod ? 0 : snapshot.manualExtraRemainingSessions;
      transferValueAmount += conversion.remainingValue;
    }

    await tx.class.update({ where: { id: cls.id }, data: { status: "COMPLETED" } });
    return { completed, transferred, freeExtraCarried, transferValueAmount };
  });

  const billingWarnings: string[] = [];
  for (const enrollmentId of createdEnrollmentIds) {
    // PERIOD không thu 1 cục lúc ghi danh (charge sinh theo tháng) — chỉ gọi
    // generateCourseCharge cho enrollment COURSE, tránh cảnh báo vô nghĩa
    // "enrollment đang ở mode PERIOD" hiện lên cho mọi ca chuyển lớp PERIOD.
    if (createdEnrollmentBillingModel.get(enrollmentId) !== "COURSE") continue;
    // Chuyển sang với 0 buổi (học viên còn nợ, không còn tiền quy đổi) thì chưa có gì
    // để lập phiếu — bỏ qua thay vì đẩy ra cảnh báo "chưa cấu hình tổng số buổi" gây
    // hiểu nhầm là lỗi cấu hình lớp.
    const created = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, select: { purchasedMainSessionCount: true } });
    if (!created?.purchasedMainSessionCount) continue;
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
