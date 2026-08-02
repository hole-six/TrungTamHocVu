import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { refreshEditableChargesForStudent } from "@/lib/server/charge-repricing";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; scholarshipId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền sửa học bổng." }, { status: 403 });
  }

  const existing = await prisma.scholarship.findFirst({ where: { id: params.scholarshipId, studentId: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy học bổng." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const percentage = Number(body.percentage);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 1) {
    return NextResponse.json({ error: "Tỷ lệ học bổng phải trong khoảng 0–1." }, { status: 400 });
  }

  const updated = await prisma.scholarship.update({
    where: { id: existing.id },
    data: {
      percentage,
      reason: body.reason || null,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : existing.effectiveFrom,
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
    },
  });

  await refreshEditableChargesForStudent(params.id);
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; scholarshipId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền xóa học bổng." }, { status: 403 });
  }

  const existing = await prisma.scholarship.findFirst({ where: { id: params.scholarshipId, studentId: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy học bổng." }, { status: 404 });

  await prisma.scholarship.delete({ where: { id: existing.id } });
  await refreshEditableChargesForStudent(params.id);
  return NextResponse.json({ ok: true });
}
