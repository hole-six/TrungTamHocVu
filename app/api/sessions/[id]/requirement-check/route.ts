import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { computeSessionTiming, getVietnamToday } from "@/lib/server/class-rules";

async function canCheckRequirement(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return canUpdate("schedule", role) || role === "TEACHER" || role === "TEACHING_ASSISTANT";
}

// Xác nhận "việc giáo viên cần làm" của 1 buổi cụ thể (yêu cầu lấy từ
// ClassRoadmapItem.teacherRequirement) — hiện/ghi được ngay khi buổi đã bắt đầu, không
// cần chờ điểm danh xong. Người xác nhận PHẢI được chọn từ danh sách SessionAssignment
// của đúng buổi này (không cố định 1 role — 1 buổi có thể có ≥2 trợ giảng).
//
// CHỈ ghi/sửa được trong ĐÚNG ngày diễn ra buổi học (upsert theo TA) — qua ngày hôm
// sau, route này khóa hẳn, chỉ còn PATCH (admin, xem bên dưới) sửa được `status`.
// Quyết định trừ điểm KHÔNG còn nằm ở route này — xem PATCH.
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

  const timing = computeSessionTiming(session.sessionDate, getVietnamToday());
  if (timing === "upcoming") {
    return NextResponse.json({ error: "Buổi học chưa diễn ra, chưa thể xác nhận việc giáo viên cần làm." }, { status: 409 });
  }
  if (timing !== "today") {
    return NextResponse.json({ error: "Chỉ có thể ghi hoặc sửa xác nhận này trong đúng ngày diễn ra buổi học." }, { status: 409 });
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
  const reason = status === "NOT_SUBMITTED" ? String(body.reason ?? "").trim() : "";

  if (!["SUBMITTED", "NOT_SUBMITTED"].includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
  }
  if (status === "NOT_SUBMITTED" && !reason) {
    return NextResponse.json({ error: "Vui lòng nhập lý do chưa nộp." }, { status: 400 });
  }
  if (!session.assignments.some((assignment) => assignment.employeeId === employeeId)) {
    return NextResponse.json({ error: "Người phụ trách phải là giáo viên/trợ giảng đã được gán cho đúng buổi này." }, { status: 400 });
  }

  // Upsert trong đúng ngày: chưa có thì tạo mới; đã có (TA tự sửa lại trong ngày) thì
  // cập nhật cả initialStatus lẫn status — coi cả ngày là 1 "phiên" khai báo của TA.
  // KHÔNG đụng scoreDecision/scoreEventId ở đây — đó là việc riêng của admin (PATCH).
  const result = session.requirementCheck
    ? await prisma.sessionRequirementCheck.update({
        where: { id: session.requirementCheck.id },
        data: { employeeId, initialStatus: status, status, reason: reason || null, checkedById: user.id, checkedAt: new Date() },
      })
    : await prisma.sessionRequirementCheck.create({
        data: {
          sessionId: session.id,
          requirementText,
          employeeId,
          initialStatus: status,
          status,
          reason: reason || null,
          checkedById: user.id,
        },
      });

  return NextResponse.json({ item: result });
}

// Admin sửa trạng thái HIỆN TẠI (vd TA nộp bổ sung sau ngày hôm đó → chuyển Chưa nộp
// thành Đã nộp) và/hoặc quyết định trừ điểm — tách hẳn khỏi việc TA tự khai ở POST,
// không giới hạn theo ngày buổi học. `initialStatus` không bao giờ bị sửa ở đây — đó
// là dấu vết duy nhất để biết một lượt "Đã nộp" là nộp đúng hạn hay nộp muộn.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("hr", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền quyết định việc này." }, { status: 403 });
  }

  const existing = await prisma.sessionRequirementCheck.findUnique({
    where: { sessionId: params.id },
    include: { session: { include: { class: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Buổi này chưa có xác nhận nào để sửa." }, { status: 404 });

  const body = await req.json();
  const nextStatus = body.status !== undefined ? String(body.status).trim() : null;
  const nextDecision = body.scoreDecision !== undefined ? String(body.scoreDecision).trim() : null;

  if (nextStatus !== null && !["SUBMITTED", "NOT_SUBMITTED"].includes(nextStatus)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
  }
  if (nextDecision !== null && !["PENDING", "DEDUCTED", "WAIVED"].includes(nextDecision)) {
    return NextResponse.json({ error: "Quyết định điểm không hợp lệ." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    let scoreEventId = existing.scoreEventId;

    if (nextDecision !== null && nextDecision !== existing.scoreDecision) {
      if (nextDecision === "DEDUCTED" && !scoreEventId) {
        const scoreEvent = await tx.assistantScoreEvent.create({
          data: {
            employeeId: existing.employeeId,
            branchId: existing.session.class.branchId,
            eventDate: existing.session.sessionDate,
            type: "DEDUCT",
            points: 1,
            reason: `Chưa hoàn thành yêu cầu buổi ${existing.session.sessionDate.toLocaleDateString("vi-VN")} (${existing.session.class.className}): ${existing.requirementText}`,
            createdById: user.id,
          },
        });
        scoreEventId = scoreEvent.id;
      } else if (nextDecision !== "DEDUCTED" && scoreEventId) {
        const oldScoreEventId = scoreEventId;
        scoreEventId = null;
        await tx.sessionRequirementCheck.update({ where: { id: existing.id }, data: { scoreEventId: null } });
        await tx.assistantScoreEvent.delete({ where: { id: oldScoreEventId } });
      }
    }

    return tx.sessionRequirementCheck.update({
      where: { id: existing.id },
      data: {
        ...(nextStatus !== null ? { status: nextStatus } : {}),
        ...(nextDecision !== null ? { scoreDecision: nextDecision, decidedById: user.id, decidedAt: new Date() } : {}),
        scoreEventId,
      },
    });
  });

  return NextResponse.json({ item: result });
}
