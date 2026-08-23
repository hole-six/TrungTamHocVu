import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";

async function canCheckRequirement(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return canUpdate("schedule", role) || role === "TEACHER" || role === "TEACHING_ASSISTANT";
}

// Xác nhận "việc giáo viên cần làm" của 1 buổi cụ thể (yêu cầu lấy từ
// ClassRoadmapItem.teacherRequirement) — chỉ cho phép sau khi buổi đã điểm danh xong
// (COMPLETED). Người xác nhận PHẢI được chọn từ danh sách SessionAssignment của đúng
// buổi này (không cố định 1 role — 1 buổi có thể có ≥2 trợ giảng). Nếu Chưa nộp, tạo
// kèm 1 AssistantScoreEvent (DEDUCT 1 điểm) đúng người được chọn.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await canCheckRequirement(user.id))) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xác nhận việc giáo viên cần làm" }, { status: 403 });
  }

  const session = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: {
      class: {
        include: {
          branch: true,
          roadmapItems: { orderBy: { sessionNumber: "asc" } },
          sessions: { where: { status: { not: "CANCELLED" } }, orderBy: { sessionDate: "asc" }, select: { id: true } },
        },
      },
      assignments: true,
      requirementCheck: true,
    },
  });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });
  if (session.status !== "COMPLETED") {
    return NextResponse.json({ error: "Buổi học chưa điểm danh xong, chưa thể xác nhận việc giáo viên cần làm." }, { status: 409 });
  }
  if (session.requirementCheck) {
    return NextResponse.json({ error: "Buổi này đã được xác nhận rồi." }, { status: 409 });
  }

  const sessionNumber = session.class.sessions.findIndex((item) => item.id === session.id) + 1;
  const roadmapItem = session.class.roadmapItems.find((item) => item.sessionNumber === sessionNumber) ?? null;
  const requirementText = roadmapItem?.teacherRequirement?.trim() || "";
  if (!requirementText) {
    return NextResponse.json({ error: "Buổi này không có yêu cầu giáo viên nào cần xác nhận." }, { status: 400 });
  }

  const body = await req.json();
  const employeeId = String(body.employeeId ?? "").trim();
  const status = String(body.status ?? "").trim();
  const deductPoints = Boolean(body.deductPoints); // Tùy chọn trừ điểm
  
  if (!["SUBMITTED", "NOT_SUBMITTED"].includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
  }
  if (!session.assignments.some((assignment) => assignment.employeeId === employeeId)) {
    return NextResponse.json({ error: "Người phụ trách phải là giáo viên/trợ giảng đã được gán cho đúng buổi này." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    let scoreEventId: string | null = null;
    // Chỉ trừ điểm nếu: Chưa nộp VÀ người dùng chọn trừ điểm
    if (status === "NOT_SUBMITTED" && deductPoints) {
      const scoreEvent = await tx.assistantScoreEvent.create({
        data: {
          employeeId,
          branchId: session.class.branchId,
          eventDate: session.sessionDate,
          type: "DEDUCT",
          points: 1,
          reason: `Chưa hoàn thành yêu cầu buổi ${session.sessionDate.toLocaleDateString("vi-VN")} (${session.class.className}): ${requirementText}`,
          createdById: user.id,
        },
      });
      scoreEventId = scoreEvent.id;
    }

    return tx.sessionRequirementCheck.create({
      data: {
        sessionId: session.id,
        requirementText,
        employeeId,
        status,
        scoreEventId,
        checkedById: user.id,
      },
    });
  });

  return NextResponse.json({ item: result });
}
