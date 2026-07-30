import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";
import { LEAD_STATUSES } from "@/lib/server/lead-rules";
import { getBranchWhereClause } from "@/lib/branch-filter";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const where = {
    ...(await getBranchWhereClause(searchParams.get("branchId"))),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { leadCode: { contains: q } },
            { phone: { contains: q } },
            { guardian: { fullName: { contains: q } } },
            { student: { studentCode: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total, byStatus] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        guardian: { include: { user: true } },
        interestedClass: true,
        placementTests: { orderBy: { testDate: "desc" }, take: 1 },
        student: {
          include: {
            enrollments: { include: { class: true }, orderBy: { enrollDate: "desc" }, take: 1 },
          },
        },
      },
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({
      by: ["status"],
      where: user.branchId ? { branchId: user.branchId } : {},
      _count: { _all: true },
    }),
  ]);

  const studentIds = items.flatMap((item) => (item.student ? [item.student.id] : []));
  const charges = studentIds.length
    ? await prisma.charge.findMany({
        where: { studentId: { in: studentIds } },
        select: { id: true, studentId: true, totalAmount: true },
      })
    : [];
  const allocations = charges.length
    ? await prisma.paymentAllocation.findMany({
        where: { chargeId: { in: charges.map((charge) => charge.id) } },
        select: { chargeId: true, amount: true },
      })
    : [];

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

  const normalizedItems = items.map((item) => ({
    ...item,
    guardianName: item.guardian?.fullName ?? null,
    guardianPortalEmail: item.guardian?.user?.email ?? null,
    guardianPortalActive: item.guardian?.user?.isActive ?? false,
    convertedStudentCode: item.student?.studentDisplayId ?? item.student?.studentCode ?? null,
    convertedClassName: item.student?.enrollments[0]?.class.className ?? null,
    outstanding: item.student ? (chargeByStudent.get(item.student.id) ?? 0) - (paidByStudent.get(item.student.id) ?? 0) : null,
  }));

  const pipeline = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const row of byStatus) pipeline[row.status] = row._count._all;

  return NextResponse.json({ items: normalizedItems, total, page, pageSize, pipeline });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });
  const role = await getUserRole(user.id);
  if (!canCreate("leads", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo lead mới" }, { status: 403 });
  }

  const body = await req.json();
  const fullName = String(body.fullName ?? "").trim();
  if (!fullName) return NextResponse.json({ error: "Thiếu họ tên học viên tiềm năng" }, { status: 400 });

  const leadCode = String(body.leadCode ?? "").trim() || `LEAD${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const existingCode = await prisma.lead.findUnique({ where: { leadCode } });
  if (existingCode) return NextResponse.json({ error: "Mã lead đã tồn tại" }, { status: 409 });

  let guardianId: string | null = null;
  const guardianName = String(body.guardianName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (guardianName || phone) {
    const existingGuardian = phone ? await prisma.guardian.findFirst({ where: { phone } }) : null;
    const guardian =
      existingGuardian ??
      (await prisma.guardian.create({ data: { fullName: guardianName || "Chưa rõ", phone: phone || null } }));
    guardianId = guardian.id;
  }

  const lead = await prisma.lead.create({
    data: {
      branchId: user.branchId,
      leadCode,
      fullName,
      gender: body.gender || null,
      dob: body.dob ? new Date(body.dob) : null,
      guardianId,
      phone: phone || null,
      address: body.address || null,
      meetDate: body.meetDate ? new Date(body.meetDate) : new Date(),
      source: body.source || null,
      facebookParentName: body.facebookParentName || null,
      facebookLink: body.facebookLink || null,
      initialAssessment: body.initialAssessment || null,
      notes: body.notes || null,
      notes2: body.notes2 || null,
      expectedStartDate: body.expectedStartDate ? new Date(body.expectedStartDate) : null,
      interestedClassId: body.interestedClassId || null,
      status: LEAD_STATUSES.includes(body.status) ? body.status : "NEW",
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, branchId: user.branchId, action: "create", entityType: "Lead", entityId: lead.id, after: JSON.stringify(lead) },
  });

  return NextResponse.json({ item: lead }, { status: 201 });
}
