import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

// ĐẶT / SỬA SỐ BUỔI CỦA KHÓA cho ghi danh đóng theo tháng — học viên ghi danh trước khi có
// ô này (hoặc nhập nhầm) thì đặt lại ở drawer học viên. Số này tính cho CHÍNH ghi danh
// (lớp) hiện tại: phiếu tháng của ghi danh này cộng lại không vượt quá nó.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("tuition", role)) {
    return NextResponse.json({ error: "Bạn không có quyền sửa học phí." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const total = Number(body.periodCourseSessionCount);
  if (!Number.isInteger(total) || total <= 0 || total > 500) {
    return NextResponse.json({ error: "Số buổi của khóa phải là số nguyên từ 1 đến 500." }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({ where: { id: params.id }, include: { class: { select: { branchId: true } } } });
  if (!enrollment) return NextResponse.json({ error: "Không tìm thấy ghi danh." }, { status: 404 });
  if (enrollment.billingModel !== "PERIOD") {
    return NextResponse.json({ error: "Chỉ ghi danh đóng theo tháng mới đặt số buổi khóa." }, { status: 400 });
  }

  const updated = await prisma.enrollment.update({ where: { id: enrollment.id }, data: { periodCourseSessionCount: total } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: enrollment.class?.branchId ?? null,
      action: "ENROLLMENT_PERIOD_COURSE_SET",
      entityType: "Enrollment",
      entityId: enrollment.id,
      before: JSON.stringify({ periodCourseSessionCount: enrollment.periodCourseSessionCount }),
      after: JSON.stringify({ periodCourseSessionCount: total }),
    },
  });
  return NextResponse.json({ item: { id: updated.id, periodCourseSessionCount: updated.periodCourseSessionCount } });
}
