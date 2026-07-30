import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { MODULE_LABEL, type ModuleKey, type AccessLevel } from "@/lib/server/role-matrix";

const MODULE_KEYS = Object.keys(MODULE_LABEL) as ModuleKey[];
const ACCESS_LEVELS: AccessLevel[] = ["NONE", "VIEW_LIMITED", "VIEW", "CREATE_VIEW", "UPDATE_VIEW", "APPROVE_VIEW", "FULL"];

// Cấp/thu hồi quyền bổ sung theo module cho MỘT người dùng cụ thể — cách Giám đốc
// "add thêm chức năng riêng" cho 1 nhân viên (vd Quản lý cơ sở) mà không cần tạo
// role mới. level=null nghĩa là xoá override, quay về đúng quyền mặc định của Role.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Chỉ quản trị viên mới được cấp quyền bổ sung" }, { status: 403 });
  }

  // Không cho tự cấp quyền cho chính mình — cùng lý do với việc chặn tự đổi vai trò
  // ở app/api/users/[id]/route.ts (tránh tự thao túng quyền của chính mình âm thầm).
  if (params.id === user.id) {
    return NextResponse.json({ error: "Không thể tự cấp quyền bổ sung cho chính mình" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const module = body?.module as ModuleKey | undefined;
  const level = body?.level === null ? null : (body?.level as AccessLevel | undefined);
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (!module || !MODULE_KEYS.includes(module)) {
    return NextResponse.json({ error: "Module không hợp lệ" }, { status: 400 });
  }
  if (level !== null && (!level || !ACCESS_LEVELS.includes(level))) {
    return NextResponse.json({ error: "Mức quyền không hợp lệ" }, { status: 400 });
  }

  if (level !== null) {
    await prisma.userModuleOverride.upsert({
      where: { userId_module: { userId: params.id, module } },
      create: { userId: params.id, module, level, reason, grantedById: user.id },
      update: { level, reason, grantedById: user.id },
    });
  } else {
    await prisma.userModuleOverride.deleteMany({ where: { userId: params.id, module } });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: target.branchId,
      action: level !== null ? "user.moduleOverride.grant" : "user.moduleOverride.revoke",
      entityType: "User",
      entityId: target.id,
      after: JSON.stringify({ module, level, reason }),
    },
  });

  return NextResponse.json({ ok: true });
}
