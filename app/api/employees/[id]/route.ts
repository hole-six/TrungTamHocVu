import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      sessionAssignments: { include: { session: { include: { class: true } } }, orderBy: { id: "desc" }, take: 20 },
      timesheetEntries: { orderBy: { workDate: "desc" }, take: 30 },
    },
  });
  if (!employee) return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });

  return NextResponse.json({ item: employee });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["fullName", "shortName", "position", "phone", "email", "workStatus", "payMode", "notes"]) {
    if (field in body) data[field] = body[field] || null;
  }
  for (const field of ["teachingHourlyRate", "assistantHourlyRate"]) {
    if (field in body) data[field] = body[field] === "" || body[field] === null ? null : Number(body[field]);
  }

  const employee = await prisma.employee.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: employee });
}
