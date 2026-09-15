import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate, canView } from "@/lib/server/role-matrix";
import { canAccessBranch, getBranchWhereClause, getValidBranchIdForCreation } from "@/lib/branch-filter";
import { applyHolidayClosure, planHolidayClosure } from "@/lib/server/session-cancellation";

// GET ?month=YYYY-MM&branchId= : ngày nghỉ trong tháng + số buổi học mỗi ngày (cho lịch chọn ngày).
// Không có month: danh sách ngày nghỉ như cũ.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canView("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền xem lịch nghỉ lễ" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const branchId = searchParams.get("branchId") ?? "";
    if (!branchId || !(await canAccessBranch(branchId))) {
      return NextResponse.json({ error: "Không có quyền truy cập cơ sở này" }, { status: 403 });
    }
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    const [holidays, sessions] = await Promise.all([
      prisma.holiday.findMany({
        where: { branchId, date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
        include: { _count: { select: { cancelledSessions: true } } },
      }),
      prisma.classSession.groupBy({
        by: ["sessionDate"],
        where: { class: { branchId }, sessionDate: { gte: start, lte: end }, status: { notIn: ["CANCELLED", "RESCHEDULED"] } },
        _count: { _all: true },
      }),
    ]);
    return NextResponse.json({
      holidays: holidays.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), name: h.name, cancelledSessions: h._count.cancelledSessions })),
      sessionCountByDate: Object.fromEntries(sessions.map((s) => [s.sessionDate.toISOString().slice(0, 10), s._count._all])),
    });
  }

  const branchWhere = await getBranchWhereClause(searchParams.get("branchId"));
  const items = await prisma.holiday.findMany({
    where: branchWhere,
    orderBy: { date: "asc" },
    include: { branch: { select: { name: true } } },
  });
  return NextResponse.json({ items });
}

// POST { branchId, dates: ["YYYY-MM-DD", ...] | date, name, confirm? }
//   không confirm → xem trước các buổi sẽ cho nghỉ / bỏ qua;
//   confirm: true → khai ngày nghỉ + cho nghỉ các buổi + nối thêm buổi cuối khóa.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền khai báo ngày nghỉ" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const branchId = await getValidBranchIdForCreation(body.branchId);
  if (!branchId) return NextResponse.json({ error: "Không xác định được cơ sở" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const dateKeys: string[] = (Array.isArray(body.dates) ? body.dates : body.date ? [body.date] : [])
    .map((d: unknown) => String(d).trim())
    .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .slice(0, 62);
  if (dateKeys.length === 0) return NextResponse.json({ error: "Chưa chọn ngày nghỉ nào" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Nhập lý do nghỉ (vd: Nghỉ lễ Quốc khánh)" }, { status: 400 });

  if (!body.confirm) {
    const plan = await planHolidayClosure(prisma, { branchId, dateKeys });
    return NextResponse.json({ plan });
  }

  const result = await applyHolidayClosure({ branchId, dateKeys, name });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId,
      action: "holiday_closure",
      entityType: "Holiday",
      entityId: result.dates[0] ?? "",
      after: JSON.stringify({ name, dates: result.dates, cancelled: result.cancelCount, classes: result.classCount, extended: result.extended }),
    },
  });
  return NextResponse.json({ ok: true, result }, { status: 201 });
}
