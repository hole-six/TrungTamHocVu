import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { generateCourseCharge, getPeriodCourseRemaining } from "@/lib/server/billing-generation";
import { computeTransferConversionFromValue, getEnrollmentLearningSnapshot } from "@/lib/server/enrollment-learning";
import { computeEffectiveUnitPrice } from "@/lib/server/tuition-rules";
import { transferWalletToNewEnrollment, getWalletBalance } from "@/lib/server/enrollment-wallet";
import { attachCourseBookRequirements } from "@/lib/server/enrollment-materials";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền chuyển lớp cho học viên" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const existing = await prisma.enrollment.findUnique({
    where: { id: params.id },
    include: { class: { include: { course: true, nextClass: { include: { course: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy ghi danh" }, { status: 404 });
  if (existing.status !== "ACTIVE") return NextResponse.json({ error: "Chỉ chuyển lớp được cho ghi danh đang học." }, { status: 409 });
  if (!existing.class) return NextResponse.json({ error: "Gói học chưa được gán vào lớp cụ thể để thực hiện chuyển lớp." }, { status: 400 });

  const targetClassId = String(body.targetClassId ?? existing.class.nextClassId ?? "").trim();
  if (!targetClassId) return NextResponse.json({ error: "Lớp hiện tại chưa cấu hình lớp tiếp theo." }, { status: 400 });
  if (targetClassId === existing.classId) return NextResponse.json({ error: "Lớp mới phải khác lớp hiện tại." }, { status: 400 });

  const targetClass = await prisma.class.findUnique({ where: { id: targetClassId }, include: { course: true } });
  if (!targetClass) return NextResponse.json({ error: "Không tìm thấy lớp mới" }, { status: 404 });
  if (targetClass.branchId !== existing.class.branchId) {
    return NextResponse.json({ error: "Lớp mới phải cùng cơ sở với lớp hiện tại." }, { status: 400 });
  }

  const existingActive = await prisma.enrollment.findFirst({
    where: { studentId: existing.studentId, classId: targetClass.id, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
  });
  if (existingActive) return NextResponse.json({ error: "Học viên đã có ghi danh đang mở ở lớp mới." }, { status: 409 });

  // PERIOD (95% học sinh) không có khái niệm "hết buổi" — quyền học nằm trong Ví
  // buổi học, không phải purchasedMainSessionCount. Chuyển lớp tự do bất kể ví còn
  // bao nhiêu (chốt nghiệp vụ). Chỉ COURSE mới có "hết buổi thì hết giá trị chuyển"
  // — giữ nguyên hành vi cũ cho nhóm đó.
  const isPeriod = existing.billingModel === "PERIOD";

  const snapshot = await getEnrollmentLearningSnapshot(prisma, existing);
  if (!isPeriod && snapshot.remainingMainSessions <= 0) {
    return NextResponse.json({ error: "Học viên đã học đủ số buổi của khóa, không còn giá trị để chuyển lớp." }, { status: 409 });
  }

  // snapshot.unitPrice đã trừ học bổng/điều chỉnh đang hiệu lực (xem
  // getEnrollmentLearningSnapshot) — dùng đúng số này để quy đổi, không tự lấy lại
  // giá gốc, nếu không số xem trước và số thực tế chuyển lớp sẽ lệch nhau. Các
  // trường scholarshipPct/adjustmentPct/unitPrice không phụ thuộc billingModel nên
  // dùng chung được cho cả PERIOD lẫn COURSE.
  const oldUnitPrice = snapshot.unitPrice;

  // Học bổng gắn theo TỪNG enrollment (không tự động theo học viên) — admin phải
  // CHỦ ĐỘNG chọn % mang sang cho enrollment MỚI (0..% hiện tại), không tự động giữ
  // 100% và cũng không tự động bỏ 100% — vì chuyển sang lớp nâng cao có thể cần GIẢM
  // % chứ không phải giữ nguyên hay mất trắng. Không cho vượt quá % hiện tại qua
  // thao tác chuyển lớp này (cấp thêm ưu đãi mới là việc của ScholarshipAdjustmentForm).
  const rawScholarshipPct = Number(body.scholarshipPct ?? 0);
  if (!Number.isFinite(rawScholarshipPct) || rawScholarshipPct < 0 || rawScholarshipPct > snapshot.scholarshipPct) {
    return NextResponse.json({ error: "Phần trăm học bổng không hợp lệ." }, { status: 400 });
  }
  const chosenScholarshipPct = rawScholarshipPct;
  const rawNewUnitPrice = Number(body.newUnitPrice ?? targetClass.tuitionPerSession ?? targetClass.course?.tuitionPerSession ?? 0);
  if (!Number.isInteger(rawNewUnitPrice) || rawNewUnitPrice <= 0) {
    return NextResponse.json({ error: "Lớp mới chưa có đơn giá/buổi hợp lệ." }, { status: 400 });
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

  // PERIOD: quy đổi qua Ví (buổi còn dư × giá cũ = tiền → chia giá mới = buổi mới,
  // chốt nghiệp vụ mục 3.9 — cùng công thức COURSE đang dùng, không dạy nhân viên 2
  // cách khác nhau). COURSE: giữ đúng công thức cũ dựa trên purchasedMainSessionCount.
  const walletBalanceBefore = isPeriod ? await getWalletBalance(prisma, existing.id) : 0;
  const conversion = isPeriod
    ? (() => {
        const remainingValue = walletBalanceBefore * Math.max(0, oldUnitPrice);
        const convertedSessionCount = newUnitPrice > 0 ? Math.floor(remainingValue / newUnitPrice) : 0;
        return {
          remainingValue,
          convertedSessionCount,
          remainingCashAmount: newUnitPrice > 0 ? remainingValue - convertedSessionCount * newUnitPrice : remainingValue,
        };
      })()
    // THEO KHÓA: quy đổi từ giá trị THỰC SỰ CÒN LẠI của học viên — đã bị chặn trần bởi
    // số tiền học phí thật đã thu (xem transferableValue trong enrollment-learning.ts),
    // nên học viên đóng thiếu không còn được mang sang lớp mới phần chưa từng đóng.
    : computeTransferConversionFromValue(snapshot.transferableValue, newUnitPrice);

  // Không chặn khi quy đổi ra 0 buổi: học viên còn nợ học phí vẫn phải chuyển lớp được
  // (nếu không, nhân viên không có đường nào xử lý ca đó từ giao diện). Màn hình chuyển
  // lớp đã hiện rõ "quy đổi 0 buổi" trước khi bấm xác nhận, và khoản nợ cũ giữ nguyên
  // trên charge cũ để tiếp tục thu.
  // PERIOD: ví có thể đang = 0 (vừa hết, chưa đóng tháng mới) — vẫn cho chuyển, chỉ
  // là enrollment mới bắt đầu với ví trống, y hệt ghi danh mới ở bất kỳ lớp nào.

  const now = new Date();
  const note = [
    `Chuyển từ ${existing.class.className} sang ${targetClass.className}`,
    isPeriod
      ? `Con ${walletBalanceBefore} buoi trong vi x ${oldUnitPrice.toLocaleString("vi-VN")}d = ${conversion.remainingValue.toLocaleString("vi-VN")}d`
      : `Còn ${snapshot.transferableSessions} buổi đã có tiền × ${oldUnitPrice.toLocaleString("vi-VN")}đ = ${conversion.remainingValue.toLocaleString("vi-VN")}đ (đã thu ${(snapshot.paidTuitionAmount ?? 0).toLocaleString("vi-VN")}đ học phí, đã học ${snapshot.completedMainSessions} buổi)`,
    conversion.convertedSessionCount > 0 ? `Quy đổi thành ${conversion.convertedSessionCount} buổi × ${newUnitPrice.toLocaleString("vi-VN")}đ` : null,
    !isPeriod && snapshot.manualExtraRemainingSessions > 0 ? `Mang theo ${snapshot.manualExtraRemainingSessions} buổi cộng linh động` : null,
    conversion.remainingCashAmount > 0 ? `Dư ${conversion.remainingCashAmount.toLocaleString("vi-VN")}đ chuyển thành số dư của học viên` : null,
    snapshot.scholarshipPct > 0
      ? chosenScholarshipPct > 0
        ? `Mang hoc bong ${Math.round(chosenScholarshipPct * 100)}% sang lop moi (truoc do ${Math.round(snapshot.scholarshipPct * 100)}%)`
        : `Khong mang hoc bong ${Math.round(snapshot.scholarshipPct * 100)}% sang lop moi`
      : null,
    body.reason ? `Lý do: ${String(body.reason).trim()}` : null,
  ].filter(Boolean).join(" · ");

  // Đóng theo tháng có số buổi khóa: lớp mới nhận đúng phần khóa CHƯA lập phiếu ở lớp cũ
  // (buổi đã thu mà chưa học thì đi theo ví sang lớp mới) — tổng thu cả chuỗi lớp vẫn
  // đúng bằng số buổi khóa. Tính TRƯỚC transaction (đọc ngoài tx sẽ bị SQLite khóa).
  const periodCourseRemaining = isPeriod ? await getPeriodCourseRemaining(existing) : null;

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
        // Gắn đúng khóa học của lớp — trước đây bỏ trống nên mọi ghi danh tạo qua giao
        // diện đều mất liên kết khóa, các màn hình phải tự suy ngược từ class.courseId.
        courseId: targetClass.courseId,
        status: "ACTIVE",
        billingModel: existing.billingModel,
        enrollDate: now,
        learningStartDate: now,
        purchasedMainSessionCount: isPeriod ? null : conversion.convertedSessionCount,
        periodCourseSessionCount: periodCourseRemaining,
        manualExtraSessionCount: isPeriod ? 0 : snapshot.manualExtraRemainingSessions,
        // Tiến độ điểm danh (đã học/bù bao nhiêu buổi thật) đi xuyên suốt các lớp nối
        // tiếp của cùng học sinh, không reset về 0 khi chuyển lớp — trước đây thiếu
        // dòng này nên mỗi lần chuyển lớp tiến độ lại mất, khác hẳn số buổi còn lại.
        usedSessionCount: existing.usedSessionCount,
        tuitionUnitPriceSnapshot: newUnitPrice,
        paidCatchupSessionCount: 0,
        paidCatchupUnitPrice: newUnitPrice,
        pricingBasis: "CONTINUATION_TRANSFER",
        transferredFromEnrollmentId: existing.id,
        transferredValueAmount: conversion.remainingValue,
        transferredConvertedSessionCount: conversion.convertedSessionCount,
        transferredRemainingCashAmount: conversion.remainingCashAmount,
        // Nhãn gói hiển thị trên hồ sơ học viên — trước đây chuyển lớp xong bị bỏ trống,
        // khiến màn hình học viên hiện "Gói học" chung chung thay vì tên khóa thật.
        packageLabel: isPeriod
          ? `${targetClass.course?.name ?? targetClass.className} (đóng theo tháng)`
          : conversion.convertedSessionCount > 0
            ? `${targetClass.course?.name ?? targetClass.className} ${conversion.convertedSessionCount} buổi (chuyển lớp)`
            : `${targetClass.course?.name ?? targetClass.className} (chuyển lớp — chưa có buổi đã đóng)`,
        notes: note,
      },
    });

    // Bộ giáo trình chuẩn của lớp mới — trước đây chỉ luồng ghi danh tay mới gắn.
    await attachCourseBookRequirements(tx, { studentId: existing.studentId, classId: targetClass.id, enrollmentId: nextEnrollment.id });

    if (isPeriod) {
      await transferWalletToNewEnrollment(tx, {
        fromEnrollmentId: existing.id,
        toEnrollmentId: nextEnrollment.id,
        oldUnitPrice,
        newUnitPrice,
      });
    }

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
          reason: `Tiền lẻ sau quy đổi chuyển lớp: ${existing.class?.className ?? "Gói cũ"} → ${targetClass.className}`,
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
