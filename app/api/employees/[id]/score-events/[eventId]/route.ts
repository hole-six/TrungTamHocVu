import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdateWithOverride } from "@/lib/server/role-matrix";

// Sửa tại chỗ 1 điểm trừ/cộng đã ghi — trước đây chỉ có DELETE nên muốn sửa phải xóa
// rồi tạo lại, mất createdById/thời điểm gốc. Validate y hệt POST ở route.ts cùng cấp.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; eventId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa điểm trợ giảng" }, { status: 403 });
  }

  const existing = await prisma.assistantScoreEvent.findUnique({ where: { id: params.eventId } });
  if (!existing || existing.employeeId !== params.id) {
    return NextResponse.json({ error: "Không tìm thấy điểm sự kiện" }, { status: 404 });
  }

  const body = await req.json();
  const branchId = String(body.branchId ?? "").trim();
  const type = String(body.type ?? "");
  const points = Number(body.points);
  if (!branchId) return NextResponse.json({ error: "Thiếu cơ sở" }, { status: 400 });
  if (!["DEDUCT", "ADD"].includes(type)) return NextResponse.json({ error: "Loại điểm không hợp lệ" }, { status: 400 });
  if (!Number.isFinite(points) || points <= 0) return NextResponse.json({ error: "Số điểm phải lớn hơn 0" }, { status: 400 });
  if (!body.eventDate) return NextResponse.json({ error: "Thiếu ngày" }, { status: 400 });

  const event = await prisma.assistantScoreEvent.update({
    where: { id: params.eventId },
    data: {
      branchId,
      eventDate: new Date(body.eventDate),
      type,
      points,
      reason: body.reason || null,
    },
  });

  return NextResponse.json({ item: event });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; eventId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canUpdateWithOverride("hr", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa điểm trợ giảng" }, { status: 403 });
  }

  const existing = await prisma.assistantScoreEvent.findUnique({ where: { id: params.eventId } });
  if (!existing || existing.employeeId !== params.id) {
    return NextResponse.json({ error: "Không tìm thấy điểm sự kiện" }, { status: 404 });
  }

  await prisma.assistantScoreEvent.delete({ where: { id: params.eventId } });
  return NextResponse.json({ success: true });
}
