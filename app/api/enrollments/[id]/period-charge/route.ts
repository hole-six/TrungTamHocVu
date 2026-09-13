import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { ensureBillingPeriod, generateChargesForPeriod } from "@/lib/server/billing-generation";
import { monthKey } from "@/lib/server/tuition-rules";
import { getVietnamToday } from "@/lib/server/class-rules";

// LẬP / CẬP NHẬT PHIẾU THÁNG NÀY cho đúng 1 ghi danh theo tháng — nút trong drawer học
// viên khi lớp có buổi trong tháng mà phiếu chưa có hoặc tính thiếu. Dùng chung công thức
// với đợt tự động mỗi đêm, chỉ khác là chạy ngay và trả về LÝ DO nếu không lập được
// (kỳ đã chốt sổ, phiếu cũ đã thu chặn...) thay vì âm thầm bỏ qua.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("tuition", role)) {
    return NextResponse.json({ error: "Bạn không có quyền lập phiếu học phí." }, { status: 403 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: params.id },
    include: { class: { select: { branchId: true, isRemedial: true } } },
  });
  if (!enrollment || !enrollment.class) return NextResponse.json({ error: "Không tìm thấy ghi danh." }, { status: 404 });
  if (enrollment.billingModel !== "PERIOD") {
    return NextResponse.json({ error: "Chỉ ghi danh đóng theo tháng mới lập phiếu tháng." }, { status: 400 });
  }
  if (enrollment.status !== "ACTIVE") {
    return NextResponse.json({ error: "Ghi danh không còn đang học nên không lập phiếu." }, { status: 409 });
  }

  const period = await ensureBillingPeriod(enrollment.class.branchId, monthKey(getVietnamToday()));
  const result = await generateChargesForPeriod(period.id, { enrollmentId: enrollment.id });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });

  const charge = await prisma.charge.findFirst({
    where: { enrollmentId: enrollment.id, billingPeriodId: period.id },
    select: { id: true, sessionCount: true, scheduledSessionCount: true, totalAmount: true },
  });
  return NextResponse.json({
    periodName: period.periodName,
    charge,
    reasons: result.exceptions.map((item) => item.reason),
  });
}
