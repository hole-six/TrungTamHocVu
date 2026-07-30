import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getBranchWhereClause } from "@/lib/branch-filter";
import { getUserRole } from "@/lib/permissions";
import { canCreate } from "@/lib/server/role-matrix";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  // Áp dụng branch filter
  const branchWhere = await getBranchWhereClause(searchParams.get("branchId"));

  const where = {
    ...branchWhere,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { studentCode: { contains: q } },
            { phone: { contains: q } },
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
        enrollments: {
          where: { status: "ACTIVE" },
          include: { class: true },
          take: 1,
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canCreate("students", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền tạo học viên mới" }, { status: 403 });
  }

  const body = await req.json();
  
  // Lấy branchId hợp lệ (từ request hoặc user's branch)
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
      gender: body.gender || null,
      dob: body.dob ? new Date(body.dob) : null,
      phone: body.phone || null,
      address: body.address || null,
      enrollDate: body.enrollDate ? new Date(body.enrollDate) : null,
      referredBy: body.referredBy || null,
      notes: body.notes || null,
      status: "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId,
      action: "create",
      entityType: "Student",
      entityId: student.id,
      after: JSON.stringify(student),
    },
  });

  return NextResponse.json({ item: student }, { status: 201 });
}
