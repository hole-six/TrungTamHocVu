import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasPermission } from "@/lib/server/permissions";

// %Thưởng nhập tay bởi HR/Kế toán sau khi xem tỉ lệ A tính được — không tự động suy ra
// (xem lib/server/assistant-score-rules.ts).
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
  if (!month) return NextResponse.json({ error: "Thiếu tháng (vd 2026-06)" }, { status: 400 });
  if (!Number.isFinite(bonusPercent)) return NextResponse.json({ error: "Mức thưởng không hợp lệ" }, { status: 400 });

  const item = await prisma.assistantMonthlyBonus.upsert({
    where: { employeeId_month: { employeeId: params.id, month } },
    create: { employeeId: params.id, month, bonusPercent, notes: body.notes || null, decidedById: user.id },
    update: { bonusPercent, notes: body.notes || null, decidedById: user.id, decidedAt: new Date() },
  });

  return NextResponse.json({ item }, { status: 201 });
}
