import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { refreshEditableChargesForStudent } from "@/lib/server/charge-repricing";
import { overlapsWindow } from "@/lib/server/tuition-rules";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; adjustmentId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền sửa điều chỉnh học phí." }, { status: 403 });
  }

  const existing = await prisma.adjustment.findFirst({ where: { id: params.adjustmentId, studentId: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy điều chỉnh." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const percentage = Number(body.percentage);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 1) {
    return NextResponse.json({ error: "Tỷ lệ điều chỉnh phải trong khoảng 0–1." }, { status: 400 });
  }

  const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : existing.effectiveFrom;
  const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;

  const enrollmentId = "enrollmentId" in body ? (body.enrollmentId ? String(body.enrollmentId).trim() : null) : existing.enrollmentId;
  if (enrollmentId) {
    const enrollment = await prisma.enrollment.findFirst({ where: { id: enrollmentId, studentId: params.id } });
    if (!enrollment) {
      return NextResponse.json({ error: "Ghi danh không hợp lệ hoặc không thuộc học viên này." }, { status: 400 });
    }
  }

  const otherAdjustments = await prisma.adjustment.findMany({
    where: { studentId: params.id, id: { not: existing.id } },
  });
  const hasOverlap = otherAdjustments
    .filter((item) => item.enrollmentId === null || enrollmentId === null || item.enrollmentId === enrollmentId)
    .some((item) => overlapsWindow(item.effectiveFrom, item.effectiveTo, effectiveFrom, effectiveTo));
  if (hasOverlap) {
    return NextResponse.json(
      { error: "Học viên này đã có điều chỉnh học phí khác trùng khoảng thời gian hiệu lực (cùng phạm vi lớp)." },
      { status: 409 },
    );
  }

  const updated = await prisma.adjustment.update({
    where: { id: existing.id },
    data: {
      percentage,
      reason: body.reason || null,
      effectiveFrom,
      effectiveTo,
      enrollmentId,
    },
  });

  await refreshEditableChargesForStudent(params.id);
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; adjustmentId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Bạn không có quyền xóa điều chỉnh học phí." }, { status: 403 });
  }

  const existing = await prisma.adjustment.findFirst({ where: { id: params.adjustmentId, studentId: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy điều chỉnh." }, { status: 404 });

  await prisma.adjustment.delete({ where: { id: existing.id } });
  await refreshEditableChargesForStudent(params.id);
  return NextResponse.json({ ok: true });
}
