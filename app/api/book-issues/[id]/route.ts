import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canDeleteWithOverride, canUpdateWithOverride } from "@/lib/server/role-matrix";
import { canEditCharges } from "@/lib/server/tuition-rules";
import { syncBookQuantityOnHand } from "@/lib/server/database-sync";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "inventory");
  if (!canUpdateWithOverride("inventory", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền cập nhật tình trạng tiền giáo trình" }, { status: 403 });
  }

  const existing = await prisma.bookIssue.findUnique({
    where: { id: params.id },
    include: { student: true, book: true },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy dòng xuất sách" }, { status: 404 });

  if (user.branchId && existing.student.branchId !== user.branchId) {
    return NextResponse.json({ error: "Dòng xuất sách không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  const body = await req.json();
  const paymentStatus = String(body.paymentStatus ?? "").trim().toUpperCase();
  const allowedStatuses = new Set(["UNPAID", "PARTIAL", "PAID"]);
  if (!allowedStatuses.has(paymentStatus)) {
    return NextResponse.json({ error: "Tình trạng tiền không hợp lệ" }, { status: 400 });
  }

  const notes = String(body.notes ?? "").trim();
  const updated = await prisma.bookIssue.update({
    where: { id: params.id },
    data: {
      paymentStatus,
      notes: notes || existing.notes || null,
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { role, override } = await getUserRoleAndOverride(user.id, "inventory");
  if (!canDeleteWithOverride("inventory", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa dòng giáo trình phát sinh" }, { status: 403 });
  }

  const existing = await prisma.bookIssue.findUnique({
    where: { id: params.id },
    include: {
      student: true,
      book: true,
      charge: { include: { billingPeriod: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy dòng xuất sách" }, { status: 404 });

  if (user.branchId && existing.student.branchId !== user.branchId) {
    return NextResponse.json({ error: "Dòng xuất sách không thuộc chi nhánh của bạn" }, { status: 403 });
  }

  if (existing.paymentStatus !== "UNPAID") {
    return NextResponse.json({ error: "Chỉ được xóa dòng sách còn ở trạng thái chưa thu." }, { status: 400 });
  }

  if (existing.charge && !canEditCharges(existing.charge.billingPeriod.status)) {
    return NextResponse.json({ error: "Kỳ học phí của dòng sách này đã chốt, không thể hoàn tác trực tiếp." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (existing.chargeId && existing.charge) {
      await tx.charge.update({
        where: { id: existing.chargeId },
        data: {
          materialsAmount: Math.max(0, existing.charge.materialsAmount - existing.amount),
          totalAmount: Math.max(0, existing.charge.totalAmount - existing.amount),
        },
      });
    }

    await tx.bookIssue.delete({ where: { id: existing.id } });
    await syncBookQuantityOnHand(existing.bookId, tx);
  });

  await syncBookQuantityOnHand(existing.bookId);
  return NextResponse.json({ ok: true });
}
