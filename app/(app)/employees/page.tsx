import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride } from "@/lib/permissions";
import { canCreateWithOverride, canUpdateWithOverride, canViewWithOverride } from "@/lib/server/role-matrix";
import { computeContractStatus } from "@/lib/server/payroll-rules";
import { getCurrentBranchId } from "@/lib/branch-filter";
import EmployeesTable from "./EmployeesTable";
import NewEmployeeForm from "@/components/payroll/NewEmployeeForm";

// Trang "NHÂN SỰ" — trước đây hoàn toàn chưa có (chỉ có form thêm/sửa nhân viên
// nhúng trong /payroll, không có 1 danh sách riêng cho thông tin nhân sự cơ bản:
// mã NV/tên/SĐT/email/vị trí/lương/ngày ký-hết hạn HĐ). Độc lập với kỳ lương —
// đây là thông tin nhân sự tĩnh, không nên gắn với 1 kỳ lương cụ thể như /payroll.
export default async function EmployeesPage() {
  const user = await getCurrentUser();
  if (!user) notFound();
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canViewWithOverride("hr", role, override)) notFound();

  const activeBranchId = await getCurrentBranchId();
  const employees = await prisma.employee.findMany({
    where: activeBranchId ? { branchId: activeBranchId } : {},
    orderBy: { fullName: "asc" },
    include: { contracts: { orderBy: { signDate: "desc" }, take: 1 } },
  });

  const items = employees.map(({ contracts, ...employee }) => ({
    ...employee,
    latestContract: contracts[0] ?? null,
    contractStatus: computeContractStatus(employee.resignDate, contracts[0]?.expiryDate ?? null),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0f1729]">Nhân sự</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#64748b]">
            Mã NV, tên, liên hệ, vị trí, lương và hợp đồng lao động — độc lập với từng kỳ lương cụ thể.
          </p>
        </div>
        {canCreateWithOverride("hr", role, override) ? <NewEmployeeForm /> : null}
      </div>

      <EmployeesTable
        initialData={items}
        canEdit={canUpdateWithOverride("hr", role, override)}
        canAddTimesheet={canUpdateWithOverride("hr", role, override)}
      />
    </div>
  );
}
