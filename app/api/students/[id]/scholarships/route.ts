import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { refreshEditableChargesForStudent } from "@/lib/server/charge-repricing";

// Dùng canUpdate (không phải canCreate) để nhất quán với các route "tuition" khác
// (generate-charges, billing-periods, charges/[id]) — không role nào trong ROLE_MATRIX.tuition
// có mức CREATE_VIEW, dùng canCreate sẽ chặn nhầm Quản lý cơ sở (APPROVE_VIEW).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền cấp học bổng" }, { status: 403 });
  }

  const body = await req.json();
  const percentage = Number(body.percentage);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 1) {
    return NextResponse.json({ error: "Tỉ lệ học bổng phải trong khoảng 0–1 (vd 0.2 = 20%)" }, { status: 400 });
  }

  const enrollmentId = String(body.enrollmentId ?? "").trim();
  if (!enrollmentId) {
    return NextResponse.json({ error: "Học bổng phải gắn với một ghi danh (khóa/lớp) cụ thể." }, { status: 400 });
  }
  const enrollment = await prisma.enrollment.findFirst({ where: { id: enrollmentId, studentId: params.id } });
  if (!enrollment) {
    return NextResponse.json({ error: "Ghi danh không hợp lệ hoặc không thuộc học viên này." }, { status: 400 });
  }

  const scholarship = await prisma.scholarship.create({
    data: {
      studentId: params.id,
      enrollmentId,
      percentage,
      reason: body.reason || null,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
    },
  });

  await refreshEditableChargesForStudent(params.id);

  return NextResponse.json({ item: scholarship }, { status: 201 });
}
