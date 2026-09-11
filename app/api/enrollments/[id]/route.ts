import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { canTransitionEnrollment } from "@/lib/server/class-rules";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { ensureBillingPeriod, generateChargesForPeriod } from "@/lib/server/billing-generation";
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
  if (body.status === "WITHDRAWN" && isPeriod && existing.classId) {
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

  const syncedStudent = await syncStudentDerivedFields(existing.studentId);

  return NextResponse.json({
    item: updated,
    student: syncedStudent,
    // Số buổi còn dư bị mất khi rút lớp — frontend hiện lại để nhân viên nói rõ với
    // phụ huynh ngay lúc đó, tránh tranh cãi về sau.
    forfeitedSessions: forfeitedSessions || undefined,
  });
}
