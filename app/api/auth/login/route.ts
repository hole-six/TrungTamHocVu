import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Thiếu email hoặc mật khẩu." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
  }
  // Tài khoản đã bị khóa (vd thu hồi quyền cổng phụ huynh, hoặc khóa nhân viên nghỉ
  // việc) — chặn ngay tại đây, nếu không thì việc "khóa tài khoản" ở nơi khác chỉ
  // mang tính hình thức vì mật khẩu cũ vẫn đăng nhập được bình thường.
  if (!user.isActive) {
    return NextResponse.json({ error: "Tài khoản đã bị khóa. Liên hệ quản trị viên để được hỗ trợ." }, { status: 403 });
  }

  await setSessionCookie({
    userId: user.id,
    role: user.role as "admin" | "user",
    fullName: user.fullName,
    guardianId: user.guardianId ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
