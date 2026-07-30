import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreateWithOverride } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const branchWhere = await (await import("@/lib/branch-filter")).getBranchWhereClause(searchParams.get("branchId"));

  const where = {
    ...branchWhere,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { studentCode: { contains: q } },
            { studentDisplayId: { contains: q } },
            { phone: { contains: q } },
            { lead: { leadCode: { contains: q } } },
            { guardians: { some: { guardian: { fullName: { contains: q } } } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        lead: true,
        guardians: {
          include: { guardian: { include: { user: true } } },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        enrollments: {
          include: { class: true },
          orderBy: [{ enrollDate: "desc" }],
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  const studentIds = items.map((item) => item.id);
  const charges = await prisma.charge.findMany({
    where: { studentId: { in: studentIds } },
    select: {
      id: true,
      studentId: true,
      totalAmount: true,
    },
  });

  const allocations = await prisma.paymentAllocation.findMany({
    where: { charge: { studentId: { in: studentIds } } },
    select: { chargeId: true, amount: true },
  });

  const chargeOwner = new Map(charges.map((charge) => [charge.id, charge.studentId]));
  const chargeByStudent = new Map<string, number>();
  for (const charge of charges) {
    chargeByStudent.set(charge.studentId, (chargeByStudent.get(charge.studentId) ?? 0) + charge.totalAmount);
  }

  const paidByStudent = new Map<string, number>();
  for (const allocation of allocations) {
    const studentId = chargeOwner.get(allocation.chargeId);
    if (!studentId) continue;
    paidByStudent.set(studentId, (paidByStudent.get(studentId) ?? 0) + allocation.amount);
  }

  const normalizedItems = items.map((item) => {
    const primaryGuardian = item.guardians.find((guardianLink) => guardianLink.isPrimary)?.guardian ?? item.guardians[0]?.guardian ?? null;
    const currentEnrollment = item.enrollments.find((enrollment) => enrollment.status === "ACTIVE") ?? item.enrollments[0] ?? null;
    return {
      ...item,
      primaryGuardian,
      currentClassName: currentEnrollment?.class.className ?? null,
      currentClassCode: currentEnrollment?.class.classCode ?? null,
      leadCode: item.lead?.leadCode ?? null,
      outstanding: (chargeByStudent.get(item.id) ?? 0) - (paidByStudent.get(item.id) ?? 0),
      enrollmentsCount: item.enrollments.length,
    };
  });

  return NextResponse.json({ items: normalizedItems, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { role, override } = await getUserRoleAndOverride(user.id, "students");
  if (!canCreateWithOverride("students", role, override)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo học viên mới" }, { status: 403 });
  }

  const body = await req.json();
  const { getValidBranchIdForCreation } = await import("@/lib/branch-filter");
  const branchId = await getValidBranchIdForCreation(body.branchId);

  if (!branchId) {
    return NextResponse.json({ error: "Không xác định được cơ sở" }, { status: 400 });
  }

  const fullName = String(body.fullName ?? "").trim();
  if (!fullName) return NextResponse.json({ error: "Thiếu họ tên học viên" }, { status: 400 });

  const studentCode = String(body.studentCode ?? "").trim() || `HV${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const existing = await prisma.student.findUnique({ where: { studentCode } });
  if (existing) return NextResponse.json({ error: "Mã học viên đã tồn tại" }, { status: 409 });

  const student = await prisma.student.create({
    data: {
      branchId,
      studentCode,
      fullName,
      leadId: body.leadId || null,
      gender: body.gender || null,
      dob: body.dob ? new Date(body.dob) : null,
      phone: body.phone || null,
      address: body.address || null,
      enrollDate: body.enrollDate ? new Date(body.enrollDate) : null,
      referredBy: body.referredBy || null,
      notes: body.notes || null,
      status: body.leaveDate ? "LEFT" : "ACTIVE",
      leaveDate: body.leaveDate ? new Date(body.leaveDate) : null,
    },
  });

  const synced = await syncStudentDerivedFields(student.id);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId,
      action: "create",
      entityType: "Student",
      entityId: student.id,
      after: JSON.stringify(synced ?? student),
    },
  });

  return NextResponse.json({ item: synced ?? student }, { status: 201 });
}
