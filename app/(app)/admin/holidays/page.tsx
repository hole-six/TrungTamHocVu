import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import HolidayManager from "@/components/admin/HolidayManager";

export default async function HolidaysAdminPage() {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  const canSee = canView("schedule", role);
  const activeBranchId = await getCurrentBranchId();

  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const holidays = canSee
    ? await prisma.holiday.findMany({
        orderBy: { date: "asc" },
        include: { branch: { select: { name: true } } },
      })
    : [];

  const defaultBranchId = activeBranchId ?? branches[0]?.id ?? "";

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
        <HolidayManager
          holidays={holidays.map((h) => ({ id: h.id, date: h.date, name: h.name, branch: h.branch }))}
          branches={branches}
          defaultBranchId={defaultBranchId}
        />
      ) : (
        <div className="card text-center text-sm text-ink-muted48">Bạn không có quyền xem mục này.</div>
      )}
    </div>
  );
}
