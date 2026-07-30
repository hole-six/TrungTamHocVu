import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const items = await prisma.employee.findMany({
    where: user.branchId ? { branchId: user.branchId } : {},
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });
  const role = await getUserRole(user.id);
  if (!canCreate("hr", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo hồ sơ nhân viên" }, { status: 403 });
  }

  const body = await req.json();
  const fullName = String(body.fullName ?? "").trim();
  const shortName = String(body.shortName ?? "").trim();
  if (!fullName) return NextResponse.json({ error: "Thiếu họ tên" }, { status: 400 });
  if (!shortName) return NextResponse.json({ error: "Thiếu tên ngắn (dùng để phân công buổi dạy)" }, { status: 400 });

  const employeeCode = String(body.employeeCode ?? "").trim() || `NV${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const existing = await prisma.employee.findUnique({ where: { employeeCode } });
  if (existing) return NextResponse.json({ error: "Mã nhân viên đã tồn tại" }, { status: 409 });

  const employee = await prisma.employee.create({
    data: {
      branchId: user.branchId,
      employeeCode,
      fullName,
      shortName,
      position: body.position || null,
      phone: body.phone || null,
      email: body.email || null,
      teachingHourlyRate: body.teachingHourlyRate ? Number(body.teachingHourlyRate) : null,
      assistantHourlyRate: body.assistantHourlyRate ? Number(body.assistantHourlyRate) : null,
      payMode: body.payMode || "HOURLY",
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ item: employee }, { status: 201 });
}
