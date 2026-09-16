import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasPermission } from "@/lib/server/permissions";
import { canAccessBranch } from "@/lib/branch-filter";
import { CASH_METHOD, MAX_CASH_DISCOUNT_PERCENT } from "@/lib/cash-discount";
import { recordStudentPayment } from "@/lib/server/payment-recording";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await hasPermission(user, "tuition", "receive_payment"))) {
    return NextResponse.json({ error: "Bạn không có quyền thu tiền học phí" }, { status: 403 });
  }

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  const amount = Number(body.amount);
  const method = String(body.method ?? "").trim();
  const discountPercent =
    body.discountPercent !== undefined && body.discountPercent !== "" ? Number(body.discountPercent) : 0;
  const discountReason = String(body.discountReason ?? "").trim();

  if (!studentId) return NextResponse.json({ error: "Thiếu học viên" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Số tiền không hợp lệ" }, { status: 400 });
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > MAX_CASH_DISCOUNT_PERCENT) {
    return NextResponse.json(
      { error: `Chiết khấu tiền mặt phải nằm trong khoảng 0-${MAX_CASH_DISCOUNT_PERCENT}%` },
      { status: 400 },
    );
  }
  if (discountPercent > 0 && method !== CASH_METHOD) {
    return NextResponse.json({ error: "Chiết khấu chỉ áp dụng cho thanh toán tiền mặt" }, { status: 400 });
  }
  if (discountPercent > 0 && !discountReason) {
    return NextResponse.json({ error: "Cần nhập lý do chiết khấu tiền mặt" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  if (!(await canAccessBranch(student.branchId))) {
    return NextResponse.json({ error: "Học viên không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const paymentNo = `PM${crypto.randomUUID().slice(0, 10).toUpperCase()}`;

  const result = await prisma.$transaction(async (tx) =>
    recordStudentPayment(tx, {
      studentId,
      amount,
      method,
      discountPercent,
      discountReason,
      paidDate: body.paidDate ? new Date(body.paidDate) : null,
      notes: String(body.notes ?? ""),
      description: body.description ? String(body.description) : null,
      categoryId: body.categoryId ? String(body.categoryId) : null,
      userId: user.id,
      paymentNo,
      student,
    }),
  ).catch((error: unknown) => {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Không thể ghi nhận thanh toán." };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      item: result.payment,
      unallocated: result.unallocated,
      advanceBalance: result.advanceBalance,
      cashTransactionId: result.cashTransactionId,
      discountAmount: result.discountAmount,
      discountNote: result.discountNote,
    },
    { status: 201 },
  );
}
