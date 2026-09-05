"use client";

import { useState } from "react";
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
};

function formatDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}

function contractStatusClass(status: string) {
  if (status === "Đã hết hạn HĐ") return "bg-red-100 text-red-700 border-red-200";
  if (status === "Sắp hết hạn HĐ") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "Nghỉ ngang") return "bg-slate-100 text-slate-600 border-slate-200";
  return "";
}

export default function EmployeesTable({
  initialData,
  canEdit,
  canAddTimesheet,
}: {
  initialData: EmployeeRow[];
  canEdit: boolean;
  canAddTimesheet: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = initialData.find((item) => item.id === openId) ?? null;

  const columns: Column<EmployeeRow>[] = [
    {
      key: "employeeCode",
      label: "Mã NV",
      width: "110px",
      filter: { type: "text", paramKey: "code", placeholder: "Mã NV..." },
      render: (value) => <span className="font-mono text-sm font-semibold text-primary">{value}</span>,
    },
    {
      key: "fullName",
      label: "Tên NV",
      width: "220px",
      filter: { type: "text", paramKey: "name", placeholder: "Tên nhân viên..." },
      render: (value, row) => (
        <div>
          <p className="text-sm font-semibold text-ink">{value}</p>
          {row.workStatus === "RESIGNED" ? (
            <span className="mt-0.5 inline-flex rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Đã nghỉ việc</span>
          ) : null}
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
        <div className="space-y-1">
          <p className="text-xs text-ink">
            Ký: {formatDate(row.latestContract?.signDate ?? null)} · Hạn: {formatDate(row.latestContract?.expiryDate ?? null)}
          </p>
          {row.contractStatus ? (
            <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-bold ${contractStatusClass(row.contractStatus)}`}>{row.contractStatus}</span>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTableResponsive
        data={initialData}
        columns={columns}
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
