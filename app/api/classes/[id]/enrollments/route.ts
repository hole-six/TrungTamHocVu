import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole, getUserRoleAndOverride } from "@/lib/permissions";
import { canUpdate, canUpdateWithOverride } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import {
  ensureBillingPeriod,
  generateCourseCharge,
  generatePeriodChargesForNewEnrollment,
} from "@/lib/server/billing-generation";
import { attachCourseBookRequirements } from "@/lib/server/enrollment-materials";
import { computeEffectiveUnitPrice } from "@/lib/server/tuition-rules";

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
  // PERIOD (95% học sinh) KHÔNG có khái niệm "đã mua N buổi" — quyền học của họ nằm
  // trong Ví buổi học (nạp mỗi lần đóng tiền), không phải 1 con số cố định lúc ghi
  // danh. Chỉ COURSE/INSTALLMENT mới cần purchasedMainSessionCount thật (mua đứt N
  // buổi ngay lúc ghi danh) — ép nó cho PERIOD trước đây là bịa quyền học, gây chặn
  // nhầm chuyển lớp cho cả nhóm này (xem kế hoạch đã duyệt).
  // KHÔNG lấy cls.totalSessions làm mặc định ngầm. Số buổi của gói THEO KHÓA là cam kết
  // riêng của TỪNG học viên (mỗi người mua số buổi khác nhau nên ngày kết thúc dự kiến
  // cũng khác nhau) — lớp chỉ là cái "mác" để điểm danh, số buổi của lớp chỉ là dự kiến
  // lịch. Trước đây thiếu field này thì server âm thầm lấy số của lớp, tức toàn bộ học
  // phí của học viên đó bị quyết định bởi lớp mà không ai chọn. Form phải gửi rõ số buổi
  // (giao diện vẫn điền sẵn số của lớp làm gợi ý để nhân viên sửa).
  const purchasedMainSessionCount =
    billingModel === "PERIOD" ? null : Number(body.purchasedMainSessionCount ?? 0);
  // Đóng theo tháng vẫn học theo SỐ BUỔI CỦA KHÓA — bắt buộc nhập để biết khi nào thôi thu
  // (chốt nghiệp vụ 13/9): phiếu tháng không vượt phần khóa còn lại, đủ khóa thì dừng.
  const periodCourseSessionCount =
    billingModel === "PERIOD" && !cls.isRemedial ? Number(body.periodCourseSessionCount ?? 0) : null;
  // Bổ trợ đầu khóa TÍNH PHÍ (khác bổ trợ vắng miễn phí) chỉ được tính tiền qua
  // generateCourseCharge (1 lần lúc ghi danh) — nhánh PERIOD của generateChargesForPeriod
  // luôn set paidCatchupAmount=0, không bao giờ thu khoản này. Nếu cho PERIOD lưu số
  // buổi/đơn giá này thì tiền biến mất âm thầm (nhân viên tưởng đã tính, thực ra không
  // bao giờ lên hóa đơn) — chặn ngay ở đây thay vì mỗi UI phải tự nhớ ẩn field.
  const paidCatchupSessionCount = billingModel === "PERIOD" ? 0 : Math.max(0, Number(body.paidCatchupSessionCount ?? 0));
  const paidCatchupUnitPrice = Number(body.paidCatchupUnitPrice ?? unitPriceSnapshot);
  if (!studentId) return NextResponse.json({ error: "Thiếu học viên" }, { status: 400 });
  if (billingModel !== "COURSE" && billingModel !== "PERIOD" && billingModel !== "INSTALLMENT") {
    return NextResponse.json({ error: "Hình thức đóng học phí không hợp lệ" }, { status: 400 });
  }
  if (billingModel === "PERIOD" && Number(body.paidCatchupSessionCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Đóng theo tháng chưa hỗ trợ tính phí bổ trợ đầu khóa lúc ghi danh — tạo khoản thu riêng sau khi ghi danh nếu cần." },
      { status: 400 },
    );
  }

  if (
    billingModel !== "PERIOD" &&
    !cls.isRemedial &&
    (!Number.isInteger(purchasedMainSessionCount) || (purchasedMainSessionCount ?? 0) <= 0)
  ) {
    return NextResponse.json(
      { error: "Chưa nhập số buổi của khóa chính. Gói đóng trọn khóa phải ghi rõ học viên mua bao nhiêu buổi (không lấy mặc định theo lớp)." },
      { status: 400 },
    );
  }
  if (
    periodCourseSessionCount !== null &&
    (!Number.isInteger(periodCourseSessionCount) || periodCourseSessionCount <= 0 || periodCourseSessionCount > 500)
  ) {
    return NextResponse.json(
      { error: "Chưa nhập số buổi của khóa. Đóng theo tháng cũng phải ghi rõ khóa bao nhiêu buổi để biết khi nào thôi thu." },
      { status: 400 },
    );
  }
  if (!cls.isRemedial && (!Number.isInteger(unitPriceSnapshot) || unitPriceSnapshot < 0)) {
    return NextResponse.json({ error: "Don gia khoa chinh khong hop le." }, { status: 400 });
  }
  if (!Number.isInteger(paidCatchupSessionCount) || paidCatchupSessionCount < 0 || !Number.isInteger(paidCatchupUnitPrice) || paidCatchupUnitPrice < 0) {
    return NextResponse.json({ error: "Thong tin bo tro dau khoa khong hop le." }, { status: 400 });
  }

  // CHIẾT KHẤU NGAY LÚC GÁN LỚP — cùng một khái niệm với mục "Chiết khấu" trong hồ sơ học
  // viên (bảng Scholarship gắn theo ghi danh), chỉ là nhập được ngay từ đầu thay vì phải
  // ghi danh xong rồi mới vào thêm. Phải có TRƯỚC khi sinh phiếu, nếu không phiếu đầu
  // tiên ra theo giá gốc. Lớp bổ trợ không thu tiền nên bỏ qua.
  const discountPercent = cls.isRemedial ? 0 : Number(body.discountPercent ?? 0);
  const discountReason = String(body.discountReason ?? "").trim() || null;
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return NextResponse.json({ error: "Chiết khấu phải từ 0 đến 100%." }, { status: 400 });
  }
  if (discountPercent > 0) {
    // Cấp chiết khấu là quyền của mảng học phí, không phải quyền xếp lớp — cùng điều kiện
    // với app/api/students/[id]/scholarships (người xếp được lớp chưa chắc được giảm giá).
    const tuitionAccess = await getUserRoleAndOverride(user.id, "tuition");
    if (!canUpdateWithOverride("tuition", tuitionAccess.role, tuitionAccess.override)) {
      return NextResponse.json(
        { error: "Vai trò của bạn không có quyền cấp chiết khấu. Bỏ trống chiết khấu hoặc nhờ bộ phận học phí thêm sau." },
        { status: 403 },
      );
    }
  }
  const discountRate = discountPercent / 100;

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
    // Chiết khấu chỉ giảm học phí khóa chính (cùng quy tắc với phiếu trọn khóa, xem
    // generateCourseCharge), không giảm buổi học thêm đầu khóa có đơn giá riêng.
    const expectedTotal =
      purchasedMainSessionCount * computeEffectiveUnitPrice(unitPriceSnapshot, discountRate, 0) +
      paidCatchupSessionCount * paidCatchupUnitPrice;
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
        // Gắn đúng khóa học của lớp — trước đây bỏ trống nên mọi ghi danh tạo qua giao
        // diện đều mất liên kết khóa, các màn hình phải tự suy ngược từ class.courseId.
        courseId: cls.courseId,
        status: "ACTIVE",
        billingModel,
        enrollDate,
        learningStartDate: enrollDate,
        purchasedMainSessionCount: cls.isRemedial ? null : purchasedMainSessionCount,
        periodCourseSessionCount,
        tuitionUnitPriceSnapshot: cls.isRemedial ? null : unitPriceSnapshot,
        paidCatchupSessionCount: cls.isRemedial ? 0 : paidCatchupSessionCount,
        paidCatchupUnitPrice: cls.isRemedial ? null : paidCatchupUnitPrice,
        pricingBasis: cls.isRemedial ? "MANUAL" : "MID_CLASS_FULL_COURSE",
        installments: installmentPlans.length ? { create: installmentPlans } : undefined,
        sessionCredits: newSessionCredits.length ? { create: newSessionCredits } : undefined,
      },
    });
    // Bộ giáo trình chuẩn của khóa — dùng chung 1 quy tắc với chuyển lớp/kết thúc lớp/CRM.
    await attachCourseBookRequirements(tx, { studentId, classId: cls.id, enrollmentId: created.id });

    if (discountRate > 0) {
      // Hiệu lực từ đúng ngày vào học: phiếu trọn khóa lọc chiết khấu theo enrollDate,
      // phiếu tháng lọc theo khoảng của kỳ — cả hai đều khớp với mốc này.
      await tx.scholarship.create({
        data: {
          studentId,
          enrollmentId: created.id,
          percentage: discountRate,
          reason: discountReason ?? "Chiết khấu lúc ghi danh",
          effectiveFrom: enrollDate,
          effectiveTo: null,
        },
      });
    }

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

  // Ghi danh xong là có phiếu ngay, cả hai kiểu thu — không đợi tới đợt thu tự động ngày 1
  // tháng sau nữa. Trọn khóa: một phiếu cho cả khóa. Theo tháng: phiếu cho phần còn lại
  // của tháng đang học (thu lẻ từ ngày vào), các tháng sau đợt thu tự động lo. Không
  // chặn việc ghi danh nếu sinh phiếu lỗi (vd kỳ thu tháng này đã khóa sổ) — trả về cảnh
  // báo để nhân sự tự xử lý, ghi danh vẫn phải thành công.
  const billingWarnings: string[] = [];
  if (!cls.isRemedial && billingModel === "COURSE") {
    const chargeResult = await generateCourseCharge(enrollment.id);
    if ("error" in chargeResult && chargeResult.error) billingWarnings.push(chargeResult.error);
  }
  if (!cls.isRemedial && billingModel === "PERIOD") {
    const { warnings } = await generatePeriodChargesForNewEnrollment(enrollment.id);
    billingWarnings.push(...warnings);
  }

  // Phiếu vừa sinh cho ghi danh này — form gán lớp dùng để hiện "Thu tiền ngay" và "In
  // phiếu" liền tại chỗ, không phải sang trang Học phí tìm lại học viên. Số còn lại đã trừ
  // tiền đóng trước tự gắn vào (settleChargesFromAdvancePayments).
  const createdCharges = cls.isRemedial
    ? []
    : await prisma.charge.findMany({
        where: { enrollmentId: enrollment.id },
        include: { billingPeriod: { select: { periodName: true } }, allocations: { select: { amount: true } } },
        orderBy: { createdAt: "asc" },
      });
  const charges = createdCharges.map((charge) => {
    const paid = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    return {
      id: charge.id,
      periodName: charge.billingPeriod.periodName,
      billingModel: charge.billingModel,
      totalAmount: charge.totalAmount,
      remainingAmount: Math.max(0, charge.totalAmount - paid),
    };
  });

  return NextResponse.json(
    {
      item: enrollment,
      student: syncedStudent,
      charges,
      billingWarning: billingWarnings.length ? billingWarnings.join(" · ") : undefined,
    },
    { status: 201 }
  );
}
