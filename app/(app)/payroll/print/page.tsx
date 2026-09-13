import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { buildPayrollEmployeeRows } from "@/lib/server/payroll-row-builder";
import { formatVnd } from "@/lib/export-utils";
import PrintNowButton from "@/components/payroll/PrintNowButton";

// Bảng công + lương in một phát ra PDF (Ctrl+P → Lưu thành PDF).
//
// Cố tình KHÔNG dùng lại đường sinh PDF của hóa đơn học phí: đường đó chạy qua Python
// + reportlab (lib/server/invoice-pdf.ts), thêm một mẫu nữa vào đó nghĩa là thêm phụ
// thuộc phải cài trên VPS và một mẫu nữa phải bảo trì. Bảng lương chỉ cần in ra giấy/
// PDF một lần mỗi tháng, nên trang in thuần HTML là đủ, chạy được ở mọi máy và sửa
// bố cục dễ hơn nhiều.
//
// In được BẤT KỲ tháng nào, không cần "tạo tháng lương" trước: số liệu lấy qua
// buildPayrollEmployeeRows — cùng đúng số liệu đang hiển thị ở /payroll. Nếu tháng đó đã
// chốt thì hàm này tự lấy số đã đóng băng trên PayrollLine, chưa chốt thì tính trực tiếp
// từ buổi dạy/trợ giảng/chấm công. Trước đây trang này bắt buộc phải có PayrollRun mới in
// được, nên xem lại lương tháng cũ phải đi qua mấy bước chốt — không cần thiết.
export default async function PayrollPrintPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("hr", role)) notFound();

  const periodName =
    searchParams?.period && /^\d{4}-\d{2}$/.test(searchParams.period) ? searchParams.period : new Date().toISOString().slice(0, 7);
  const activeBranchId = await getCurrentBranchId();

  const run = await prisma.payrollRun.findFirst({
    where: { periodName, ...(activeBranchId ? { branchId: activeBranchId } : {}) },
  });
  const [branch, allRows] = await Promise.all([
    activeBranchId ? prisma.branch.findUnique({ where: { id: activeBranchId }, select: { name: true } }) : Promise.resolve(null),
    buildPayrollEmployeeRows({ branchId: activeBranchId, period: periodName, runId: run?.id ?? null }),
  ]);

  // In thì chỉ in người có phát sinh trong tháng — người 0 công 0 tiền chỉ làm dài bảng.
  const rows = allRows
    .filter((row) => row.totalAmount > 0 || row.teachingHours > 0 || row.assistantHours > 0 || row.staffDays > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const totals = rows.reduce(
    (acc, row) => ({
      teachingHours: acc.teachingHours + row.teachingHours,
      teachingAmount: acc.teachingAmount + row.teachingAmount,
      assistantHours: acc.assistantHours + row.assistantHours,
      assistantAmount: acc.assistantAmount + row.assistantAmount,
      staffDays: acc.staffDays + row.staffDays,
      baseSalaryAmount: acc.baseSalaryAmount + row.baseSalaryAmount,
      otherAdd:
        acc.otherAdd +
        row.otAmount +
        row.kpiBonus +
        row.assistantRatingBonus +
        row.parkingAllowance +
        row.supportAllowance +
        row.bonus +
        row.holidayBonus,
      deduction: acc.deduction + row.penalty + row.socialInsuranceDeduction + row.utilityDeduction + row.otherDeduction,
      total: acc.total + row.totalAmount,
    }),
    {
      teachingHours: 0,
      teachingAmount: 0,
      assistantHours: 0,
      assistantAmount: 0,
      staffDays: 0,
      baseSalaryAmount: 0,
      otherAdd: 0,
      deduction: 0,
      total: 0,
    },
  );

  const rate = (amount: number, qty: number) => (qty > 0 ? Math.round(amount / qty) : 0);
  const [year, month] = periodName.split("-");

  return (
    <div className="mx-auto max-w-[1100px] bg-white p-6 text-[#0f1729] print:p-0">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none !important; }
          body { background: #fff; }
          table { font-size: 10px; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#dbe7ff] bg-[#f8faff] p-3">
        <p className="text-sm text-[#64748b]">
          Bấm <strong>In / Lưu PDF</strong> rồi chọn &quot;Lưu thành PDF&quot; trong hộp thoại in.
        </p>
        <PrintNowButton />
      </div>

      <div className="mb-4 text-center">
        <h1 className="text-xl font-black uppercase tracking-tight">
          Bảng công &amp; lương tháng {month}/{year}
        </h1>
        <p className="mt-1 text-sm text-[#64748b]">
          {branch?.name ?? "Toàn hệ thống"} · {rows.length} nhân sự có phát sinh
          {run ? " · đã chốt tháng lương" : ""}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-6 text-center text-sm text-[#64748b]">
          Tháng {month}/{year} chưa có buổi dạy, buổi trợ giảng hay ngày chấm công nào để tính lương.
        </p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#f1f5f9] text-left">
              <th className="border border-[#cbd5e1] px-2 py-1.5">Mã NV</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5">Họ và tên</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5">Vị trí</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Giờ dạy</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Đơn giá giờ dạy</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Tiền dạy</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Giờ trợ giảng</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Đơn giá TG</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Tiền trợ giảng</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Ngày công HC</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Đơn giá ngày</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Lương HC</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Cộng thêm</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Khấu trừ</th>
              <th className="border border-[#cbd5e1] px-2 py-1.5 text-right">Thực nhận</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const otherAdd =
                row.otAmount + row.kpiBonus + row.assistantRatingBonus + row.parkingAllowance + row.supportAllowance + row.bonus + row.holidayBonus;
              const deduction = row.penalty + row.socialInsuranceDeduction + row.utilityDeduction + row.otherDeduction;
              return (
                <tr key={row.id}>
                  <td className="border border-[#cbd5e1] px-2 py-1">{row.employeeCode}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 font-semibold">{row.fullName}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1">{row.position ?? "—"}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">{row.teachingHours || "—"}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">
                    {row.teachingHours > 0 ? formatVnd(rate(row.teachingAmount, row.teachingHours)) : "—"}
                  </td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">{row.teachingAmount > 0 ? formatVnd(row.teachingAmount) : "—"}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">{row.assistantHours || "—"}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">
                    {row.assistantHours > 0 ? formatVnd(rate(row.assistantAmount, row.assistantHours)) : "—"}
                  </td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">{row.assistantAmount > 0 ? formatVnd(row.assistantAmount) : "—"}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">{row.staffDays || "—"}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">
                    {row.staffDays > 0 ? formatVnd(rate(row.baseSalaryAmount, row.staffDays)) : "—"}
                  </td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">{row.baseSalaryAmount > 0 ? formatVnd(row.baseSalaryAmount) : "—"}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">{otherAdd > 0 ? formatVnd(otherAdd) : "—"}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right">{deduction > 0 ? `-${formatVnd(deduction)}` : "—"}</td>
                  <td className="border border-[#cbd5e1] px-2 py-1 text-right font-bold">{formatVnd(row.totalAmount)}</td>
                </tr>
              );
            })}
            <tr className="bg-[#f1f5f9] font-bold">
              <td className="border border-[#cbd5e1] px-2 py-1.5" colSpan={3}>
                TỔNG CỘNG
              </td>
              <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{totals.teachingHours}</td>
              <td className="border border-[#cbd5e1] px-2 py-1.5" />
              <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{formatVnd(totals.teachingAmount)}</td>
              <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{totals.assistantHours}</td>
              <td className="border border-[#cbd5e1] px-2 py-1.5" />
              <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{formatVnd(totals.assistantAmount)}</td>
              <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{totals.staffDays}</td>
              <td className="border border-[#cbd5e1] px-2 py-1.5" />
              <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{totals.baseSalaryAmount > 0 ? formatVnd(totals.baseSalaryAmount) : "—"}</td>
              <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{totals.otherAdd > 0 ? formatVnd(totals.otherAdd) : "—"}</td>
              <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{totals.deduction > 0 ? `-${formatVnd(totals.deduction)}` : "—"}</td>
              <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{formatVnd(totals.total)}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="mt-8 grid grid-cols-3 gap-6 text-center text-xs">
        <div>
          <p className="font-bold">Người lập bảng</p>
          <p className="mt-12 text-[#94a3b8]">(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-bold">Kế toán</p>
          <p className="mt-12 text-[#94a3b8]">(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-bold">Giám đốc</p>
          <p className="mt-12 text-[#94a3b8]">(Ký, ghi rõ họ tên)</p>
        </div>
      </div>
    </div>
  );
}
