import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canDelete } from "@/lib/server/role-matrix";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      guardians: { include: { guardian: true } },
      enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" } },
      charges: { include: { billingPeriod: true }, orderBy: { createdAt: "desc" }, take: 12 },
      payments: { orderBy: { paidDate: "desc" }, take: 12 },
    },
  });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });

  const [chargeTotal, paidTotal] = await Promise.all([
    prisma.charge.aggregate({ where: { studentId: student.id }, _sum: { totalAmount: true } }),
    prisma.paymentAllocation.aggregate({
      where: { charge: { studentId: student.id } },
      _sum: { amount: true },
    }),
  ]);

  const outstanding = (chargeTotal._sum.totalAmount ?? 0) - (paidTotal._sum.amount ?? 0);

  return NextResponse.json({ item: student, outstanding });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const existing = await prisma.student.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  const role = await getUserRole(user.id);
  if (!canUpdate("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa hồ sơ học viên" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["fullName", "gender", "phone", "address", "leaveReason", "evaluation", "referredBy", "notes", "status"]) {
    if (field in body) data[field] = body[field] || null;
  }
  for (const field of ["dob", "enrollDate", "leaveDate"]) {
    if (field in body) data[field] = body[field] ? new Date(body[field]) : null;
  }

  const updated = await prisma.student.update({ where: { id: params.id }, data });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: user.branchId,
      action: "update",
      entityType: "Student",
      entityId: updated.id,
      before: JSON.stringify(existing),
      after: JSON.stringify(updated),
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canDelete("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa học viên" }, { status: 403 });
  }

  const [chargeCount, paymentCount] = await Promise.all([
    prisma.charge.count({ where: { studentId: params.id } }),
    prisma.payment.count({ where: { studentId: params.id } }),
  ]);
  if (chargeCount > 0 || paymentCount > 0) {
    return NextResponse.json(
      { error: "Học viên đã có dữ liệu học phí/thanh toán — chuyển sang trạng thái 'Đã nghỉ' thay vì xóa." },
      { status: 409 }
    );
  }

  await prisma.student.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
