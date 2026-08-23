import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { getBranchWhereClause } from "@/lib/branch-filter";
import { getVietnamToday } from "@/lib/server/class-rules";

// Danh sách lớp bổ trợ đang mở kèm các buổi TƯƠNG LAI của từng lớp — dùng cho bảng
// "Bảng xử lý bổ trợ" (/session-credits) để CSO gán hàng loạt nhiều học viên vào 1
// buổi cụ thể mà không phải mở từng lớp bổ trợ một để xem lịch của nó.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xếp lớp bổ trợ" }, { status: 403 });
  }

  const branchWhere = await getBranchWhereClause(null);
  const today = getVietnamToday();

  const classes = await prisma.class.findMany({
    where: { ...branchWhere, isRemedial: true, status: "ACTIVE" },
    include: {
      sessions: {
        where: { sessionDate: { gte: today }, status: { notIn: ["CANCELLED", "COMPLETED"] } },
        orderBy: { sessionDate: "asc" },
        take: 20,
      },
    },
    orderBy: { className: "asc" },
  });

  const items = classes.map((cls) => ({
    id: cls.id,
    classCode: cls.classCode,
    className: cls.className,
    futureSessions: cls.sessions.map((session) => ({
      id: session.id,
      sessionDate: session.sessionDate.toISOString(),
      startTime: session.startTime,
      endTime: session.endTime,
    })),
  }));

  return NextResponse.json({ items });
}
