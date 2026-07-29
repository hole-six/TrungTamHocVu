import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { LEAD_STATUSES } from "@/lib/server/lead-rules";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const where = {
    ...(user.branchId ? { branchId: user.branchId } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [{ fullName: { contains: q } }, { leadCode: { contains: q } }, { phone: { contains: q } }],
        }
      : {}),
  };

  const [items, total, byStatus] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { guardian: true, placementTests: { orderBy: { testDate: "desc" }, take: 1 }, student: true },
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({
      by: ["status"],
      where: user.branchId ? { branchId: user.branchId } : {},
      _count: { _all: true },
    }),
  ]);

  const pipeline = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const row of byStatus) pipeline[row.status] = row._count._all;

  return NextResponse.json({ items, total, page, pageSize, pipeline });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!user.branchId) return NextResponse.json({ error: "Tài khoản chưa gán chi nhánh" }, { status: 400 });

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
      status: "NEW",
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, branchId: user.branchId, action: "create", entityType: "Lead", entityId: lead.id, after: JSON.stringify(lead) },
  });

  return NextResponse.json({ item: lead }, { status: 201 });
}
