import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const items = await prisma.course.findMany({
    where: user.branchId ? { branchId: user.branchId } : {},
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });

  const body = await req.json();
  const code = String(body.code ?? "").trim();
  const name = String(body.name ?? "").trim();
  const tuitionPerSession = Number(body.tuitionPerSession);
  const sessionsPerWeek = Number(body.sessionsPerWeek);

  if (!code || !name) return NextResponse.json({ error: "Thiếu mã hoặc tên khóa học" }, { status: 400 });
  if (!Number.isFinite(tuitionPerSession) || tuitionPerSession < 0) {
    return NextResponse.json({ error: "Học phí/buổi không hợp lệ" }, { status: 400 });
  }
  if (!Number.isFinite(sessionsPerWeek) || sessionsPerWeek <= 0) {
    return NextResponse.json({ error: "Số buổi/tuần không hợp lệ" }, { status: 400 });
  }

  const existing = await prisma.course.findUnique({ where: { branchId_code: { branchId: user.branchId, code } } });
  if (existing) return NextResponse.json({ error: "Mã khóa học đã tồn tại" }, { status: 409 });

  const course = await prisma.course.create({
    data: { branchId: user.branchId, code, name, tuitionPerSession, sessionsPerWeek },
  });

  return NextResponse.json({ item: course }, { status: 201 });
}
