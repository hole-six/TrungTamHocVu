import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import HolidayManager from "@/components/admin/HolidayManager";

const PAGE_SIZE = 30;

export default async function HolidaysAdminPage({
  searchParams,
}: {
  searchParams: { q?: string; branchId?: string; year?: string; page?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const canSee = canView("schedule", role);
  const activeBranchId = await getCurrentBranchId();

  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const q = searchParams.q?.trim() ?? "";
  const branchFilter = searchParams.branchId?.trim() ?? "";
  const year = searchParams.year?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);

  // Lọc + phân trang ở backend — bảng này không lớn (vài chục ngày lễ/năm/cơ sở) nhưng
  // vẫn theo đúng nguyên tắc chung: mọi tham số tìm kiếm/trang đi qua URL, không tự lấy
  // hết dữ liệu rồi lọc bằng JS ở trình duyệt.
  const where: Record<string, unknown> = {};
  if (q) where.name = { contains: q };
  if (branchFilter) where.branchId = branchFilter;
  if (year && /^\d{4}$/.test(year)) {
    const y = Number(year);
    where.date = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
  }

  const [total, holidays] = canSee
    ? await Promise.all([
        prisma.holiday.count({ where }),
        prisma.holiday.findMany({
          where,
          orderBy: { date: "asc" },
          include: { branch: { select: { name: true } } },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
      ])
    : [0, []];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const defaultBranchId = activeBranchId ?? branches[0]?.id ?? "";
  const hasFilter = Boolean(q || branchFilter || year);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Ngày nghỉ lễ</h1>
          <p className="mt-1 text-sm text-ink-muted48">
            Ngày trùng lịch học sẽ tự động bỏ qua khi sinh buổi học và khi tính ngày kết thúc dự kiến của lớp.
          </p>
        </div>
        <Link href="/admin" className="btn-ghost">
          ← Quay lại Quản trị
        </Link>
      </div>

      {canSee ? (
        <>
          <div className="card">
            <form action="/admin/holidays" method="GET" className="flex flex-wrap items-end gap-3">
              <label className="form-group min-w-[200px] flex-1">
                <span className="label-sm">Tìm theo tên ngày lễ</span>
                <input type="search" name="q" defaultValue={q} placeholder="Ví dụ: Giỗ Tổ Hùng Vương..." className="input" />
              </label>
              <label className="form-group">
                <span className="label-sm">Cơ sở</span>
                <select name="branchId" defaultValue={branchFilter} className="input">
                  <option value="">Tất cả cơ sở</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span className="label-sm">Năm</span>
                <input type="number" name="year" defaultValue={year} placeholder="VD: 2026" className="input w-28" />
              </label>
              <button type="submit" className="btn-primary">
                Lọc
              </button>
              {hasFilter ? (
                <Link href="/admin/holidays" className="btn-ghost">
                  Xóa lọc
                </Link>
              ) : null}
            </form>
          </div>

          <HolidayManager
            holidays={holidays.map((h) => ({ id: h.id, date: h.date, name: h.name, branch: h.branch }))}
            branches={branches}
            defaultBranchId={defaultBranchId}
            total={total}
            page={page}
            pageCount={pageCount}
            searchParams={{ q: searchParams.q, branchId: searchParams.branchId, year: searchParams.year }}
          />
        </>
      ) : (
        <div className="card text-center text-sm text-ink-muted48">Bạn không có quyền xem mục này.</div>
      )}
    </div>
  );
}
