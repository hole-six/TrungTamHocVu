import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { generateChargesForPeriod, generateCourseCharge } from "@/lib/server/billing-generation";

async function inferRelevantBillingPeriodId(branchId: string) {
  const now = new Date();
  const current = await prisma.billingPeriod.findFirst({
    where: {
      branchId,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { startDate: "desc" },
  });

  if (current) return current.id;

  const latestEditable = await prisma.billingPeriod.findFirst({
    where: {
      branchId,
      status: { in: ["DRAFT", "GENERATED", "REVIEWED", "REOPENED"] },
    },
    orderBy: { startDate: "desc" },
  });

  return latestEditable?.id ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền đổi kiểu thu học phí." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nextBillingModel = String(body.billingModel ?? "").toUpperCase();
  const billingPeriodId = typeof body.billingPeriodId === "string" ? body.billingPeriodId : null;

  if (nextBillingModel !== "PERIOD" && nextBillingModel !== "COURSE") {
    return NextResponse.json({ error: "Chỉ hỗ trợ đổi giữa thu theo tháng và thu trọn khóa." }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: params.id },
    include: { class: true },
  });
  if (!enrollment) return NextResponse.json({ error: "Không tìm thấy ghi danh." }, { status: 404 });

  if (enrollment.status !== "ACTIVE") {
    return NextResponse.json({ error: `Ghi danh đang ở trạng thái ${enrollment.status}, không thể đổi kiểu thu.` }, { status: 409 });
  }

  if (enrollment.billingModel === nextBillingModel) {
    return NextResponse.json({ item: enrollment, unchanged: true });
  }

  const effectiveBillingPeriodId = billingPeriodId ?? (await inferRelevantBillingPeriodId(enrollment.class.branchId));

  const reason =
    nextBillingModel === "COURSE"
      ? "Đổi từ thu theo tháng sang thu trọn khóa. Charge chưa thu của kỳ hiện tại sẽ được thay thế."
      : "Đổi từ thu trọn khóa sang thu theo tháng. Charge chưa thu của kỳ hiện tại sẽ được làm mới.";

  const updated = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { billingModel: nextBillingModel },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: enrollment.class.branchId,
      action: "TUITION_BILLING_MODEL_SWITCHED",
      entityType: "Enrollment",
      entityId: enrollment.id,
      before: JSON.stringify({
        billingModel: enrollment.billingModel,
        studentId: enrollment.studentId,
        classId: enrollment.classId,
      }),
      after: JSON.stringify({
        billingModel: nextBillingModel,
        studentId: enrollment.studentId,
        classId: enrollment.classId,
        billingPeriodId: effectiveBillingPeriodId,
      }),
      reason,
    },
  });

  if (nextBillingModel === "COURSE") {
    const result = await generateCourseCharge(
      enrollment.id,
      effectiveBillingPeriodId ? { billingPeriodId: effectiveBillingPeriodId } : undefined,
    );
    if ("error" in result) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { billingModel: enrollment.billingModel },
      });
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ item: updated, refreshedPeriodId: effectiveBillingPeriodId });
  }

  if (effectiveBillingPeriodId) {
    const result = await generateChargesForPeriod(effectiveBillingPeriodId);
    // generateChargesForPeriod sinh cho CẢ kỳ (nhiều học viên) — lỗi riêng của ĐÚNG
    // enrollment này (vd charge COURSE cũ đã thu tiền nên không thay được) không nằm
    // ở "error" cấp cao (chỉ dùng cho lỗi cấp kỳ như kỳ đã khóa sổ), mà nằm trong
    // exceptions[] theo từng học viên/lớp — phải tự soi đúng enrollment đang đổi,
    // nếu không sẽ đổi billingModel "thành công" trong khi charge thật sự chưa hề
    // được sinh lại, để học viên treo lửng lơ ở kiểu thu mới không có charge nào.
    const ownException = "error" in result
      ? null
      : result.exceptions.find((item) => item.studentId === enrollment.studentId && item.classId === enrollment.classId);
    if ("error" in result || ownException) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { billingModel: enrollment.billingModel },
      });
      const message = "error" in result ? result.error : ownException!.reason;
      return NextResponse.json({ error: message }, { status: 409 });
    }
  }

  return NextResponse.json({ item: updated, refreshedPeriodId: effectiveBillingPeriodId });
}
