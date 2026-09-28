"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { formatVnd } from "@/lib/export-utils";
import PayrollEmployeeDrawer from "@/components/payroll/PayrollEmployeeDrawer";
import type { EmployeeContractStatus } from "@/lib/server/payroll-rules";

type EmployeeRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  payMode: string;
  teachingHourlyRate: number | null;
  assistantHourlyRate: number | null;
  staffDailyRate: number | null;
  workStatus: string;
  dob: Date | null;
  hometown: string | null;
  permanentAddress: string | null;
  idNumber: string | null;
  idIssueDate: Date | null;
  idIssuePlace: string | null;
  resignDate: Date | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  latestContract: { contractNo: string | null; signDate: Date | null; expiryDate: Date | null; contractType: string | null; baseSalary: number | null } | null;
  contractStatus: string;
  // Cơ sở làm việc: một người có thể gắn nhiều cơ sở, cơ sở chính đứng đầu.
  primaryBranchId: string;
  branches: { id: string; name: string }[];
  allBranches: boolean;
};

function formatDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}

function contractStatusClass(status: string) {
  if (status === "Đã hết hạn HĐ") return "text-rose-700";
  if (status === "Sắp hết hạn HĐ") return "text-amber-700";
  return "text-[#94a3b8]";
}

export default function EmployeesTable({
  initialData,
  branchOptions,
  canEdit,
  canAddTimesheet,
}: {
  initialData: EmployeeRow[];
  branchOptions: { id: string; name: string }[];
  canEdit: boolean;
  canAddTimesheet: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Cho phép mở thẳng hồ sơ 1 người qua /employees?open=<id> — dùng cho các cảnh báo ở
  // nơi khác (vd "chưa cấu hình đơn giá" ở bảng lương) bấm được sang đúng người cần sửa,
  // thay vì chỉ báo tên rồi để nhân sự tự đi tìm.
  const searchParams = useSearchParams();
  useEffect(() => {
    const requested = searchParams.get("open");
    if (requested) setOpenId(requested);
  }, [searchParams]);
  const selected = initialData.find((item) => item.id === openId) ?? null;

  // Lọc theo từng cột ngay tại chỗ. Trước đây hàng lọc vẫn hiện nhưng KHÔNG nối vào
  // đâu cả (thiếu filterValues/onFilterChange) nên gõ gì bảng cũng không đổi.
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  function handleFilterChange(paramKey: string, value: string | null, extra?: Record<string, string | null>) {
    setColumnFilters((current) => {
      const next = { ...current };
      const apply = (key: string, raw: string | null) => {
        if (raw == null || raw === "") delete next[key];
        else next[key] = raw;
      };
      apply(paramKey, value);
      for (const [key, raw] of Object.entries(extra ?? {})) apply(key, raw);
      return next;
    });
  }

  const has = (value: string | null | undefined, needle: string) =>
    (value ?? "").toLowerCase().includes(needle.toLowerCase());
  const rows = initialData.filter((row) => {
    if (columnFilters.code && !has(row.employeeCode, columnFilters.code)) return false;
    if (columnFilters.name && !has(row.fullName, columnFilters.name)) return false;
    if (columnFilters.position && !has(row.position, columnFilters.position)) return false;
    if (columnFilters.branch && !row.branches.some((branch) => branch.id === columnFilters.branch)) return false;
    return true;
  });

  const columns: Column<EmployeeRow>[] = [
    {
      key: "employeeCode",
      label: "Mã NV",
      width: "110px",
      filter: { type: "text", paramKey: "code", placeholder: "Mã NV..." },
      render: (value) => <span className="font-mono text-sm font-semibold text-[#475569]">{value}</span>,
    },
    {
      key: "fullName",
      label: "Tên NV",
      width: "220px",
      filter: { type: "text", paramKey: "name", placeholder: "Tên nhân viên..." },
      render: (value, row) => (
        <div>
          <p className="text-sm font-semibold text-[#0f1729]">{value}</p>
          {row.workStatus === "RESIGNED" ? <p className="mt-0.5 text-xs font-bold text-[#94a3b8]">Đã nghỉ việc</p> : null}
        </div>
      ),
    },
    {
      key: "phone",
      label: "SĐT",
      width: "130px",
      render: (value) => <span className="text-sm text-ink">{value ?? "—"}</span>,
    },
    {
      key: "email",
      label: "Email",
      width: "180px",
      render: (value) => <span className="text-sm text-ink">{value ?? "—"}</span>,
    },
    {
      key: "position",
      label: "Vị trí",
      width: "140px",
      filter: { type: "text", paramKey: "position", placeholder: "Vị trí..." },
      render: (value) => <span className="text-sm text-ink">{value ?? "—"}</span>,
    },
    {
      key: "branches",
      label: "Cơ sở",
      width: "190px",
      // Chỉ hiện cột này khi trung tâm có từ 2 cơ sở trở lên — 1 cơ sở thì nó chỉ là
      // một cột lặp lại cùng một chữ.
      filter:
        branchOptions.length > 1
          ? {
              type: "select",
              paramKey: "branch",
              options: branchOptions.map((branch) => ({ value: branch.id, label: branch.name })),
            }
          : undefined,
      render: (_value, row) => {
        if (row.allBranches) {
          return (
            <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
              Tất cả cơ sở ({row.branches.length})
            </span>
          );
        }
        return (
          <div className="flex flex-wrap gap-1">
            {row.branches.map((branch) => (
              <span
                key={branch.id}
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  branch.id === row.primaryBranchId ? "bg-[#eef2ff] text-[#4338ca]" : "bg-[#f1f5f9] text-[#475569]"
                }`}
                title={branch.id === row.primaryBranchId ? "Cơ sở chính — nơi giữ hồ sơ" : "Cơ sở làm thêm"}
              >
                {branch.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "payMode",
      label: "Lương",
      width: "180px",
      render: (_value, row) => {
        const unit = row.payMode === "SESSION" ? "/ca" : "/giờ";
        return (
          <div className="space-y-0.5 text-xs text-ink-muted48">
            {row.teachingHourlyRate ? <p>Dạy: {formatVnd(row.teachingHourlyRate)}{unit}</p> : null}
            {row.assistantHourlyRate ? <p>TG: {formatVnd(row.assistantHourlyRate)}{unit}</p> : null}
            {row.staffDailyRate ? <p>HC: {formatVnd(row.staffDailyRate)}/công</p> : null}
            {!row.teachingHourlyRate && !row.assistantHourlyRate && !row.staffDailyRate ? <p>Chưa cấu hình</p> : null}
          </div>
        );
      },
    },
    {
      key: "latestContract",
      label: "Hợp đồng lao động",
      width: "220px",
      render: (_value, row) => (
        <div>
          <p className="text-xs text-[#475569]">
            Ký: {formatDate(row.latestContract?.signDate ?? null)} · Hạn: {formatDate(row.latestContract?.expiryDate ?? null)}
          </p>
          {row.contractStatus ? (
            <p className={`mt-0.5 text-xs font-bold ${contractStatusClass(row.contractStatus)}`}>{row.contractStatus}</p>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTableResponsive
        data={rows}
        columns={columns}
        filterValues={columnFilters}
        onFilterChange={handleFilterChange}
        searchable
        searchPlaceholder="Tìm theo tên, mã NV, SĐT..."
        showCountBadge={false}
        sortable
        selectable={false}
        emptyState={{ title: "Chưa có nhân viên", description: "Bấm \"Thêm nhân viên\" ở trên để tạo hồ sơ đầu tiên." }}
        rowKey="id"
        onRowClick={(row) => setOpenId(row.id)}
        primaryColumn="fullName"
        secondaryColumns={["employeeCode", "position", "latestContract"]}
      />

      {selected ? (
        <PayrollEmployeeDrawer
          open={Boolean(openId)}
          onClose={() => setOpenId(null)}
          headerSummary={{
            fullName: selected.fullName,
            employeeCode: selected.employeeCode,
            position: selected.position,
            contractStatus: selected.contractStatus as EmployeeContractStatus,
            sourceLabel: null,
          }}
          profile={{
            id: selected.id,
            employeeCode: selected.employeeCode,
            fullName: selected.fullName,
            position: selected.position,
            dob: selected.dob ? new Date(selected.dob).toISOString() : null,
            phone: selected.phone,
            email: selected.email,
            hometown: selected.hometown,
            permanentAddress: selected.permanentAddress,
            idNumber: selected.idNumber,
            idIssueDate: selected.idIssueDate ? new Date(selected.idIssueDate).toISOString() : null,
            idIssuePlace: selected.idIssuePlace,
            resignDate: selected.resignDate ? new Date(selected.resignDate).toISOString() : null,
            payMode: selected.payMode,
            teachingHourlyRate: selected.teachingHourlyRate,
            assistantHourlyRate: selected.assistantHourlyRate,
            staffDailyRate: selected.staffDailyRate,
            bankName: selected.bankName,
            bankAccountNumber: selected.bankAccountNumber,
            bankAccountHolder: selected.bankAccountHolder,
          }}
          canEditProfile={canEdit}
          canAddTimesheet={canAddTimesheet}
          payrollLine={null}
          canEditPayrollLine={false}
          assistant={null}
        />
      ) : null}
    </>
  );
}
