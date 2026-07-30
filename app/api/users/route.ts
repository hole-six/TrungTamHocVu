import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hashPassword } from "@/lib/password";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Chỉ quản trị viên mới xem được" }, { status: 403 });

  const items = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      branchId: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      branch: true,
    },
  });

  return NextResponse.json({ items });
}

// Tạo tài khoản mới — chỉ Super Admin, thay cho /register công khai đã khoá
// sau khi hệ thống có tài khoản đầu tiên.
export async function POST(req: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được tạo tài khoản" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const roleId = typeof body?.roleId === "string" && body.roleId ? body.roleId : null;
  const branchId = typeof body?.branchId === "string" && body.branchId ? body.branchId : null;

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "Thiếu email, mật khẩu hoặc họ tên." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email đã được sử dụng." }, { status: 409 });
  }

  let roleCode: string | null = null;
  if (roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return NextResponse.json({ error: "Không tìm thấy vai trò" }, { status: 400 });
    roleCode = role.code;
  }

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: hashPassword(password),
      role: roleCode === "SUPER_ADMIN" ? "admin" : "user",
      roleId,
      branchId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      branchId: branchId,
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      after: JSON.stringify({ email, fullName, roleId, branchId }),
    },
  });

  return NextResponse.json({ item: { id: user.id, email: user.email, fullName: user.fullName } }, { status: 201 });
}
