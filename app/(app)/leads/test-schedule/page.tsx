import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { notFound } from "next/navigation";
import LeadTestFilters from "@/components/leads/LeadTestFilters";
import TestScheduleTable from "@/components/leads/TestScheduleTable";

const PAGE_SIZE = 30;

export default async function TestSchedulePage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; meetFrom?: string; meetTo?: string; testStatus?: string; leadStatus?: string };
}) {
  const user = await getCurrentUser();
  const userRole = user ? await getUserRole(user.id) : null;
  if (!canView("leads", userRole)) notFound();

  const q = searchParams.q?.trim() ?? "";
  const testStatus = searchParams.testStatus?.trim() ?? "";
  const leadStatus = searchParams.leadStatus?.trim() ?? "";
  const meetFrom = searchParams.meetFrom ? new Date(searchParams.meetFrom) : null;
  const meetTo = searchParams.meetTo ? new Date(searchParams.meetTo) : null;
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const where = {
    ...(user?.branchId ? { branchId: user.branchId } : {}),
    ...(leadStatus ? { status: leadStatus } : {}),
    ...(testStatus === "NONE" ? { placementTests: { none: {} } } : testStatus ? { placementTests: { some: { status: testStatus } } } : {}),
    ...(meetFrom || meetTo
      ? { meetDate: { ...(meetFrom ? { gte: meetFrom } : {}), ...(meetTo ? { lte: new Date(meetTo.getTime() + 24 * 60 * 60 * 1000 - 1) } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { leadCode: { contains: q } },
            { phone: { contains: q } },
            { secondaryPhone: { contains: q } },
            { guardian: { fullName: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { meetDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        guardian: true,
        interestedClass: true,
        placementTests: { orderBy: { createdAt: "desc" }, take: 1 },
        student: { select: { studentCode: true, studentDisplayId: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  const phones = [...new Set(items.flatMap((item) => [item.phone, item.secondaryPhone]).filter((p): p is string => !!p))];
  const duplicatePhoneLeads = phones.length
    ? await prisma.lead.findMany({
        where: { OR: [{ phone: { in: phones } }, { secondaryPhone: { in: phones } }], id: { notIn: items.map((i) => i.id) } },
        select: { id: true, fullName: true, phone: true, secondaryPhone: true },
      })
    : [];
  const duplicatesByPhone = new Map<string, string[]>();
  for (const l of duplicatePhoneLeads) {
    for (const p of [l.phone, l.secondaryPhone]) {
      if (!p) continue;
      duplicatesByPhone.set(p, [...(duplicatesByPhone.get(p) ?? []), l.fullName]);
    }
  }

  const normalizedItems = items.map((item) => {
    const dupNames = new Set<string>();
    for (const p of [item.phone, item.secondaryPhone]) {
      if (!p) continue;
      for (const name of duplicatesByPhone.get(p) ?? []) dupNames.add(name);
    }
    return { ...item, latestPlacementTest: item.placementTests[0] ?? null, duplicatePhoneNames: [...dupNames] };
  });

  const missingTestCount = await prisma.lead.count({
    where: { ...(user?.branchId ? { branchId: user.branchId } : {}), status: { notIn: ["ENROLLED", "LOST"] }, placementTests: { none: {} } },
  });

  // Danh sách lớp để chọn "Lớp dự kiến" — chỉ lấy trong danh mục lớp có sẵn (không
  // cho gõ tay tự do nữa), rỗng thì để trống chứ không suy đoán/tạo lớp mới ở đây.
  const classOptions = await prisma.class.findMany({
    where: { ...(user?.branchId ? { branchId: user.branchId } : {}), status: "ACTIVE" },
    select: { id: true, className: true },
    orderBy: { className: "asc" },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soonBoundary = new Date(today);
  soonBoundary.setDate(soonBoundary.getDate() + 3);
  soonBoundary.setHours(23, 59, 59, 999);
  const branchLeadFilter = user?.branchId ? { branchId: user.branchId } : {};
  const [overdueCount, soonCount] = await Promise.all([
    prisma.placementTest.count({ where: { status: "SCHEDULED", scheduledDate: { lt: today }, lead: branchLeadFilter } }),
    prisma.placementTest.count({ where: { status: "SCHEDULED", scheduledDate: { gte: today, lte: soonBoundary }, lead: branchLeadFilter } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/leads" className="text-sm text-primary">
            ← Về CRM tuyển sinh
          </Link>
          <h1 className="page-title mt-1">Danh sách test</h1>
          <p className="page-subtitle">Sổ hẹn test chủ động — nhân viên gọi điện hẹn phụ huynh, nhập lại vào đây. {total} học sinh.</p>
        </div>
        <Link href="/leads/new?returnTo=/leads/test-schedule" className="btn-primary shrink-0">
          + Thêm mới
        </Link>
      </div>

      {(overdueCount > 0 || soonCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueCount > 0 && (
            <Link
              href="/leads/test-schedule?testStatus=SCHEDULED"
              className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <circle cx="12" cy="16" r="0.5" fill="currentColor" />
                </svg>
              </span>
              {overdueCount} lịch hẹn test đã QUÁ HẠN — chưa ghi nhận kết quả
            </Link>
          )}
          {soonCount > 0 && (
            <Link
              href="/leads/test-schedule?testStatus=SCHEDULED"
              className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              {soonCount} lịch hẹn test sắp tới trong 3 ngày
            </Link>
          )}
        </div>
      )}

      <LeadTestFilters
        q={q}
        meetFrom={searchParams.meetFrom ?? ""}
        meetTo={searchParams.meetTo ?? ""}
        testStatus={testStatus}
        leadStatus={leadStatus}
        missingTestCount={missingTestCount}
      />

      <TestScheduleTable items={normalizedItems} total={total} page={page} pageSize={PAGE_SIZE} searchQuery={q} classOptions={classOptions} />
    </div>
  );
}
