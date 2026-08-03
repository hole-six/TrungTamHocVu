"use client";

import { exportSectionsToExcel } from "@/lib/export-utils";
import { PAYROLL_RUN_STATUS_LABEL } from "@/lib/server/payroll-rules";

type EmployeeRow = {
  employeeCode: string;
  fullName: string;
  position: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  payMode: string;
  teachingHours: number;
  teachingAmount: number;
  assistantHours: number;
  assistantAmount: number;
  staffDays: number;
  staffHours: number;
  staffDailyRate: number | null;
  staffAmount: number;
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
  totals: { totalTeachingAmount: number; totalAssistantAmount: number; totalStaffAmount: number; totalPayroll: number };
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
            { metric: "Tien cong hanh chinh", value: formatVnd(totals.totalStaffAmount) },
            { metric: "Tong payroll", value: formatVnd(totals.totalPayroll) },
          ],
        },
        {
          title: "Cong phat sinh theo nhan su",
          columns: [
            { key: "employeeCode", label: "Ma NV" },
            { key: "fullName", label: "Ho ten" },
            { key: "position", label: "Vi tri" },
            { key: "payMode", label: "Kieu tinh day/TG" },
            { key: "teachingHours", label: "Gio day" },
            { key: "teachingAmount", label: "Tien day" },
            { key: "assistantHours", label: "Gio tro giang" },
            { key: "assistantAmount", label: "Tien tro giang" },
            { key: "staffDays", label: "Cong hanh chinh" },
            { key: "staffHours", label: "Gio hanh chinh" },
            { key: "staffDailyRate", label: "Don gia 1 cong" },
            { key: "staffAmount", label: "Tien cong HC" },
            { key: "sessionCount", label: "So buoi" },
            { key: "timesheetEntryCount", label: "So ngay cham cong" },
            { key: "contractStatus", label: "Trang thai HD" },
          ],
          rows: employees.map((item) => ({
            ...item,
            position: item.position ?? "",
            payMode: item.payMode === "SESSION" ? "Theo ca" : "Theo gio",
            teachingAmount: formatVnd(item.teachingAmount),
            assistantAmount: formatVnd(item.assistantAmount),
            staffDailyRate: item.staffDailyRate != null ? formatVnd(item.staffDailyRate) : "",
            staffAmount: formatVnd(item.staffAmount),
          })),
        },
        {
          title: "Danh sach chuyen khoan nhanh",
          columns: [
            { key: "employeeCode", label: "Ma NV" },
            { key: "fullName", label: "Ho ten" },
            { key: "bankName", label: "Ngan hang" },
            { key: "bankAccountNumber", label: "So tai khoan" },
            { key: "bankAccountHolder", label: "Chu tai khoan" },
            { key: "amount", label: "So tien" },
            { key: "transferNote", label: "Noi dung CK" },
            { key: "note", label: "Ghi chu" },
          ],
          rows: employees.map((item) => ({
            employeeCode: item.employeeCode,
            fullName: item.fullName,
            bankName: item.bankName ?? "",
            bankAccountNumber: item.bankAccountNumber ?? "",
            bankAccountHolder: item.bankAccountHolder ?? item.fullName,
            amount: formatVnd(item.teachingAmount + item.assistantAmount + item.staffAmount),
            transferNote: `Luong ${fromDate}_${toDate} - ${item.fullName}`,
            note: item.bankName && item.bankAccountNumber ? "" : "Thieu thong tin chuyen khoan",
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
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
    >
      Xuất Excel tổng hợp
    </button>
  );
}
