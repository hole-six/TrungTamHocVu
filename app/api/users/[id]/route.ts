import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Chỉ quản trị viên mới được sửa" }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("roleId" in body) {
    const role = body.roleId ? await prisma.role.findUnique({ where: { id: body.roleId } }) : null;
    if (body.roleId && !role) return NextResponse.json({ error: "Không tìm thấy vai trò" }, { status: 400 });
    data.roleId = body.roleId || null;
    // Đồng bộ cờ "admin"/"user" đơn giản dùng cho middleware cổng /admin — vai trò
    // chi tiết (ACCOUNTANT, STAFF...) vẫn là "user" ở tầng middleware, chỉ khác nhau
    // ở Permission mà API route tự kiểm tra qua hasPermission().
    // "SUPER_ADMIN" là mã role thật đang seed (không phải "ADMIN") — so sai chuỗi này
    // nghĩa là gán quyền Super Admin qua UI sẽ không set được cờ admin cho middleware,
    // khóa luôn người đó khỏi /admin dù roleId đã đúng.
    data.role = role?.code === "SUPER_ADMIN" ? "admin" : "user";
  }
  if ("branchId" in body) data.branchId = body.branchId || null;
  if ("isActive" in body) {
    if (params.id === user.id && body.isActive === false) {
      return NextResponse.json({ error: "Không thể tự khóa tài khoản của chính mình" }, { status: 400 });
    }
    data.isActive = !!body.isActive;
  }

  const updated = await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ item: updated });
}
