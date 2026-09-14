import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canTransitionEnrollment, dateKeyToUtcStart, pauseEndBoundary, pauseStartBoundary } from "@/lib/server/class-rules";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { ensureBillingPeriod, generateChargesForPeriod, generatePeriodChargesForNewEnrollment } from "@/lib/server/billing-generation";
import { canEditCharges } from "@/lib/server/tuition-rules";
import { getVietnamToday } from "@/lib/server/class-rules";
import { forfeitWallet } from "@/lib/server/enrollment-wallet";


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

  // BẢO LƯU / ĐI HỌC LẠI: chốt mốc theo NGÀY, không theo giờ bấm nút — xem pauseStartBoundary.
  const pauseFrom = body.status === "PAUSED" ? pauseStartBoundary(body.pausedFrom) : null;
  const resuming = existing.status === "PAUSED" && body.status === "ACTIVE";
  const pauseTo = resuming ? pauseEndBoundary(body.resumeDate ?? body.pausedTo) : null;
  // Ngày bảo lưu có hiệu lực: làm tròn LÊN nửa đêm (dữ liệu cũ ghi theo giờ bấm nút, buổi
  // học đầu tiên bị loại khỏi điểm danh là buổi của ngày làm tròn này).
  const pauseEffectiveStart = existing.pausedFrom
    ? new Date(Math.ceil(existing.pausedFrom.getTime() / 86_400_000) * 86_400_000)
    : null;
  // Đi học lại ĐÚNG ngày bắt đầu bảo lưu = bấm nhầm, hủy bảo lưu: không có buổi nào nằm
  // trong kỳ nghỉ nên xóa hẳn khoảng nghỉ thay vì ghi một khoảng rỗng.
  const cancelsPause = Boolean(pauseTo && pauseEffectiveStart && pauseTo.getTime() + 1 === pauseEffectiveStart.getTime());
  if (body.status === "PAUSED" && body.pausedFrom && !dateKeyToUtcStart(body.pausedFrom)) {
    return NextResponse.json({ error: "Ngày bắt đầu bảo lưu không hợp lệ." }, { status: 400 });
  }
  if (pauseFrom && pauseFrom < new Date(Date.UTC(existing.enrollDate.getUTCFullYear(), existing.enrollDate.getUTCMonth(), existing.enrollDate.getUTCDate()))) {
    return NextResponse.json({ error: "Ngày bắt đầu bảo lưu không được trước ngày vào lớp." }, { status: 400 });
  }
  if (resuming && body.resumeDate && !dateKeyToUtcStart(body.resumeDate)) {
    return NextResponse.json({ error: "Ngày đi học lại không hợp lệ." }, { status: 400 });
  }
  if (pauseTo && pauseEffectiveStart && pauseTo.getTime() + 1 < pauseEffectiveStart.getTime()) {
    const [y, m, d] = pauseEffectiveStart.toISOString().slice(0, 10).split("-");
    return NextResponse.json(
      { error: `Ngày đi học lại không được trước ngày bắt đầu bảo lưu (${d}/${m}/${y}).` },
      { status: 400 },
    );
  }
  // "Đã hoàn tiền"/"Giữ lại" — chốt nghiệp vụ mục 3.10: KHÔNG tự động quyết, nhân
  // CHÍNH SÁCH TRUNG TÂM: BỎ DỞ THÌ KHÔNG HOÀN TIỀN.
  //
  // Tiền đã thu chỉ được trừ đi trong đúng một trường hợp — TRUNG TÂM cho nghỉ buổi
  // nào thì buổi đó không bị trừ khỏi ví, phần dư tự mang sang tháng sau (xem
  // debitWalletsForCompletedSession). Còn học viên tự nghỉ giữa chừng thì phần đã
  // đóng mất luôn, không hoàn tiền mặt và cũng không quy đổi thành buổi bổ trợ.
  //
  // Trước đây code làm NGƯỢC lại: gói theo khóa thì cấp SessionCredit cho toàn bộ số
  // buổi chưa học (tức trả lại giá trị dưới dạng buổi bổ trợ), gói theo tháng thì hỏi
  // nhân viên "hoàn tiền hay giữ lại". Cả hai đều trái chính sách.
  // Rút lớp hoặc BẢO LƯU gói theo tháng: chốt phiếu học phí tháng này NGAY LÚC CÒN ĐANG HỌC.
  // Đợt thu chỉ xét ghi danh ACTIVE, nên nếu không chốt trước thì những buổi đã học thật
  // trong tháng (trước ngày rút/bảo lưu) vĩnh viễn không nằm trong phiếu nào.
  if ((body.status === "WITHDRAWN" || body.status === "PAUSED") && isPeriod && existing.classId) {
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

  const { updated, forfeitedSessions } = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.update({
      where: { id: params.id },
      data: {
        status: body.status,
        endDate: ["COMPLETED", "WITHDRAWN", "TRANSFERRED"].includes(body.status) ? new Date() : existing.endDate,
        // BẢO LƯU: ghi lại KHOẢNG nghỉ, không chỉ đổi trạng thái. Bắt đầu nghỉ thì mở
        // một khoảng mới (chưa có ngày kết thúc); đi học lại thì đóng khoảng đó lại.
        // Nhờ vậy danh sách điểm danh của các buổi đã diễn ra trong kỳ nghỉ vẫn đúng
        // mãi về sau — xem lib/server/class-roster.ts.
        ...(pauseFrom ? { pausedFrom: pauseFrom, pausedTo: null } : {}),
        ...(cancelsPause ? { pausedFrom: null, pausedTo: null } : pauseTo ? { pausedTo: pauseTo } : {}),
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

    // Gói theo khóa: KHÔNG cấp buổi bổ trợ cho phần chưa học nữa (xem chính sách ở trên).
    // Gói theo tháng: buổi còn dư trong ví coi như mất, nhưng ghi hẳn một dòng giao dịch
    // để tra lại được mất bao nhiêu, ngày nào, lý do gì.
    let forfeitedSessions = 0;
    if (isPeriod && body.status === "WITHDRAWN") {
      const result = await forfeitWallet(
        tx,
        existing.id,
        `Rút lớp, không hoàn tiền theo chính sách trung tâm${body.reason ? `: ${body.reason}` : ""}`,
      );
      forfeitedSessions = result.forfeitedSessions;
    }

    return { updated: enrollment, forfeitedSessions };
  });

  // Đi học lại gói theo tháng: lập ngay phiếu học phí cho phần CÒN LẠI của tháng đi học lại
  // (và các tháng sau đó nếu nhập lùi ngày). Trong kỳ bảo lưu đợt thu bỏ qua ghi danh này,
  // nên nếu không lập ở đây thì học viên học hết tháng mà không có phiếu nào. Số buổi của
  // tháng đi học lại chỉ đếm từ ngày đi học lại — xem điều kiện bảo lưu trong
  // generateChargesForPeriod.
  let resumeBillingWarnings: string[] = [];
  if (pauseTo && isPeriod) {
    const { warnings } = await generatePeriodChargesForNewEnrollment(existing.id, new Date(), new Date(pauseTo.getTime() + 1));
    resumeBillingWarnings = warnings;
  }

  const syncedStudent = await syncStudentDerivedFields(existing.studentId);

  return NextResponse.json({
    item: updated,
    student: syncedStudent,
    // Số buổi còn dư bị mất khi rút lớp — frontend hiện lại để nhân viên nói rõ với
    // phụ huynh ngay lúc đó, tránh tranh cãi về sau.
    forfeitedSessions: forfeitedSessions || undefined,
    billingWarnings: resumeBillingWarnings.length ? resumeBillingWarnings : undefined,
  });
}
