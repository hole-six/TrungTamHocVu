import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canTransitionEnrollment } from "@/lib/server/class-rules";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { computeEnrollmentSessionProgress } from "@/lib/server/class-generation";
import { grantRemainingSessionCredits } from "@/lib/server/session-credits";
import { ensureBillingPeriod, generateChargesForPeriod } from "@/lib/server/billing-generation";
import { canEditCharges, monthRange } from "@/lib/server/tuition-rules";
import { getVietnamToday } from "@/lib/server/class-rules";

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
    if (existing.billingModel !== "PERIOD") {
      // COURSE/INSTALLMENT: tiền trọn khóa đã cam kết thu đủ ngay từ đầu (dù trả góp mấy
      // đợt) — buổi CHƯA DIỄN RA của cả khóa (bất kể lý do) là đúng cơ sở để bù, không
      // phụ thuộc charge đã lập hay chưa.
      const progress = await computeEnrollmentSessionProgress(existing.classId, existing.enrollDate);
      withdrawalRemaining = progress.remaining ?? 0;
    } else {
      // PERIOD: học phí đóng TRỌN cả tháng ngay từ đầu tháng (xác nhận với người dùng),
      // không phải đóng dần theo từng buổi đã học — nên buổi nào trong THÁNG ĐANG ĐÓNG mà
      // CHƯA DIỄN RA lúc rút lớp vẫn phải được cộng bổ trợ, y hệt buổi bị vắng. Các tháng
      // SAU (chưa tới, chưa đóng) thì không cộng gì — chỉ tính trong phạm vi tháng đang
      // đóng. Buổi vắng trong tháng này đã được cộng bổ trợ riêng lẻ ngay lúc điểm danh
      // rồi (xem attendance/route.ts) — công thức dưới đây tự động không cộng trùng vì chỉ
      // đếm buổi CHƯA DIỄN RA (không đếm buổi đã vắng, buổi đã vắng đã COMPLETED rồi).
      const cls = await prisma.class.findUnique({ where: { id: existing.classId }, select: { branchId: true } });
      if (cls) {
        const today = getVietnamToday();
        const currentPeriodName = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
        const { start, end } = monthRange(currentPeriodName);
        const rangeStart = existing.enrollDate > start ? existing.enrollDate : start;

        const [normalSessions, rescheduledOutOfRange, periodCompleted] = await Promise.all([
          // Buổi bình thường + buổi ĐÃ dời lịch vào ĐÚNG khoảng tháng này (buổi thay thế
          // của 1 lần đổi lịch từ tháng khác dời vào) — không đếm buổi gốc đã RESCHEDULED
          // để khỏi đếm trùng với chính buổi thay thế của nó.
          prisma.classSession.count({
            where: { classId: existing.classId, status: { notIn: ["CANCELLED", "RESCHEDULED"] }, sessionDate: { gte: rangeStart, lte: end } },
          }),
          // Buổi gốc rơi trong tháng này nhưng đã bị ĐỔI LỊCH sang ngày khác — nếu buổi
          // thay thế cũng rơi trong CHÍNH tháng này thì đã được đếm ở trên rồi (bỏ qua,
          // tránh đếm trùng); nếu buổi thay thế bị đẩy sang tháng khác (vd cận cuối tháng
          // dời qua đầu tháng sau) thì buổi gốc vẫn phải tính là 1 buổi thuộc tháng này —
          // không được để "biến mất" khỏi cả 2 tháng chỉ vì đổi lịch hành chính.
          prisma.classSession.findMany({
            where: { classId: existing.classId, status: "RESCHEDULED", sessionDate: { gte: rangeStart, lte: end } },
            include: { replacedBySession: { select: { sessionDate: true } } },
          }),
          prisma.classSession.count({
            where: { classId: existing.classId, status: "COMPLETED", sessionDate: { gte: rangeStart, lte: end } },
          }),
        ]);
        const pushedOutOfMonthCount = rescheduledOutOfRange.filter((s) => {
          const replacedDate = s.replacedBySession?.sessionDate;
          return !replacedDate || replacedDate < rangeStart || replacedDate > end;
        }).length;
        const periodTotal = normalSessions + pushedOutOfMonthCount;
        withdrawalRemaining = Math.max(0, periodTotal - periodCompleted);

        // Chốt phiếu học phí tháng hiện tại NGAY LÚC CÒN ACTIVE — nếu không, các buổi đã
        // học thật trong tháng (trước ngày rút) sẽ vĩnh viễn không được tính vào phiếu nào
        // nữa, vì generateChargesForPeriod chỉ xét enrollment đang ACTIVE (xem trước đó).
        const period = await ensureBillingPeriod(cls.branchId, currentPeriodName);
        if (canEditCharges(period.status)) {
          await generateChargesForPeriod(period.id);
        }
      }
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
