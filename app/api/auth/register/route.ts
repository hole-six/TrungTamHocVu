import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email đã được sử dụng." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { email, fullName, passwordHash: hashPassword(password), role: "user" },
  });

  await setSessionCookie({ userId: user.id, role: user.role as "admin" | "user", fullName: user.fullName });

  return NextResponse.json({ ok: true });
}
