import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hashPassword } from "@/lib/password";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được sửa" }, { status: 403 });
  }

  const target = params.id === user.id ? user : await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if ("email" in (body ?? {})) {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return NextResponse.json({ error: "Email không được để trống." }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== params.id) {
      return NextResponse.json({ error: "Email đã được sử dụng." }, { status: 409 });
    }

    data.email = email;
  }

  if ("fullName" in (body ?? {})) {
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
    if (!fullName) return NextResponse.json({ error: "Họ và tên không được để trống." }, { status: 400 });
    data.fullName = fullName;
  }

  if ("roleId" in (body ?? {})) {
    if (params.id === user.id && (body?.roleId || null) !== (user.roleId || null)) {
      return NextResponse.json(
        { error: "Không thể tự đổi vai trò của chính mình — nhờ một Super Admin khác thực hiện." },
        { status: 400 },
      );
    }

    const role = body?.roleId ? await prisma.role.findUnique({ where: { id: body.roleId } }) : null;
    if (body?.roleId && !role) {
      return NextResponse.json({ error: "Không tìm thấy vai trò" }, { status: 400 });
    }

    data.roleId = body?.roleId || null;
    data.role = role?.code === "SUPER_ADMIN" ? "admin" : "user";
  }

  if ("branchId" in (body ?? {})) {
    data.branchId = body?.branchId || null;
  }

  if ("password" in (body ?? {}) && body?.password) {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
    }
    data.passwordHash = hashPassword(password);
  }

  if ("isActive" in (body ?? {})) {
    if (params.id === user.id && body?.isActive === false) {
      return NextResponse.json({ error: "Không thể tự khóa tài khoản của chính mình" }, { status: 400 });
    }
    data.isActive = !!body?.isActive;
  }

  const updated = await prisma.user.update({ where: { id: params.id }, data });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: target.branchId,
      action: "user.update",
      entityType: "User",
      entityId: target.id,
      before: JSON.stringify({
        email: target.email,
        fullName: target.fullName,
        roleId: target.roleId,
        branchId: target.branchId,
        isActive: target.isActive,
      }),
      after: JSON.stringify({
        email: updated.email,
        fullName: updated.fullName,
        roleId: updated.roleId,
        branchId: updated.branchId,
        isActive: updated.isActive,
      }),
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được xóa người dùng" }, { status: 403 });
  }

  if (params.id === actor.id) {
    return NextResponse.json({ error: "Không thể tự xóa tài khoản của chính mình." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { moduleOverrides: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy người dùng." }, { status: 404 });
  }

  if (target.employeeId) {
    return NextResponse.json({ error: "Người dùng này đang gắn với hồ sơ nhân sự, không thể xóa." }, { status: 400 });
  }
  if (target.guardianId) {
    return NextResponse.json({ error: "Người dùng này đang gắn với portal phụ huynh, không thể xóa." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.updateMany({
      where: { userId: target.id },
      data: { userId: null },
    });

    if (target.moduleOverrides.length > 0) {
      await tx.userModuleOverride.deleteMany({ where: { userId: target.id } });
    }

    await tx.user.delete({ where: { id: target.id } });

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        branchId: target.branchId,
        action: "user.delete",
        entityType: "User",
        entityId: target.id,
        before: JSON.stringify({
          email: target.email,
          fullName: target.fullName,
          roleId: target.roleId,
          branchId: target.branchId,
          isActive: target.isActive,
        }),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
