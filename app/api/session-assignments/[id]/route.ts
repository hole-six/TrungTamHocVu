import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeHoursFromTimeRange, computeAdjustedHours } from "@/lib/server/payroll-rules";

// Sửa điều chỉnh giờ (Trừ giờ/Cộng giờ — đi muộn, chuẩn bị thêm...) sau khi đã phân công —
// nguồn Report_Cong_Luong "Trừ giờ GV/TG"/"Cộng giờ GV/TG". Tính lại hours/amount từ giờ
// theo khung ca của buổi học + điều chỉnh, giữ hourlyRate snapshot cũ (không đổi đơn giá ở đây).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const existing = await prisma.sessionAssignment.findUnique({
    where: { id: params.id },
    include: { session: true },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy phân công" }, { status: 404 });

  const body = await req.json();
  const deductedHours = body.deductedHours !== undefined ? Number(body.deductedHours) : existing.deductedHours;
  const addedHours = body.addedHours !== undefined ? Number(body.addedHours) : existing.addedHours;
  if (!Number.isFinite(deductedHours) || deductedHours < 0 || !Number.isFinite(addedHours) || addedHours < 0) {
    return NextResponse.json({ error: "Số giờ điều chỉnh không hợp lệ" }, { status: 400 });
  }

  const baseHours =
    existing.session.startTime && existing.session.endTime
      ? computeHoursFromTimeRange(existing.session.startTime, existing.session.endTime)
      : 0;
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
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  await prisma.sessionAssignment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
