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
import { canEditCharges } from "@/lib/server/tuition-rules";
import { getVietnamToday } from "@/lib/server/class-rules";
import { getWalletBalance, markWalletRefunded } from "@/lib/server/enrollment-wallet";

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

  const isPeriod = existing.billingModel === "PERIOD";
  // "Đã hoàn tiền"/"Giữ lại" — chốt nghiệp vụ mục 3.10: KHÔNG tự động quyết, nhân
  // viên phải tự chọn khi rút lớp mà ví còn dư. Mặc định "KEEP" (an toàn — không tự
  // ý coi như đã hoàn tiền nếu frontend chưa hỏi).
  const walletDecision = body.walletDecision === "REFUND" ? "REFUND" : "KEEP";

  let withdrawalRemaining = 0;
  if (body.status === "WITHDRAWN" && !isPeriod) {
    // COURSE/INSTALLMENT: nếu có classId thì tính theo lịch lớp; nếu là gói tự do thì lấy tổng buổi trừ buổi đã dùng
    if (existing.classId) {
      const progress = await computeEnrollmentSessionProgress(existing.classId, existing.enrollDate);
      withdrawalRemaining = progress.remaining ?? 0;
    } else {
      withdrawalRemaining = Math.max(0, (existing.purchasedMainSessionCount ?? 0) - existing.usedSessionCount);
    }
  } else if (body.status === "WITHDRAWN" && isPeriod && existing.classId) {
    // PERIOD: KHÔNG tính "buổi dư trong tháng" theo lịch nữa — quyền học nằm trong Ví
    // buổi học (nạp/trừ liên tục qua nhiều tháng), không phải 1 con số suy ra từ lịch
    // tháng hiện tại. Chỉ cần chốt phiếu học phí tháng này NGAY LÚC CÒN ACTIVE trước
    // khi đổi trạng thái — nếu không, buổi đã học thật trong tháng (trước ngày rút)
    // sẽ vĩnh viễn không được tính vào phiếu nào (generateChargesForPeriod chỉ xét
    // enrollment đang ACTIVE).
    const cls = await prisma.class.findUnique({ where: { id: existing.classId }, select: { branchId: true } });
    if (cls) {
      const today = getVietnamToday();
      const currentPeriodName = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
      const period = await ensureBillingPeriod(cls.branchId, currentPeriodName);
      if (canEditCharges(period.status)) {
        await generateChargesForPeriod(period.id);
      }
    }
  }

  const { updated, sessionCredits, walletBalance, walletRefunded } = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.update({
      where: { id: params.id },
      data: {
        status: body.status,
        endDate: ["COMPLETED", "WITHDRAWN", "TRANSFERRED"].includes(body.status) ? new Date() : existing.endDate,
        // BẢO LƯU: ghi lại KHOẢNG nghỉ, không chỉ đổi trạng thái. Bắt đầu nghỉ thì mở
        // một khoảng mới (chưa có ngày kết thúc); đi học lại thì đóng khoảng đó lại.
        // Nhờ vậy danh sách điểm danh của các buổi đã diễn ra trong kỳ nghỉ vẫn đúng
        // mãi về sau — xem lib/server/class-roster.ts.
        ...(body.status === "PAUSED"
          ? { pausedFrom: body.pausedFrom ? new Date(body.pausedFrom) : new Date(), pausedTo: null }
          : {}),
        ...(existing.status === "PAUSED" && body.status === "ACTIVE"
          ? { pausedTo: body.pausedTo ? new Date(body.pausedTo) : new Date() }
          : {}),
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
      !isPeriod && withdrawalRemaining > 0
        ? await grantRemainingSessionCredits(
            tx,
            { id: enrollment.id, studentId: enrollment.studentId, classId: enrollment.classId ?? "" },
            withdrawalRemaining,
            WITHDRAWAL_CREDIT_REASON
          )
        : null;

    let walletBalanceAfter: number | null = null;
    let refunded = false;
    if (isPeriod && body.status === "WITHDRAWN") {
      const balanceBefore = await getWalletBalance(tx, existing.id);
      if (balanceBefore > 0 && walletDecision === "REFUND") {
        await markWalletRefunded(tx, existing.id, `Đã hoàn tiền mặt lúc rút lớp: ${body.reason || "không ghi lý do"}`);
        refunded = true;
        walletBalanceAfter = 0;
      } else {
        walletBalanceAfter = balanceBefore;
      }
    }

    return { updated: enrollment, sessionCredits: grantedCredits, walletBalance: walletBalanceAfter, walletRefunded: refunded };
  });

  const syncedStudent = await syncStudentDerivedFields(existing.studentId);

  return NextResponse.json({
    item: updated,
    student: syncedStudent,
    sessionCreditsGranted: sessionCredits?.granted ?? undefined,
    // walletBalance > 0 && !walletRefunded: ví còn dư và nhân viên chọn "Giữ lại"
    // (hoặc chưa được hỏi) — frontend nên hiện lại để nhắc xử lý nếu cần.
    walletBalance: walletBalance ?? undefined,
    walletRefunded: walletRefunded || undefined,
  });
}
