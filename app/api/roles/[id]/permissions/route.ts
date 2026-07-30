import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

// Bật/tắt một permission cho một role — chỉ Super Admin. Riêng role SUPER_ADMIN
// không cho sửa qua đây: role đó bỏ qua toàn bộ hasPermission() nhờ cờ
// role="admin" nên bật/tắt RolePermission không có tác dụng thật, chỉ gây hiểu
// nhầm là đã giới hạn được quyền của Super Admin trong khi thực ra chưa.
// Lưu ý: MỌI role đều có isSystem=true (đánh dấu "role dựng sẵn, không xoá được"),
// không phải chỉ SUPER_ADMIN — nên phải so sánh đúng "code" thay vì dùng isSystem.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được sửa quyền" }, { status: 403 });
  }

  const role = await prisma.role.findUnique({ where: { id: params.id } });
  if (!role) return NextResponse.json({ error: "Không tìm thấy vai trò" }, { status: 404 });
  if (role.code === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Không thể sửa quyền của Super Admin (luôn có toàn quyền hệ thống)" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const permissionId = typeof body?.permissionId === "string" ? body.permissionId : "";
  const granted = !!body?.granted;
  if (!permissionId) return NextResponse.json({ error: "Thiếu permissionId" }, { status: 400 });

  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) return NextResponse.json({ error: "Không tìm thấy permission" }, { status: 404 });

  if (granted) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId } },
      create: { roleId: role.id, permissionId },
      update: {},
    });
  } else {
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId } });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: granted ? "role.permission.grant" : "role.permission.revoke",
      entityType: "Role",
      entityId: role.id,
      after: JSON.stringify({ permissionKey: permission.key }),
    },
  });

  return NextResponse.json({ ok: true });
}
