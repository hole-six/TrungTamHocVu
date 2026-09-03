import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { ensureBillingPeriod, generateCourseCharge } from "@/lib/server/billing-generation";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền ghi danh học viên" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      course: {
        include: {
          bookRequirements: {
            include: { book: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  const requestedBillingModel = String(body.billingModel ?? "COURSE").toUpperCase();
  const billingModel = cls.isRemedial ? "COURSE" : requestedBillingModel;
  const enrollDate = body.enrollDate ? new Date(body.enrollDate) : new Date();
  const unitPriceSnapshot = Number(body.tuitionUnitPriceSnapshot ?? cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0);
  const purchasedMainSessionCount = Number(body.purchasedMainSessionCount ?? cls.totalSessions ?? 0);
  const paidCatchupSessionCount = Math.max(0, Number(body.paidCatchupSessionCount ?? 0));
  const paidCatchupUnitPrice = Number(body.paidCatchupUnitPrice ?? unitPriceSnapshot);
  if (!studentId) return NextResponse.json({ error: "Thiếu học viên" }, { status: 400 });
  if (billingModel !== "COURSE" && billingModel !== "PERIOD" && billingModel !== "INSTALLMENT") {
    return NextResponse.json({ error: "Hình thức đóng học phí không hợp lệ" }, { status: 400 });
  }

  if (!cls.isRemedial && (!Number.isInteger(purchasedMainSessionCount) || purchasedMainSessionCount <= 0)) {
    return NextResponse.json({ error: "So buoi khoa chinh khong hop le." }, { status: 400 });
  }
  if (!cls.isRemedial && (!Number.isInteger(unitPriceSnapshot) || unitPriceSnapshot < 0)) {
    return NextResponse.json({ error: "Don gia khoa chinh khong hop le." }, { status: 400 });
  }
  if (!Number.isInteger(paidCatchupSessionCount) || paidCatchupSessionCount < 0 || !Number.isInteger(paidCatchupUnitPrice) || paidCatchupUnitPrice < 0) {
    return NextResponse.json({ error: "Thong tin bo tro dau khoa khong hop le." }, { status: 400 });
  }

  const rawInstallments = Array.isArray(body.installments) ? body.installments : [];
  let installmentPlans: { billingPeriodId: string; sequence: number; label: string; amount: number; dueDate: Date }[] = [];
  if (billingModel === "INSTALLMENT") {
    if (!purchasedMainSessionCount || !unitPriceSnapshot) {
      return NextResponse.json({ error: "Lớp cần có tổng số buổi và học phí/buổi trước khi lập kế hoạch trả góp" }, { status: 400 });
    }
    if (rawInstallments.length < 2 || rawInstallments.length > 12) {
      return NextResponse.json({ error: "Kế hoạch trả góp cần từ 2 đến 12 đợt" }, { status: 400 });
    }
    type InstallmentDraft = { dueMonth: string; amount: number; sequence: number; dueDate: Date } | null;
    const normalized: InstallmentDraft[] = rawInstallments.map((item: { dueMonth?: unknown; amount?: unknown }, index: number) => {
      const dueMonth = String(item.dueMonth ?? "").trim();
      const amount = Number(item.amount);
      const match = /^(\d{4})-(\d{2})$/.exec(dueMonth);
      if (!match || Number(match[2]) < 1 || Number(match[2]) > 12 || !Number.isInteger(amount) || amount <= 0) return null;
      return { dueMonth, amount, sequence: index + 1, dueDate: new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 15)) };
    });
    if (normalized.some((item) => !item) || new Set(normalized.map((item) => item?.dueMonth)).size !== normalized.length) {
      return NextResponse.json({ error: "Mỗi đợt cần có tháng thu riêng và số tiền hợp lệ" }, { status: 400 });
    }
    const expectedTotal = purchasedMainSessionCount * unitPriceSnapshot + paidCatchupSessionCount * paidCatchupUnitPrice;
    const plannedTotal = normalized.reduce((sum, item) => sum + (item?.amount ?? 0), 0);
    if (plannedTotal !== expectedTotal) {
      return NextResponse.json({ error: `Tổng trả góp phải bằng học phí khóa ${expectedTotal.toLocaleString("vi-VN")}đ` }, { status: 400 });
    }
    const periods = await Promise.all(normalized.map((item) => ensureBillingPeriod(cls.branchId, item!.dueMonth)));
    installmentPlans = normalized.map((item, index) => ({ billingPeriodId: periods[index].id, sequence: item!.sequence, label: `Đợt ${item!.sequence}/${normalized.length}`, amount: item!.amount, dueDate: item!.dueDate }));
  }

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { lead: true } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (student.branchId !== cls.branchId) {
    return NextResponse.json(
      { error: "Học viên và lớp học không cùng cơ sở, không thể ghi danh." },
      { status: 400 },
    );
  }

  if (cls.isRemedial) {
    const availableCredits = await prisma.sessionCredit.count({
      where: { studentId, status: "AVAILABLE" },
    });
    if (availableCredits <= 0) {
      return NextResponse.json(
        { error: "Học viên này không có buổi bổ trợ khả dụng nên chưa thể gán vào lớp bổ trợ." },
        { status: 409 },
      );
    }
  }

  const existingActive = await prisma.enrollment.findFirst({
    where: { studentId, classId: cls.id, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
  });
  if (existingActive) {
    return NextResponse.json({ error: "Học viên đã ghi danh lớp này rồi" }, { status: 409 });
  }

  // Lead đánh giá "mất gốc" có thể đã ghi sẵn số buổi bổ trợ dự kiến (xem
  // components/leads/NewLeadDrawer.tsx) — cấp đúng 1 lần ở lần ghi danh đầu tiên
  // (không áp dụng cho lớp bổ trợ, vốn dùng riêng cơ chế tiêu credit có sẵn), rồi xóa
  // khỏi Lead để không bị cấp lại nếu học viên này ghi danh thêm lớp khác sau này.
  const pendingRemedial = !cls.isRemedial ? Math.max(0, student.lead?.pendingRemedialSessions ?? 0) : 0;

  const paidCatchupCredits =
    !cls.isRemedial && paidCatchupSessionCount > 0
      ? Array.from({ length: paidCatchupSessionCount }, (_, index) => ({
          studentId,
          sourceSessionId: null,
          status: "AVAILABLE",
          origin: "PAID_CATCHUP",
          unitPriceSnapshot: paidCatchupUnitPrice,
          paidAmount: paidCatchupUnitPrice,
          notes: `Bo tro dau khoa co phi ${index + 1}/${paidCatchupSessionCount}`,
        }))
      : [];
  const pendingRemedialCredits =
    pendingRemedial > 0
      ? Array.from({ length: pendingRemedial }, (_, index) => ({
          studentId,
          sourceSessionId: null,
          status: "AVAILABLE",
          origin: "MANUAL",
          unitPriceSnapshot: 0,
          paidAmount: 0,
          notes: `Bổ trợ mất gốc từ lead ${index + 1}/${pendingRemedial}`,
        }))
      : [];
  const newSessionCredits = [...paidCatchupCredits, ...pendingRemedialCredits];

  const enrollment = await prisma.$transaction(async (tx) => {
    const created = await tx.enrollment.create({
      data: {
        studentId,
        classId: cls.id,
        status: "ACTIVE",
        billingModel,
        enrollDate,
        learningStartDate: enrollDate,
        purchasedMainSessionCount: cls.isRemedial ? null : purchasedMainSessionCount,
        tuitionUnitPriceSnapshot: cls.isRemedial ? null : unitPriceSnapshot,
        paidCatchupSessionCount: cls.isRemedial ? 0 : paidCatchupSessionCount,
        paidCatchupUnitPrice: cls.isRemedial ? null : paidCatchupUnitPrice,
        pricingBasis: cls.isRemedial ? "MANUAL" : "MID_CLASS_FULL_COURSE",
        installments: installmentPlans.length ? { create: installmentPlans } : undefined,
        sessionCredits: newSessionCredits.length ? { create: newSessionCredits } : undefined,
        bookRequirements:
          !cls.isRemedial && cls.course?.bookRequirements.length
            ? {
                create: cls.course.bookRequirements.map((item) => ({
                  studentId,
                  classId: cls.id,
                  bookId: item.bookId,
                  courseBookRequirementId: item.id,
                  quantity: item.quantity,
                  unitPriceSnapshot: item.book.unitPrice,
                  totalAmount: item.quantity * item.book.unitPrice,
                  status: "PENDING",
                  notes: `Bộ sách chuẩn của khóa ${cls.course?.name ?? cls.className}`,
                })),
              }
            : undefined,
      },
    });
    await tx.enrollmentStatusHistory.create({
      data: { studentId, enrollmentId: created.id, toStatus: "ACTIVE", changedById: user.id },
    });
    if (pendingRemedial > 0 && student.leadId) {
      await tx.lead.update({ where: { id: student.leadId }, data: { pendingRemedialSessions: null } });
    }
    await syncStudentDerivedFields(studentId, tx);
    return created;
  });

  const syncedStudent = await syncStudentDerivedFields(studentId);

  // Ghi danh xong là thu học phí trọn khóa ngay — không đợi tới kỳ thu tháng sau nữa
  // (xem lib/server/billing-generation.ts generateCourseCharge). Không chặn việc ghi
  // danh nếu sinh học phí lỗi (vd lớp chưa cấu hình tổng buổi) — trả về warning để
  // nhân sự tự xử lý sau, ghi danh vẫn phải thành công.
  const chargeResult = billingModel === "COURSE" && !cls.isRemedial ? await generateCourseCharge(enrollment.id) : null;

  return NextResponse.json(
    { item: enrollment, student: syncedStudent, billingWarning: chargeResult && "error" in chargeResult ? chargeResult.error : undefined },
    { status: 201 }
  );
}
