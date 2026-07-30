import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import { getBranchWhereClause } from "@/lib/branch-filter";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const items = await prisma.course.findMany({
    where: await getBranchWhereClause(searchParams.get("branchId")),
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });
  const role = await getUserRole(user.id);
  if (!canCreate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo khóa học" }, { status: 403 });
  }

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
