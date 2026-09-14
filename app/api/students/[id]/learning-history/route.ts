import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { getStudentLearningHistory } from "@/lib/server/learning-history";

// Lịch sử học tập + điểm nhật ký của học viên, phân trang 10 buổi. Cách tính điểm xem
// lib/server/learning-history.ts.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canView("students", role)) {
    return NextResponse.json({ error: "Bạn không có quyền xem học viên" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({ where: { id: params.id }, select: { id: true, branchId: true } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (!(await canAccessBranch(student.branchId))) {
    return NextResponse.json({ error: "Học viên không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const page = Number(req.nextUrl.searchParams.get("page")) || 1;
  const history = await getStudentLearningHistory(prisma, student.id, { page, pageSize: 10 });
  return NextResponse.json(history);
}
