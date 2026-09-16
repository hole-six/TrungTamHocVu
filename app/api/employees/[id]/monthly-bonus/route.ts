import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasPermission } from "@/lib/server/permissions";

// Chốt mức thưởng/phạt tháng cho 1 nhân sự — GỘP TOÀN BỘ CƠ SỞ (1 mức/người/tháng).
// Hệ thống đề xuất mức theo quy chế (lib/assistant-rating.ts), người có quyền duyệt lương
// xác nhận hoặc sửa rồi lưu ở đây; bảng lương lấy đúng mức đã chốt.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await hasPermission(user, "payroll", "approve"))) {
    return NextResponse.json({ error: "Bạn không có quyền quyết định mức thưởng" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });

  const body = await req.json();
  const month = String(body.month ?? "").trim();
  const bonusPercent = Number(body.bonusPercent);
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Thiếu tháng (vd 2026-06)" }, { status: 400 });
  if (!Number.isFinite(bonusPercent) || bonusPercent < -1 || bonusPercent > 1) {
    return NextResponse.json({ error: "Mức thưởng phải trong khoảng −100% đến +100%" }, { status: 400 });
  }

  const item = await prisma.employeeMonthlyRating.upsert({
    where: { employeeId_month: { employeeId: params.id, month } },
    create: { employeeId: params.id, month, bonusPercent, notes: body.notes || null, decidedById: user.id },
    update: { bonusPercent, notes: body.notes || null, decidedById: user.id, decidedAt: new Date() },
  });

  return NextResponse.json({ item }, { status: 201 });
}
