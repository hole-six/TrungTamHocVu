import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/auth";

// Đây KHÔNG phải đăng ký tự do — hệ thống này là ERP nội bộ một tổ chức,
// không phải SaaS đa tenant. Endpoint này chỉ tồn tại để tạo tài khoản
// Super Admin ĐẦU TIÊN khi triển khai trên CSDL trống (chưa có ai). Ngay
// sau khi có ít nhất 1 user, endpoint tự khoá vĩnh viễn — từ đó về sau
// mọi tài khoản mới phải do Super Admin tạo tại /admin/users/new.
export async function POST(req: NextRequest) {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "Hệ thống đã được khởi tạo. Vui lòng liên hệ quản trị viên để được cấp tài khoản." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "Thiếu email, mật khẩu hoặc họ tên." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
  }

  const superAdminRole = await prisma.role.findUnique({ where: { code: "SUPER_ADMIN" } });

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: hashPassword(password),
      role: "admin",
      roleId: superAdminRole?.id ?? null,
    },
  });

  await setSessionCookie({ userId: user.id, role: "admin", fullName: user.fullName });

  return NextResponse.json({ ok: true });
}
