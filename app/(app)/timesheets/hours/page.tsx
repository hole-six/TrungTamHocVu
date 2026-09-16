import NoPermission from "@/components/ui/NoPermission";
import HrTabs from "@/components/hr/HrTabs";
import StaffHoursWorkspace from "@/components/timesheets/StaffHoursWorkspace";
import { getCurrentUser } from "@/lib/server/current-user";
import { getAllowedHrTabs, getUserRole } from "@/lib/permissions";
import { canUpdate, canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { getVietnamToday } from "@/lib/server/class-rules";
import { computeStaffHours } from "@/lib/server/staff-hours";

// BẢNG GIỜ DỰ KIẾN & THỰC TẾ — trả lời 2 câu hỏi vận hành: tuần/tháng này ai làm hụt hay
// vượt giờ dự kiến và vì sao; ai chưa đủ định mức giờ hợp đồng để xếp thêm lớp thay vì
// thuê ngoài. Quy tắc tính ở lib/server/staff-hours.ts.
export default async function StaffHoursPage({ searchParams }: { searchParams?: { month?: string } }) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("timesheet", role)) return <NoPermission module="Chấm công" />;

  const month =
    searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month)
      ? searchParams.month
      : getVietnamToday().toISOString().slice(0, 7);
  const branchId = await getCurrentBranchId();
  const data = await computeStaffHours({ month, branchId });
  const hrTabs = user ? await getAllowedHrTabs(user.id) : [];

  return (
    <div className="space-y-4">
      <HrTabs allowed={hrTabs} />
      <StaffHoursWorkspace
        month={data.month}
        weeks={data.weeks}
        rows={data.rows}
        canEdit={canUpdate("timesheet", role)}
      />
    </div>
  );
}
