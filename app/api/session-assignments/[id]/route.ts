import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeSessionBaseHours, computeAdjustedHours } from "@/lib/server/payroll-rules";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canDelete } from "@/lib/server/role-matrix";

// Sửa điều chỉnh giờ (Trừ giờ/Cộng giờ — đi muộn, chuẩn bị thêm...) sau khi đã phân công —
// nguồn Report_Cong_Luong "Trừ giờ GV/TG"/"Cộng giờ GV/TG". Tính lại hours/amount từ giờ
// theo khung ca của buổi học + điều chỉnh, giữ hourlyRate snapshot cũ (không đổi đơn giá ở đây).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role) && !canUpdate("timesheet", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa điều chỉnh giờ công" }, { status: 403 });
  }

  const existing = await prisma.sessionAssignment.findUnique({
    where: { id: params.id },
    include: { session: true, employee: true },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy phân công" }, { status: 404 });

  const body = await req.json();
  const deductedHours = body.deductedHours !== undefined ? Number(body.deductedHours) : existing.deductedHours;
  const addedHours = body.addedHours !== undefined ? Number(body.addedHours) : existing.addedHours;
  if (!Number.isFinite(deductedHours) || deductedHours < 0 || !Number.isFinite(addedHours) || addedHours < 0) {
    return NextResponse.json({ error: "Số giờ điều chỉnh không hợp lệ" }, { status: 400 });
  }

  const baseHours = computeSessionBaseHours(existing.employee.payMode, existing.session.startTime, existing.session.endTime);
  const hours = computeAdjustedHours(baseHours, deductedHours, addedHours);
  const amount = Math.round(hours * (existing.hourlyRate ?? 0));

  const updated = await prisma.sessionAssignment.update({
    where: { id: params.id },
    data: {
      deductedHours,
      addedHours,
      adjustmentNote: "adjustmentNote" in body ? body.adjustmentNote || null : existing.adjustmentNote,
      hours,
      amount,
      isSubstituteShift: "isSubstituteShift" in body ? !!body.isSubstituteShift : existing.isSubstituteShift,
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canDelete("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa phân công" }, { status: 403 });
  }
  await prisma.sessionAssignment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
