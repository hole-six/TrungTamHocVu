"use client";

import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";
import { exportSectionsToExcel, formatVnd } from "@/lib/export-utils";
import type { PayrollEmployeeRow } from "@/lib/server/payroll-row-builder";

function formatMonthLabel(period: string) {
  const [year, month] = period.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

// Duy nhất 1 nút xuất Excel cho cả trang (nút "xuất đẹp" cũ ở khu vực tháng lương đã bỏ vì
// trùng lặp, không thêm được thông tin gì mới) — nên xuất phải đầy đủ nhất có thể, đủ để
// dùng độc lập mà không cần mở lại ứng dụng.
export default function PayrollExportButton({
  period,
  rows,
  totals,
}: {
  period: string;
  rows: PayrollEmployeeRow[];
  totals: {
    totalTeachingHours: number;
    totalTeachingAmount: number;
    totalAssistantHours: number;
    totalAssistantAmount: number;
    totalStaffDays: number;
    totalStaffHours: number;
    totalStaffAmount: number;
    totalPayroll: number;
    sessionCount: number;
    timesheetEntryCount: number;
  };
}) {
  function handleExport() {
    const totalBonus = rows.reduce((sum, row) => sum + row.bonus, 0);
    const totalPenalty = rows.reduce((sum, row) => sum + row.penalty, 0);
    const missingBankCount = rows.filter((row) => !row.hasBankInfo).length;

    exportSectionsToExcel(
      [
        {
          title: "Tổng quan",
          columns: [
            { key: "chiSo", label: "Chỉ số" },
            { key: "giaTri", label: "Giá trị" },
          ],
          rows: [
            { chiSo: "Tháng lương", giaTri: formatMonthLabel(period) },
            { chiSo: "Nguồn số liệu", giaTri: "Tính trực tiếp từ buổi dạy, trợ giảng và chấm công của tháng" },
            { chiSo: "Tổng số nhân sự có phát sinh", giaTri: String(rows.length) },
            { chiSo: "Tổng số buổi dạy/trợ giảng", giaTri: String(totals.sessionCount) },
            { chiSo: "Tổng số ngày công hành chính", giaTri: String(totals.timesheetEntryCount) },
            { chiSo: "Tiền dạy", giaTri: formatVnd(totals.totalTeachingAmount) },
            { chiSo: "Tiền trợ giảng", giaTri: formatVnd(totals.totalAssistantAmount) },
            { chiSo: "Tiền công hành chính (lương cứng)", giaTri: formatVnd(totals.totalStaffAmount) },
            { chiSo: "Tổng thưởng", giaTri: formatVnd(totalBonus) },
            { chiSo: "Tổng phạt", giaTri: formatVnd(totalPenalty) },
            { chiSo: "Tổng quỹ lương (thực nhận)", giaTri: formatVnd(totals.totalPayroll) },
            { chiSo: "Số người còn thiếu thông tin chuyển khoản", giaTri: String(missingBankCount) },
          ],
        },
        {
          title: "Bảng lương chi tiết",
          columns: [
            { key: "employeeCode", label: "Mã NV" },
            { key: "fullName", label: "Họ tên" },
            { key: "position", label: "Vị trí" },
            { key: "workStatus", label: "Trạng thái làm việc" },
            { key: "contractStatus", label: "Trạng thái hợp đồng" },
            { key: "payMode", label: "Kiểu tính công" },
            { key: "teachingHourlyRate", label: "Đơn giá dạy" },
            { key: "teachingHours", label: "Giờ/ca dạy" },
            { key: "teachingAmount", label: "Tiền dạy" },
            { key: "assistantHourlyRate", label: "Đơn giá trợ giảng" },
            { key: "assistantHours", label: "Giờ/ca trợ giảng" },
            { key: "assistantAmount", label: "Tiền trợ giảng" },
            { key: "staffDailyRate", label: "Đơn giá 1 công HC" },
            { key: "staffDays", label: "Công hành chính" },
            { key: "staffHours", label: "Giờ chấm công HC" },
            { key: "baseSalaryAmount", label: "Lương cứng" },
            { key: "bonus", label: "Thưởng" },
            { key: "penalty", label: "Phạt" },
            { key: "totalAmount", label: "Tổng lương" },
            { key: "dataSource", label: "Nguồn số liệu" },
            { key: "notes", label: "Ghi chú" },
          ],
          rows: rows.map((row) => ({
            employeeCode: row.employeeCode,
            fullName: row.fullName,
            position: row.position ?? "",
            workStatus: row.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ",
            contractStatus: row.contractStatus || "Ổn định",
            payMode: row.payMode === "SESSION" ? "Theo ca" : "Theo giờ",
            teachingHourlyRate: row.teachingHourlyRate != null ? formatVnd(row.teachingHourlyRate) : "",
            teachingHours: row.teachingHours,
            teachingAmount: formatVnd(row.teachingAmount),
            assistantHourlyRate: row.assistantHourlyRate != null ? formatVnd(row.assistantHourlyRate) : "",
            assistantHours: row.assistantHours,
            assistantAmount: formatVnd(row.assistantAmount),
            staffDailyRate: row.staffDailyRate != null ? formatVnd(row.staffDailyRate) : "",
            staffDays: row.staffDays,
            staffHours: row.staffHours,
            baseSalaryAmount: formatVnd(row.baseSalaryAmount),
            bonus: formatVnd(row.bonus),
            penalty: formatVnd(row.penalty),
            totalAmount: formatVnd(row.totalAmount),
            dataSource: row.lineId ? "Công thực tế + khoản cộng/trừ nhập tay" : "Công thực tế",
            notes: row.notes ?? "",
          })),
        },
        {
          title: "Danh sách chuyển khoản",
          columns: [
            { key: "stt", label: "STT" },
            { key: "employeeCode", label: "Mã NV" },
            { key: "fullName", label: "Họ tên" },
            { key: "bankName", label: "Ngân hàng" },
            { key: "bankAccountNumber", label: "Số tài khoản" },
            { key: "bankAccountHolder", label: "Chủ tài khoản" },
            { key: "amount", label: "Số tiền" },
            { key: "transferNote", label: "Nội dung chuyển khoản" },
            { key: "note", label: "Ghi chú" },
          ],
          rows: rows.map((row, index) => ({
            stt: index + 1,
            employeeCode: row.employeeCode,
            fullName: row.fullName,
            bankName: row.bankName ?? "",
            bankAccountNumber: row.bankAccountNumber ?? "",
            bankAccountHolder: row.bankAccountHolder ?? row.fullName,
            amount: formatVnd(row.totalAmount),
            transferNote: `Luong ${period} - ${row.fullName}`,
            note: row.hasBankInfo ? "" : "Thiếu thông tin chuyển khoản",
          })),
        },
        {
          title: "Cách đọc bảng",
          columns: [
            { key: "muc", label: "Mục" },
            { key: "giaiThich", label: "Giải thích" },
          ],
          rows: [
            { muc: "Nguồn số liệu = Công thực tế", giaiThich: "Công và tiền tính trực tiếp từ buổi dạy/trợ giảng/chấm công của tháng." },
            { muc: "Nguồn số liệu = Công thực tế + khoản cộng/trừ nhập tay", giaiThich: "Như trên, cộng thêm thưởng/phạt/phụ cấp đã nhập tay trong drawer của nhân sự." },
            { muc: "Theo ca", giaiThich: "Trả cố định 1 đơn vị tiền cho mỗi buổi bất kể buổi đó dạy dài hay ngắn hơn khung giờ chuẩn — tránh sai lệch khi giáo viên dạy quá giờ hoặc cho nghỉ sớm." },
            { muc: "Theo giờ", giaiThich: "Trả theo đúng số giờ của khung giờ buổi học (giờ kết thúc trừ giờ bắt đầu theo lịch)." },
            { muc: "Tổng lương", giaiThich: "Tiền dạy + Tiền trợ giảng + Lương cứng + Thưởng − Phạt." },
          ],
        },
      ],
      `payroll_${period}`,
      "Payroll",
    );
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className={ACTION_CLASS}
    >
      Xuất Excel đầy đủ
    </button>
  );
}
