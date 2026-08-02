"use client";

import { exportSectionsToExcel } from "@/lib/export-utils";
import { PAYROLL_RUN_STATUS_LABEL } from "@/lib/server/payroll-rules";

type EmployeeRow = {
  employeeCode: string;
  fullName: string;
  position: string | null;
  teachingHours: number;
  teachingAmount: number;
  assistantHours: number;
  assistantAmount: number;
  staffDays: number;
  staffHours: number;
  sessionCount: number;
  timesheetEntryCount: number;
  contractStatus: string;
};

type RunRow = {
  periodName: string;
  status: string;
  lineCount: number;
  teachingHours: number;
  assistantHours: number;
  staffDays: number;
  totalAmount: number;
};

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function PayrollExportButton({
  fromDate,
  toDate,
  totals,
  employees,
  runs,
}: {
  fromDate: string;
  toDate: string;
  totals: { totalTeachingAmount: number; totalAssistantAmount: number; totalPayroll: number };
  employees: EmployeeRow[];
  runs: RunRow[];
}) {
  function handleExport() {
    exportSectionsToExcel(
      [
        {
          title: "Tong quan payroll",
          columns: [
            { key: "metric", label: "Chi so" },
            { key: "value", label: "Gia tri" },
          ],
          rows: [
            { metric: "Tu ngay", value: formatDate(fromDate) },
            { metric: "Den ngay", value: formatDate(toDate) },
            { metric: "Nhan su co phat sinh cong", value: employees.length },
            { metric: "Tien day", value: formatVnd(totals.totalTeachingAmount) },
            { metric: "Tien tro giang", value: formatVnd(totals.totalAssistantAmount) },
            { metric: "Tong cong day/TG", value: formatVnd(totals.totalPayroll) },
          ],
        },
        {
          title: "Cong phat sinh theo nhan su",
          columns: [
            { key: "employeeCode", label: "Ma NV" },
            { key: "fullName", label: "Ho ten" },
            { key: "position", label: "Vi tri" },
            { key: "teachingHours", label: "Gio day" },
            { key: "teachingAmount", label: "Tien day" },
            { key: "assistantHours", label: "Gio tro giang" },
            { key: "assistantAmount", label: "Tien tro giang" },
            { key: "staffDays", label: "Cong hanh chinh" },
            { key: "staffHours", label: "Gio hanh chinh" },
            { key: "sessionCount", label: "So buoi" },
            { key: "timesheetEntryCount", label: "So ngay cham cong" },
            { key: "contractStatus", label: "Trang thai HD" },
          ],
          rows: employees.map((item) => ({
            ...item,
            position: item.position ?? "",
            teachingAmount: formatVnd(item.teachingAmount),
            assistantAmount: formatVnd(item.assistantAmount),
          })),
        },
        {
          title: "Ky luong lien quan",
          columns: [
            { key: "periodName", label: "Ky" },
            { key: "status", label: "Trang thai" },
            { key: "lineCount", label: "So dong" },
            { key: "teachingHours", label: "Gio day" },
            { key: "assistantHours", label: "Gio TG" },
            { key: "staffDays", label: "Cong NV" },
            { key: "totalAmount", label: "Tong tien" },
          ],
          rows: runs.map((item) => ({
            ...item,
            status: PAYROLL_RUN_STATUS_LABEL[item.status as keyof typeof PAYROLL_RUN_STATUS_LABEL] ?? item.status,
            totalAmount: formatVnd(item.totalAmount),
          })),
        },
      ],
      `payroll_${fromDate}_${toDate}`,
      "Payroll",
    );
  }

  return (
    <button onClick={handleExport} className="btn-ghost">
      Xuất Excel
    </button>
  );
}
