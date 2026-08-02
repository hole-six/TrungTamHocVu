import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canTransitionEnrollment } from "@/lib/server/class-rules";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { computeEnrollmentSessionProgress } from "@/lib/server/class-generation";
import { grantRemainingSessionCredits } from "@/lib/server/session-credits";

const WITHDRAWAL_CREDIT_REASON = "Buổi dư do rút lớp giữa khóa";

function canManageEnrollmentStatus(role: string | null) {
  return canUpdate("schedule", role) || role === "TEACHER" || role === "TEACHING_ASSISTANT";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  if (!canManageEnrollmentStatus(role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền thay đổi trạng thái ghi danh" }, { status: 403 });
  }

  const existing = await prisma.enrollment.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy ghi danh" }, { status: 404 });

  const body = await req.json();
  if (!body.status) return NextResponse.json({ error: "Thiếu trạng thái mới" }, { status: 400 });
  if (!canTransitionEnrollment(existing.status, body.status)) {
    return NextResponse.json(
      { error: `Không thể chuyển ghi danh từ "${existing.status}" sang "${body.status}"` },
      { status: 409 }
    );
  }

  let withdrawalRemaining = 0;
  if (body.status === "WITHDRAWN") {
    const courseCharge = await prisma.charge.findFirst({
      where: { studentId: existing.studentId, classId: existing.classId, billingModel: "COURSE" },
    });
    if (courseCharge) {
      const progress = await computeEnrollmentSessionProgress(existing.classId, existing.enrollDate);
      withdrawalRemaining = progress.remaining ?? 0;
    }
  }

  const { updated, sessionCredits } = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.update({
      where: { id: params.id },
      data: {
        status: body.status,
        endDate: ["COMPLETED", "WITHDRAWN", "TRANSFERRED"].includes(body.status) ? new Date() : existing.endDate,
      },
    });

    await tx.enrollmentStatusHistory.create({
      data: {
        studentId: existing.studentId,
        enrollmentId: existing.id,
        fromStatus: existing.status,
        toStatus: body.status,
        reason: body.reason || null,
        changedById: user.id,
      },
    });

    await syncStudentDerivedFields(existing.studentId, tx);

    const grantedCredits =
      withdrawalRemaining > 0
        ? await grantRemainingSessionCredits(
            tx,
            { id: enrollment.id, studentId: enrollment.studentId, classId: enrollment.classId },
            withdrawalRemaining,
            WITHDRAWAL_CREDIT_REASON
          )
        : null;

    return { updated: enrollment, sessionCredits: grantedCredits };
  });

  const syncedStudent = await syncStudentDerivedFields(existing.studentId);

  return NextResponse.json({
    item: updated,
    student: syncedStudent,
    sessionCreditsGranted: sessionCredits?.granted ?? undefined,
  });
}
