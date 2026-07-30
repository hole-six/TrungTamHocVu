import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const items = await prisma.guardian.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q } },
            { phone: { contains: q } },
            { user: { email: { contains: q } } },
            { students: { some: { student: { fullName: { contains: q } } } } },
            { leads: { some: { leadCode: { contains: q } } } },
          ],
        }
      : {},
    orderBy: { fullName: "asc" },
    include: {
      user: true,
      leads: { select: { id: true, leadCode: true }, take: 2, orderBy: { createdAt: "desc" } },
      students: {
        include: {
          student: {
            include: {
              lead: true,
              enrollments: { include: { class: true }, take: 1, orderBy: { enrollDate: "desc" } },
            },
          },
        },
        take: 2,
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
      _count: { select: { leads: true, students: true } },
    },
  });

  const studentIds = items.flatMap((item) => item.students.map((link) => link.student.id));
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
    portalEmail: item.user?.email ?? null,
    portalActive: item.user?.isActive ?? false,
    children: item.students.map((link) => ({
      id: link.student.id,
      fullName: link.student.fullName,
      leadCode: link.student.lead?.leadCode ?? null,
      className: link.student.enrollments[0]?.class.className ?? null,
      outstanding: (chargeByStudent.get(link.student.id) ?? 0) - (paidByStudent.get(link.student.id) ?? 0),
    })),
  }));

  return NextResponse.json({ items: normalizedItems });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canCreate("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo phụ huynh" }, { status: 403 });
  }

  const body = await req.json();
  const fullName = String(body.fullName ?? "").trim();
  if (!fullName) return NextResponse.json({ error: "Thiếu họ tên phụ huynh" }, { status: 400 });

  const guardian = await prisma.guardian.create({
    data: { fullName, phone: body.phone || null, address: body.address || null, notes: body.notes || null },
  });

  return NextResponse.json({ item: guardian }, { status: 201 });
}
