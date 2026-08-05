import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";
import { refreshEditableChargesForStudent } from "@/lib/server/charge-repricing";
import { overlapsWindow } from "@/lib/server/tuition-rules";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo điều chỉnh học phí" }, { status: 403 });
  }

  const body = await req.json();
  const percentage = Number(body.percentage);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 1) {
    return NextResponse.json({ error: "Tỉ lệ điều chỉnh phải trong khoảng 0–1 (vd 0.05 = 5%)" }, { status: 400 });
  }

  const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : new Date();
  const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;

  const existingAdjustments = await prisma.adjustment.findMany({ where: { studentId: params.id } });
  const hasOverlap = existingAdjustments.some((item) =>
    overlapsWindow(item.effectiveFrom, item.effectiveTo, effectiveFrom, effectiveTo),
  );
  if (hasOverlap) {
    return NextResponse.json(
      { error: "Học viên này đã có điều chỉnh học phí khác trùng khoảng thời gian hiệu lực." },
      { status: 409 },
    );
  }

  const adjustment = await prisma.adjustment.create({
    data: {
      studentId: params.id,
      percentage,
      reason: body.reason || null,
      effectiveFrom,
      effectiveTo,
    },
  });

  const { skipped } = await refreshEditableChargesForStudent(params.id);

  return NextResponse.json({ item: adjustment, chargesSkippedBelowCollected: skipped }, { status: 201 });
}
