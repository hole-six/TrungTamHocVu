import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getBranchWhereClause } from "@/lib/branch-filter";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";

// Những lớp có SẴN lộ trình đã soạn, để lớp mới sao chép lại thay vì gõ lại từ đầu.
//
// Thực tế trung tâm mở lớp theo khóa: FF1-A2 dạy đúng giáo án của FF1-A1, khóa sau dạy
// đúng giáo án khóa trước. Soạn 48 buổi (tên bài, mục tiêu, tài liệu, bài tập) cho mỗi
// lớp mới là việc lặp lại vô ích — nên cho chọn một lớp cũ rồi chép nguyên lộ trình.
//
// Lấy CẢ lớp đã kết thúc: khóa trước học xong rồi chính là nguồn giáo án tốt nhất.
// Chỉ liệt kê lớp thật sự CÓ nội dung (không tính khung rỗng "Buổi 1, Buổi 2..." do hệ
// thống tự sinh), lớp cùng khóa học xếp lên đầu.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canView("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền xem lớp học" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId") || null;
  const branchWhere = await getBranchWhereClause(searchParams.get("branchId"));

  const classes = await prisma.class.findMany({
    where: { ...branchWhere, isRemedial: false, roadmapItems: { some: {} } },
    select: {
      id: true,
      classCode: true,
      className: true,
      status: true,
      courseId: true,
      startDate: true,
      course: { select: { name: true } },
      roadmapItems: {
        select: {
          sessionNumber: true,
          title: true,
          objective: true,
          materials: true,
          teacherGuide: true,
          homeworkGuide: true,
          teacherRequirement: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  const items = classes
    .map((cls) => {
      const authoredCount = cls.roadmapItems.filter((item) => {
        const hasCustomTitle = item.title.trim() !== "" && item.title.trim() !== `Buổi ${item.sessionNumber}`;
        return (
          hasCustomTitle ||
          Boolean(item.objective?.trim()) ||
          Boolean(item.materials?.trim()) ||
          Boolean(item.teacherGuide?.trim()) ||
          Boolean(item.homeworkGuide?.trim()) ||
          Boolean(item.teacherRequirement?.trim())
        );
      }).length;
      return {
        id: cls.id,
        classCode: cls.classCode,
        className: cls.className,
        courseName: cls.course?.name ?? null,
        status: cls.status,
        sameCourse: Boolean(courseId && cls.courseId === courseId),
        sessionCount: cls.roadmapItems.length,
        authoredCount,
      };
    })
    .filter((item) => item.authoredCount > 0)
    // Cùng khóa lên đầu, rồi lớp soạn được nhiều buổi nhất — đó là nguồn đáng chép nhất.
    .sort(
      (left, right) =>
        Number(right.sameCourse) - Number(left.sameCourse) || right.authoredCount - left.authoredCount,
    );

  return NextResponse.json({ items });
}
