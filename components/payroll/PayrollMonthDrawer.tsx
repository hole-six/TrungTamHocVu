"use client";

import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import PayrollRunActions from "@/components/payroll/PayrollRunActions";
import AddPayrollLineForm from "@/components/payroll/AddPayrollLineForm";
import { Section } from "@/components/ui/DetailDrawerParts";

type Checklist = { items: { key: string; label: string; done: boolean; help: string }[]; isReady: boolean } | null;

// Xử lý lương của cả THÁNG (tính lại / kiểm tra / duyệt / khóa / trả) — trước đây là 1
// panel bung ra ngay giữa trang danh sách, gồm 3-4 khung lồng nhau đẩy bảng nhân sự
// xuống dưới màn hình. Đưa vào drawer để trang danh sách chỉ còn đúng 1 việc: xem
// bảng lương từng người.
export default function PayrollMonthDrawer({
  open,
  onClose,
  period,
  runId,
  status,
  lineCount,
  checklist,
  eligibleEmployees,
}: {
  open: boolean;
  onClose: () => void;
  period: string;
  runId: string;
  status: string;
  lineCount: number;
  checklist: Checklist;
  eligibleEmployees: { id: string; fullName: string }[];
}) {
  return (
    <ResponsiveDrawer open={open} onClose={onClose} title={`Chốt & điều chỉnh lương tháng ${period}`} widthClassName="max-w-3xl">
      <div className="space-y-4">
        <p className="text-sm text-[#64748b]">
          {lineCount} người đã chốt số trong tháng này. Chỉ cần vào đây khi muốn <strong>đóng băng số liệu</strong> hoặc{" "}
          <strong>sửa thưởng/phạt</strong> của từng người — còn xem bảng lương, xuất Excel và in PDF thì không cần bước nào ở đây.
        </p>

        <PayrollRunActions runId={runId} status={status} checklistReady={checklist?.isReady ?? true} />

        {checklist ? (
          <Section title="Checklist chốt tháng (chỉ để nhắc)" hint={checklist.isReady ? "Đạt" : "Chưa đạt"} defaultOpen={false}>
            <div className="space-y-2 text-sm">
              {checklist.items.map((item) => (
                <div key={item.key} className="flex items-start gap-2 border-b border-[#f1f5f9] py-2 last:border-0">
                  <span className={`mt-0.5 font-black ${item.done ? "text-emerald-700" : "text-amber-700"}`}>{item.done ? "✓" : "•"}</span>
                  <div>
                    <p className={`font-semibold ${item.done ? "text-[#0f1729]" : "text-amber-800"}`}>{item.label}</p>
                    {!item.done && item.help ? <p className="mt-0.5 text-xs text-[#64748b]">{item.help}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {eligibleEmployees.length > 0 ? (
          <Section title="Thêm nhân sự còn thiếu" hint={`${eligibleEmployees.length} người chưa có dòng lương`}>
            <AddPayrollLineForm payrollRunId={runId} employeeOptions={eligibleEmployees} />
          </Section>
        ) : null}
      </div>
    </ResponsiveDrawer>
  );
}
