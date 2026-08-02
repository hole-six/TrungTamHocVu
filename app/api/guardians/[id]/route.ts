import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canDelete, canUpdate } from "@/lib/server/role-matrix";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const guardian = await prisma.guardian.findUnique({
    where: { id: params.id },
    include: {
      leads: { orderBy: { createdAt: "desc" } },
      students: { include: { student: true } },
    },
  });
  if (!guardian) return NextResponse.json({ error: "Không tìm thấy phụ huynh" }, { status: 404 });

  return NextResponse.json({ item: guardian });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa phụ huynh" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["fullName", "phone", "address", "notes"]) {
    if (field in body) data[field] = body[field] || null;
  }

  const guardian = await prisma.guardian.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: guardian });
}

// Chỉ cho xóa phụ huynh khi không còn liên kết gì (không lead, không học viên, không
// portal) — phụ huynh còn đang gắn với dữ liệu thật thì phải gỡ liên kết trước, tránh
// xóa nhầm làm mất dấu vết của lead/học viên đang hoạt động.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canDelete("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa phụ huynh" }, { status: 403 });
  }

  const guardian = await prisma.guardian.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      _count: { select: { leads: true, students: true } },
    },
  });
  if (!guardian) return NextResponse.json({ error: "Không tìm thấy phụ huynh" }, { status: 404 });

  if (guardian._count.leads > 0 || guardian._count.students > 0) {
    return NextResponse.json(
      { error: "Phụ huynh này còn liên kết với lead/học viên, cần gỡ liên kết trước khi xóa." },
      { status: 409 },
    );
  }
  if (guardian.user) {
    return NextResponse.json(
      { error: "Phụ huynh này còn tài khoản portal, cần thu hồi/xóa tài khoản trước khi xóa." },
      { status: 409 },
    );
  }

  await prisma.guardian.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
