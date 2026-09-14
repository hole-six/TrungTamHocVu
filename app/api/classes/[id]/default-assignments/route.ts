import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserRole } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/current-user";
import { canUpdate } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import {
  normalizeDefaultStaffInput,
  planDefaultStaffSync,
  saveDefaultStaff,
} from "@/lib/server/class-default-assignments";

// Lưu nhân sự mặc định của lớp theo 2 bước:
//   1. gửi không có confirm → nếu có buổi chưa dạy bị đổi người thì trả về KẾ HOẠCH (đổi
//      ai sang ai, bao nhiêu buổi) để người dùng xem trước, chưa ghi gì;
//   2. gửi lại với confirm: true → lưu và đổi người ở các buổi chưa dạy trong 1 giao dịch.
// Trùng lịch hoặc người đã nghỉ việc → 409, không lưu gì.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền đổi nhân sự của lớp" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({ where: { id: params.id }, select: { id: true, branchId: true } });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if (!(await canAccessBranch(cls.branchId))) {
    return NextResponse.json({ error: "Không có quyền truy cập cơ sở của lớp này" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { items, error } = normalizeDefaultStaffInput(body.defaultAssignments);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const preview = await planDefaultStaffSync(prisma, cls.id, items);
  const publicPlan = { changes: preview.changes, affectedSessions: preview.affectedSessions, errors: preview.errors };
  if (preview.errors.length) {
    return NextResponse.json({ error: preview.errors.join(" "), plan: publicPlan }, { status: 409 });
  }
  if (!body.confirm && preview.affectedSessions > 0) {
    return NextResponse.json({ needsConfirm: true, plan: publicPlan });
  }

  // Tính lại trong giao dịch: giữa lúc xem trước và lúc xác nhận có thể đã có người khác
  // xếp lịch làm phát sinh trùng.
  const result = await prisma.$transaction((tx) => saveDefaultStaff(tx, cls.id, items));
  if (!result.ok) {
    return NextResponse.json({ error: result.plan.errors.join(" "), plan: result.plan }, { status: 409 });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: cls.branchId,
      action: "update_default_staff",
      entityType: "Class",
      entityId: cls.id,
      after: JSON.stringify({ defaults: items, changes: result.plan.changes }),
    },
  });

  return NextResponse.json({
    ok: true,
    plan: { changes: result.plan.changes, affectedSessions: result.plan.affectedSessions, errors: [] },
  });
}
