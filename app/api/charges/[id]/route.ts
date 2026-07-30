import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canEditCharges, computeTotalAmount, computeTuitionAmount } from "@/lib/server/tuition-rules";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

// Cho phép nhân sự chỉnh tay "Buoi tru" (buổi trừ, vd nghỉ có phép không tính vào
// công thức tự động) — spec §14 liệt kê đây là điểm không được tự quyết định thay.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "tuition");
  if (!canUpdateWithOverride("tuition", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa khoản học phí" }, { status: 403 });
  }

  const charge = await prisma.charge.findUnique({ where: { id: params.id }, include: { billingPeriod: true } });
  if (!charge) return NextResponse.json({ error: "Không tìm thấy khoản học phí" }, { status: 404 });
  if (!canEditCharges(charge.billingPeriod.status)) {
    return NextResponse.json({ error: "Kỳ thu đã chốt sổ, không thể sửa. Cần mở lại kỳ trước." }, { status: 409 });
  }

  const body = await req.json();
  const deductedCount = "deductedCount" in body ? Number(body.deductedCount) : charge.deductedCount;
  const tuitionAmount = computeTuitionAmount(charge.sessionCount, charge.absentCount, deductedCount, charge.unitPrice);
  const totalAmount = computeTotalAmount(tuitionAmount, charge.materialsAmount, charge.openingBalance);

  const updated = await prisma.charge.update({
    where: { id: params.id },
    data: {
      deductedCount,
      tuitionAmount,
      totalAmount,
      notes: "notes" in body ? body.notes || null : charge.notes,
    },
  });

  return NextResponse.json({ item: updated });
}
