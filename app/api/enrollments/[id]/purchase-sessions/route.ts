import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { ensureBillingPeriod } from "@/lib/server/billing-generation";
import { canEditCharges, computeTotalAmount, monthKey } from "@/lib/server/tuition-rules";
import { resolveEnrollmentUnitPrice } from "@/lib/server/enrollment-learning";
import { settleChargesFromAdvancePayments } from "@/lib/server/advance-payment";

// MUA THÊM BUỔI vào chính lớp đang học — ví dụ ban đầu đăng ký 50 buổi, giờ đổi thành 55.
//
// Khác hẳn "Cộng buổi linh động" (app/api/enrollments/[id]/extra-sessions): cái đó cố ý
// KHÔNG thu tiền, dành cho ngoại lệ vận hành (đền bù, ưu đãi). Còn đây là phụ huynh mua
// thêm thật, nên phải ra tiền, nếu không trung tâm dạy thêm 5 buổi mà không thu đồng nào.
//
// Chỉ áp dụng cho gói THEO KHÓA. Gói theo tháng không có khái niệm "số buổi đã mua" —
// muốn học thêm thì cứ đóng tiền, ví tự đầy lên (xem lib/server/enrollment-wallet.ts).
//
// Về phiếu học phí: mỗi ghi danh theo khóa chỉ có ĐÚNG MỘT phiếu cho cả khóa
// (generateCourseCharge), và CSDL cũng chỉ cho 1 phiếu trên mỗi (học viên, lớp, kỳ thu).
// Nên mua thêm buổi thì CỘNG VÀO chính phiếu đó thay vì đẻ phiếu thứ hai — phụ huynh
// nhìn thấy một tổng duy nhất, và phần vừa thêm tự thành khoản còn thiếu.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("tuition", role)) {
    return NextResponse.json({ error: "Bạn không có quyền thay đổi học phí" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const additionalSessions = Math.floor(Number(body.additionalSessions));
  if (!Number.isFinite(additionalSessions) || additionalSessions <= 0) {
    return NextResponse.json({ error: "Số buổi mua thêm phải lớn hơn 0." }, { status: 400 });
  }
  if (additionalSessions > 200) {
    return NextResponse.json({ error: "Số buổi mua thêm quá lớn, kiểm tra lại." }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: params.id },
    include: { class: { include: { course: true, scheduleRules: true } }, student: true },
  });
  if (!enrollment) return NextResponse.json({ error: "Không tìm thấy ghi danh" }, { status: 404 });
  if (enrollment.billingModel === "PERIOD") {
    return NextResponse.json(
      {
        error:
          "Gói đóng theo tháng không có số buổi cố định để mua thêm — phụ huynh đóng tiền là ví buổi học tự đầy lên.",
      },
      { status: 409 },
    );
  }
  if (!enrollment.classId || !enrollment.class) {
    return NextResponse.json({ error: "Ghi danh này chưa gắn lớp nào." }, { status: 409 });
  }
  if (enrollment.status === "TRANSFERRED" || enrollment.status === "WITHDRAWN") {
    return NextResponse.json(
      { error: `Ghi danh đang ở trạng thái "${enrollment.status}", không mua thêm buổi được.` },
      { status: 409 },
    );
  }

  const unitPrice = Number(body.unitPrice) > 0 ? Math.round(Number(body.unitPrice)) : resolveEnrollmentUnitPrice(enrollment);
  if (unitPrice <= 0) {
    return NextResponse.json({ error: "Chưa có đơn giá buổi học cho ghi danh này." }, { status: 409 });
  }
  const addedAmount = additionalSessions * unitPrice;

  // Cộng vào phiếu học phí sẵn có của khóa; chưa có thì lập ở kỳ thu của tháng này.
  const existingCharge = await prisma.charge.findFirst({
    where: { enrollmentId: enrollment.id, billingModel: "COURSE" },
    include: { billingPeriod: true },
    orderBy: { createdAt: "desc" },
  });

  const result = await prisma.$transaction(async (tx) => {
    const updatedEnrollment = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { purchasedMainSessionCount: { increment: additionalSessions } },
    });

    let chargeId: string;
    let chargeTotal: number;

    if (existingCharge) {
      // Kỳ thu đã chốt sổ thì không được sửa phiếu cũ — số liệu đã lên báo cáo.
      if (!canEditCharges(existingCharge.billingPeriod.status)) {
        throw new Error(
          `Kỳ thu ${existingCharge.billingPeriod.periodName} đã chốt sổ, không cộng thêm vào phiếu học phí cũ được. ` +
            "Mở lại kỳ thu đó rồi thử lại.",
        );
      }
      const tuitionAmount = existingCharge.tuitionAmount + addedAmount;
      const updated = await tx.charge.update({
        where: { id: existingCharge.id },
        data: {
          sessionCount: existingCharge.sessionCount + additionalSessions,
          mainTuitionAmount: existingCharge.mainTuitionAmount + addedAmount,
          tuitionAmount,
          totalAmount: computeTotalAmount(tuitionAmount, existingCharge.materialsAmount, existingCharge.openingBalance),
          notes: [existingCharge.notes, `Mua thêm ${additionalSessions} buổi x ${unitPrice.toLocaleString("vi-VN")}đ`]
            .filter(Boolean)
            .join(" · "),
        },
      });
      chargeId = updated.id;
      chargeTotal = updated.totalAmount;
    } else {
      const period = await ensureBillingPeriod(enrollment.class!.branchId, monthKey(new Date()));
      const created = await tx.charge.create({
        data: {
          studentId: enrollment.studentId,
          classId: enrollment.classId!,
          billingPeriodId: period.id,
          enrollmentId: enrollment.id,
          sessionCount: additionalSessions,
          unitPrice,
          mainTuitionAmount: addedAmount,
          tuitionAmount: addedAmount,
          materialsAmount: 0,
          openingBalance: 0,
          totalAmount: addedAmount,
          billingModel: "COURSE",
          notes: `Mua thêm ${additionalSessions} buổi x ${unitPrice.toLocaleString("vi-VN")}đ`,
        },
      });
      chargeId = created.id;
      chargeTotal = created.totalAmount;
    }

    // Học viên đang có tiền đóng trước thì trừ luôn vào khoản vừa phát sinh, khỏi bắt
    // phụ huynh đóng lại — xem lib/server/advance-payment.ts.
    await settleChargesFromAdvancePayments(tx, enrollment.studentId);

    return { chargeId, chargeTotal, purchased: updatedEnrollment.purchasedMainSessionCount };
  }).catch((error: unknown) => ({ error: error instanceof Error ? error.message : "Không mua thêm buổi được." }));

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });

  return NextResponse.json({
    ok: true,
    purchasedMainSessionCount: result.purchased,
    addedSessions: additionalSessions,
    addedAmount,
    chargeId: result.chargeId,
    chargeTotalAmount: result.chargeTotal,
    message:
      `Đã mua thêm ${additionalSessions} buổi cho ${enrollment.student.fullName} ` +
      `(${addedAmount.toLocaleString("vi-VN")}đ). Tổng số buổi đã mua nay là ${result.purchased}.`,
  });
}
