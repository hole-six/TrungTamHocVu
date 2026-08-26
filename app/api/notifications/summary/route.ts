import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { getVietnamToday } from "@/lib/server/class-rules";
import { chargeOwnDueAmount } from "@/lib/server/tuition-rules";

// Bell thông báo cho admin — tính ĐỘNG mỗi lần mở/tải trang, không lưu bảng riêng.
// Đúng triết lý "không Cong don"/không lưu trạng thái trung gian đã dùng xuyên suốt hệ
// thống (xem đầu tuition-rules.ts) — tránh phải viết hook ghi Notification vào MỌI nơi
// có thể phát sinh sự kiện (rất nhiều route), rủi ro cao và dễ lệch dữ liệu.
// 2 nguồn tái dùng ĐÚNG query đã có sẵn cho từng trang liên quan, không bịa logic mới:
//   - "Chưa nộp bài tập" — SessionRequirementCheck NOT_SUBMITTED, khớp /teacher-tasks.
//   - "Học phí quá hạn" — Charge có billingPeriod.startDate <= hôm nay và còn nợ, khớp
//     đúng cách app/(app)/students/[id]/page.tsx tính "quá hạn" cho 1 học sinh, gộp
//     rộng ra toàn chi nhánh ở đây.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const role = await getUserRole(user.id);
  const activeBranchId = await getCurrentBranchId();
  const vietnamToday = getVietnamToday();

  const canSeeRequirementChecks = canView("hr", role);
  const canSeeTuition = canView("tuition", role);

  const [requirementChecks, overdueCharges] = await Promise.all([
    canSeeRequirementChecks
      ? prisma.sessionRequirementCheck.findMany({
          where: { status: "NOT_SUBMITTED", employee: activeBranchId ? { branchId: activeBranchId } : {} },
          include: {
            employee: { select: { fullName: true } },
            session: { select: { sessionDate: true, class: { select: { className: true } } } },
          },
          orderBy: { session: { sessionDate: "desc" } },
          take: 30,
        })
      : Promise.resolve([]),
    canSeeTuition
      ? prisma.charge.findMany({
          where: {
            student: activeBranchId ? { branchId: activeBranchId } : {},
            billingPeriod: { startDate: { lte: vietnamToday } },
          },
          include: {
            student: { select: { id: true, fullName: true, studentCode: true } },
            billingPeriod: { select: { periodName: true } },
            allocations: { where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } }, select: { amount: true } },
          },
          orderBy: { billingPeriod: { startDate: "desc" } },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  const requirementItems = requirementChecks.map((item) => ({
    id: item.id,
    type: "requirement" as const,
    title: `${item.employee.fullName} chưa nộp — ${item.session.class.className}`,
    detail: `Buổi ${new Date(item.session.sessionDate).toLocaleDateString("vi-VN")}`,
    href: `/teacher-tasks?status=NOT_SUBMITTED`,
  }));

  const overdueItems = overdueCharges
    .map((charge) => {
      const own = chargeOwnDueAmount(charge);
      const paid = charge.allocations.reduce((sum, a) => sum + a.amount, 0);
      const remaining = own - paid;
      return { charge, remaining };
    })
    .filter((item) => item.remaining > 0)
    .map(({ charge, remaining }) => ({
      id: charge.id,
      type: "overdue" as const,
      title: `${charge.student.fullName} quá hạn học phí`,
      detail: `Kỳ ${charge.billingPeriod.periodName} · còn ${remaining.toLocaleString("vi-VN")}đ`,
      href: `/students/${charge.student.id}?tab=hocphi`,
    }));

  const items = [...requirementItems, ...overdueItems];

  return NextResponse.json({
    total: items.length,
    requirementCount: requirementItems.length,
    overdueCount: overdueItems.length,
    items: items.slice(0, 50),
  });
}
