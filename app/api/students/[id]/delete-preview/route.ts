import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canAccessBranch } from "@/lib/branch-filter";
import { buildStudentDeletePreview } from "@/lib/server/student-hard-delete";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role } = await getUserRoleAndOverride(user.id, "students");
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Chỉ SUPER_ADMIN được xem/xóa hẳn học viên." }, { status: 403 });
  }

  const preview = await buildStudentDeletePreview(prisma, params.id);
  if (!preview) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (!(await canAccessBranch(preview.student.branchId))) {
    return NextResponse.json({ error: "Không có quyền truy cập cơ sở" }, { status: 403 });
  }

  return NextResponse.json({ item: preview });
}
