import NoPermission from "@/components/ui/NoPermission";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole , getAllowedHrTabs } from "@/lib/permissions";
import { canCreate, canUpdate, canView } from "@/lib/server/role-matrix";
import { buildPayrollEmployeeRows } from "@/lib/server/payroll-row-builder";
import { getCurrentBranchId } from "@/lib/branch-filter";
import PayrollWorkspace from "@/components/payroll/PayrollWorkspace";
import HrTabs from "@/components/hr/HrTabs";

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const VALID_FILTERS = new Set(["all", "missing-bank", "ready-bank", "missing-rate"]);

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: {
    period?: string;
    employeeId?: string;
    filter?: string;
    search?: string;
    position?: string;
    bonusFrom?: string;
    bonusTo?: string;
    totalAmountFrom?: string;
    totalAmountTo?: string;
    hasRateIssue?: string;
  };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if ((role === "TEACHER" || role === "TEACHING_ASSISTANT") && user?.employeeId) {
    redirect(`/payroll/employees/${user.employeeId}`);
  }

  if (!canView("hr", role)) return <NoPermission module="Bảng lương" hint="Nếu bạn là nhân sự có lương, phiếu lương của riêng bạn vẫn xem được ở mục Nhân sự." />;

  const canManageEmployees = canCreate("hr", role);
  const canManagePayrollRuns = canUpdate("hr", role);
  const canCreateTimesheet = canCreate("timesheet", role);

  const period = searchParams?.period && /^\d{4}-\d{2}$/.test(searchParams.period) ? searchParams.period : currentMonthString();
  const filter = searchParams?.filter && VALID_FILTERS.has(searchParams.filter) ? searchParams.filter : "all";
  const search = searchParams?.search?.trim() ?? "";
  const position = searchParams?.position?.trim() ?? "";
  const bonusFrom = searchParams?.bonusFrom?.trim() ?? "";
  const bonusTo = searchParams?.bonusTo?.trim() ?? "";
  const totalAmountFrom = searchParams?.totalAmountFrom?.trim() ?? "";
  const totalAmountTo = searchParams?.totalAmountTo?.trim() ?? "";
  const hasRateIssueFilter = searchParams?.hasRateIssue?.trim() ?? "";
  const activeBranchId = await getCurrentBranchId();

  // PayrollRun/PayrollLine chỉ còn là chỗ lưu các khoản cộng/trừ nhập tay của tháng —
  // không còn quy trình tạo/tính/duyệt/khóa nào ở đây. Vẫn cần id của run (nếu có) để
  // lấy đúng các khoản nhập tay của tháng đang xem.
  const run = await prisma.payrollRun.findFirst({
    where: { periodName: period, ...(activeBranchId ? { branchId: activeBranchId } : {}) },
    select: { id: true },
  });

  const hasTableFilter = Boolean(search) || Boolean(position);

  const [rows, branches, positionRows, matchingEmployeeIds] = await Promise.all([
    // Danh sách ĐẦY ĐỦ (không lọc search/position) — dùng cho totals/badge/eligibleEmployees
    // để các số liệu tổng không co lại theo ô tìm kiếm của riêng bảng nhân sự.
    buildPayrollEmployeeRows({
      branchId: activeBranchId,
      period,
      runId: run?.id ?? null,
      forceIncludeEmployeeId: searchParams?.employeeId ?? null,
    }),
    canManagePayrollRuns ? prisma.branch.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    // Danh sách vai trò cho ô lọc select — lấy KHÔNG lọc theo search/position hiện tại,
    // để dropdown luôn đủ lựa chọn thay vì co lại còn mỗi vai trò đang được lọc.
    prisma.employee.findMany({
      where: { ...(activeBranchId ? { branchId: activeBranchId } : {}), position: { not: null } },
      select: { position: true },
      distinct: ["position"],
    }),
    // ID nhân sự khớp `search`/`position` — lọc bằng Prisma `where` (contains/exact match),
    // không phải .filter() JS. Chỉ query khi có filter để tránh 1 query thừa.
    hasTableFilter
      ? prisma.employee.findMany({
          where: {
            ...(activeBranchId ? { branchId: activeBranchId } : {}),
            ...(search
              ? { OR: [{ fullName: { contains: search } }, { employeeCode: { contains: search } }, { position: { contains: search } }] }
              : {}),
            ...(position ? { position } : {}),
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  const positionOptions = Array.from(new Set(positionRows.map((item) => item.position).filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
  // Danh sách để HIỂN THỊ trong bảng — cùng dữ liệu tính sẵn trong `rows`, chỉ giữ lại
  // những nhân sự có id khớp câu query where ở trên (không tính lại từ đầu).
  let tableRows = matchingEmployeeIds
    ? (() => {
        const idSet = new Set(matchingEmployeeIds.map((item) => item.id));
        return rows.filter((row) => idSet.has(row.id) || row.id === searchParams?.employeeId);
      })()
    : rows;
  // bonus/totalAmount/hasRateIssue chỉ tồn tại SAU KHI buildPayrollEmployeeRows tính
  // xong (không phải cột thô trên Employee) — lọc bằng JS ở server, cùng cách
  // "computed-filter" đã dùng ở /students, sau bước khớp search/position ở trên.
  if (bonusFrom) tableRows = tableRows.filter((row) => row.bonus >= Number(bonusFrom));
  if (bonusTo) tableRows = tableRows.filter((row) => row.bonus <= Number(bonusTo));
  if (totalAmountFrom) tableRows = tableRows.filter((row) => row.totalAmount >= Number(totalAmountFrom));
  if (totalAmountTo) tableRows = tableRows.filter((row) => row.totalAmount <= Number(totalAmountTo));
  if (hasRateIssueFilter) tableRows = tableRows.filter((row) => (hasRateIssueFilter === "YES" ? row.hasRateIssue : !row.hasRateIssue));

  const initialEmployeeId =
    searchParams?.employeeId && rows.some((row) => row.id === searchParams.employeeId) ? searchParams.employeeId : null;

  const hrTabs = user ? await getAllowedHrTabs(user.id) : [];

  return (
    <div className="space-y-4">
      <HrTabs allowed={hrTabs} />
      <PayrollWorkspace
      rows={rows}
      tableRows={tableRows}
      period={period}
      branches={branches}
      initialEmployeeId={initialEmployeeId}
      initialFilter={filter as "all" | "missing-bank" | "ready-bank" | "missing-rate"}
      permissions={{ canManageEmployees, canManagePayrollRuns, canCreateTimesheet }}
      positionOptions={positionOptions}
      search={search}
      position={position}
    />
    </div>
  );
}
