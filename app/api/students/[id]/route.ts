import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canViewFullWithOverride, canViewWithOverride, canUpdateWithOverride, canDeleteWithOverride } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { computeOutstandingBalance } from "@/lib/server/balance";
import { canAccessBranch } from "@/lib/branch-filter";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const access = user ? await getUserRoleAndOverride(user.id, "students") : { role: null, override: null };
  if (user && !canViewWithOverride("students", access.role, access.override)) {
    return NextResponse.json({ error: "Khong co quyen xem hoc vien" }, { status: 403 });
  }
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const limitedToAssignedStudents = !canViewFullWithOverride("students", access.role, access.override);
  if (limitedToAssignedStudents && !user.employeeId) {
    return NextResponse.json({ error: "Không có quyền xem học viên này" }, { status: 403 });
  }
  const student = await prisma.student.findFirst({
    where: {
      id: params.id,
      ...(limitedToAssignedStudents
        ? {
            enrollments: {
              some: {
                status: "ACTIVE",
                class: {
                  OR: [
                    { defaultAssignments: { some: { employeeId: user.employeeId!, isActive: true } } },
                    { sessions: { some: { assignments: { some: { employeeId: user.employeeId! } } } } },
                  ],
                },
              },
            },
          }
        : {}),
    },
    include: {
      guardians: { include: { guardian: true } },
      enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" } },
      charges: limitedToAssignedStudents ? false : { include: { billingPeriod: true }, orderBy: { createdAt: "desc" } },
      payments: limitedToAssignedStudents ? false : { orderBy: { paidDate: "desc" } },
    },
  });
  if (!student) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });

  if (!(await canAccessBranch(student.branchId))) return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  const outstanding = limitedToAssignedStudents ? null : await computeOutstandingBalance(student.id);

  return NextResponse.json({ item: student, outstanding });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const existing = await prisma.student.findUnique({ where: { id: params.id } });
  if (existing && !(await canAccessBranch(existing.branchId))) {
    return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });
  }
  if (!existing) return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  const { role, override } = await getUserRoleAndOverride(user.id, "students");
  if (!canUpdateWithOverride("students", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền sửa hồ sơ học viên" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ["fullName", "gender", "phone", "address", "leaveReason", "evaluation", "referredBy", "notes"]) {
    if (field in body) data[field] = body[field] || null;
  }
  for (const field of ["dob", "enrollDate", "leaveDate"]) {
    if (field in body) data[field] = body[field] ? new Date(body[field]) : null;
  }

  await prisma.student.update({ where: { id: params.id }, data });
  // FR-0041: status luôn suy ra từ leaveDate — syncStudentDerivedFields tính lại
  // ngay dưới đây (kèm enrollDate/cascade sang Lead), nên không cần set
  // data.status thủ công ở trên nữa (tránh 2 nơi cùng tính 1 giá trị).
  const updated = await syncStudentDerivedFields(params.id);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: user.branchId,
      action: "update",
      entityType: "Student",
      entityId: params.id,
      before: JSON.stringify(existing),
      after: JSON.stringify(updated),
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "students");
  if (!canDeleteWithOverride("students", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xóa học viên" }, { status: 403 });
  }

  const existing = await prisma.student.findUnique({ where: { id: params.id }, select: { branchId: true } });
  if (!existing) return NextResponse.json({ error: "Khong tim thay hoc vien" }, { status: 404 });
  if (!(await canAccessBranch(existing.branchId))) return NextResponse.json({ error: "Khong co quyen truy cap co so" }, { status: 403 });

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
