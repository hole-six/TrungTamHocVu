import { NextRequest, NextResponse } from "next/server";
import { getUserRole } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/current-user";
import { applyClassDefaultAssignmentsToExistingSessions } from "@/lib/server/class-default-assignments";
import { canUpdate } from "@/lib/server/role-matrix";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền cập nhật nhân sự mặc định của lớp" }, { status: 403 });
  }

  const result = await applyClassDefaultAssignmentsToExistingSessions(params.id);
  return NextResponse.json(result);
}
