import NoPermission from "@/components/ui/NoPermission";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRoleAndOverride , getAllowedHrTabs } from "@/lib/permissions";
import { canCreateWithOverride, canUpdateWithOverride, canViewWithOverride } from "@/lib/server/role-matrix";
import { computeContractStatus } from "@/lib/server/payroll-rules";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { employeeBranchFilter } from "@/lib/server/employee-branches";
import EmployeesTable from "./EmployeesTable";
import NewEmployeeForm from "@/components/payroll/NewEmployeeForm";
import HrTabs from "@/components/hr/HrTabs";
import PageGuide from "@/components/ui/PageGuide";

const EMPLOYEES_GUIDE_SECTIONS = [
  {
    title: "Màn hình này để làm gì?",
    items: [
      "Giữ hồ sơ toàn bộ nhân sự: giáo viên, trợ giảng, giáo vụ, kế toán.",
      "Khai ĐƠN GIÁ dạy và đơn giá trợ giảng của từng người — bảng lương lấy thẳng từ đây.",
      "Đổi trạng thái làm việc khi có người nghỉ; người đã nghỉ sẽ không xếp được vào buổi học sau ngày nghỉ.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cần nhớ",
    items: [
      "Thiếu đơn giá thì buổi dạy vẫn gán được nhưng lương buổi đó ra 0đ — kiểm tra trước khi chốt lương.",
      "Mỗi người một tài khoản riêng để truy được ai đã thao tác gì trong hệ thống.",
    ],
    tone: "warning" as const,
  },
];

// Trang "NHÂN SỰ" — trước đây hoàn toàn chưa có (chỉ có form thêm/sửa nhân viên
// nhúng trong /payroll, không có 1 danh sách riêng cho thông tin nhân sự cơ bản:
// mã NV/tên/SĐT/email/vị trí/lương/ngày ký-hết hạn HĐ). Độc lập với tháng lương —
// đây là thông tin nhân sự tĩnh, không nên gắn với 1 tháng lương cụ thể như /payroll.
export default async function EmployeesPage() {
  const user = await getCurrentUser();
  if (!user) notFound();
  const { role, override } = await getUserRoleAndOverride(user.id, "hr");
  if (!canViewWithOverride("hr", role, override)) return <NoPermission module="Hồ sơ nhân sự" />;

  const activeBranchId = await getCurrentBranchId();
  // Nhân sự của cơ sở đang xem = hồ sơ ở đây HOẶC được gắn thêm cơ sở này. Một người
  // gắn nhiều cơ sở vẫn chỉ có MỘT hồ sơ, nhưng phải nhìn thấy được ở mọi nơi họ làm.
  const [employees, allBranches] = await Promise.all([
    prisma.employee.findMany({
      where: employeeBranchFilter(activeBranchId),
      orderBy: { fullName: "asc" },
      include: {
        contracts: { orderBy: { signDate: "desc" }, take: 1 },
        branch: { select: { id: true, name: true } },
        branchLinks: { select: { branch: { select: { id: true, name: true } } } },
      },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true } }),
  ]);

  const items = employees.map(({ contracts, branch, branchLinks, ...employee }) => {
    const linked = branchLinks.map((link) => link.branch);
    const seen = new Set<string>();
    const branches = [branch, ...linked].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return {
      ...employee,
      latestContract: contracts[0] ?? null,
      contractStatus: computeContractStatus(employee.resignDate, contracts[0]?.expiryDate ?? null),
      primaryBranchId: branch.id,
      branches,
      // "Gắn full cơ sở" hiển thị gọn thành 1 nhãn thay vì liệt kê dài dòng.
      allBranches: allBranches.length > 1 && branches.length === allBranches.length,
    };
  });

  const hrTabs = await getAllowedHrTabs(user.id);

  return (
    <div className="space-y-4">
      <PageGuide
        title="Guide nhân sự"
        summary="Cách quản lý hồ sơ nhân sự, đơn giá dạy/trợ giảng và trạng thái làm việc."
        sections={EMPLOYEES_GUIDE_SECTIONS}
        buttonLabel="Hướng dẫn"
      />
      <HrTabs allowed={hrTabs} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black tracking-tight text-[#0f1729] sm:text-2xl">Nhân sự</h1>
        {canCreateWithOverride("hr", role, override) ? <NewEmployeeForm /> : null}
      </div>

      <EmployeesTable
        initialData={items}
        branchOptions={allBranches}
        canEdit={canUpdateWithOverride("hr", role, override)}
        canAddTimesheet={canUpdateWithOverride("hr", role, override)}
      />
    </div>
  );
}
