import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { provisionGuardianPortalAccount } from "@/lib/server/guardian-accounts";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canUpdate("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền cấp tài khoản phụ huynh" }, { status: 403 });
  }

  const guardian = await prisma.guardian.findUnique({ where: { id: params.id } });
  if (!guardian) return NextResponse.json({ error: "Không tìm thấy phụ huynh" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Thiếu email đăng nhập cho phụ huynh" }, { status: 400 });

  let provisioned;
  try {
    provisioned = await prisma.$transaction(async (tx) => provisionGuardianPortalAccount(tx, guardian.id, email));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể cấp tài khoản phụ huynh";
    const status = message.includes("tài khoản khác") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: provisioned.action,
      entityType: "Guardian",
      entityId: guardian.id,
      after: JSON.stringify({ email }),
    },
  });

  return NextResponse.json({
    item: { id: provisioned.account.id, email: provisioned.account.email },
    tempPassword: provisioned.tempPassword,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canUpdate("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền thu hồi tài khoản phụ huynh" }, { status: 403 });
  }

  const guardian = await prisma.guardian.findUnique({ where: { id: params.id }, include: { user: true } });
  if (!guardian?.user) return NextResponse.json({ error: "Phụ huynh chưa có tài khoản" }, { status: 404 });

  await prisma.user.update({ where: { id: guardian.user.id }, data: { isActive: false } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "guardian.account.revoke",
      entityType: "Guardian",
      entityId: guardian.id,
    },
  });

  return NextResponse.json({ ok: true });
}
