import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView } from "@/lib/server/role-matrix";
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
// Nội dung đúng yêu cầu: mỗi người một dòng, thấy được TỪNG LOẠI CÔNG và TIỀN CỦA
// TỪNG LOẠI CÔNG đó, rồi mới tới tổng — không phải chỉ một cục tổng.
export default async function PayrollPrintPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!canView("hr", role)) notFound();

  const periodName = searchParams?.period ?? new Date().toISOString().slice(0, 7);
  const run = await prisma.payrollRun.findFirst({
    where: { periodName },
    include: {
      branch: true,
      lines: { include: { employee: true }, orderBy: { totalAmount: "desc" } },
    },
  });
  if (!run) notFound();

  const totals = run.lines.reduce(
    (acc, line) => ({
      teachingHours: acc.teachingHours + line.teachingHours,
      teachingAmount: acc.teachingAmount + line.teachingAmount,
      assistantHours: acc.assistantHours + line.assistantHours,
      assistantAmount: acc.assistantAmount + line.assistantAmount,
      staffDays: acc.staffDays + line.staffDays,
      baseSalaryAmount: acc.baseSalaryAmount + line.baseSalaryAmount,
      otherAdd: acc.otherAdd + line.otAmount + line.kpiBonus + line.assistantRatingBonus + line.parkingAllowance + line.supportAllowance + line.bonus + line.holidayBonus,
      deduction: acc.deduction + line.penalty + line.socialInsuranceDeduction + line.utilityDeduction + line.otherDeduction,
      total: acc.total + line.totalAmount,
    }),
    { teachingHours: 0, teachingAmount: 0, assistantHours: 0, assistantAmount: 0, staffDays: 0, baseSalaryAmount: 0, otherAdd: 0, deduction: 0, total: 0 },
  );

  const rate = (amount: number, qty: number) => (qty > 0 ? Math.round(amount / qty) : 0);

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
        <h1 className="text-xl font-black uppercase tracking-tight">Bảng công &amp; lương tháng {run.periodName}</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          {run.branch?.name ?? "Toàn hệ thống"} · {run.lines.length} nhân sự · Trạng thái: {run.status}
        </p>
      </div>

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
          {run.lines.map((line) => {
            const otherAdd =
              line.otAmount + line.kpiBonus + line.assistantRatingBonus + line.parkingAllowance + line.supportAllowance + line.bonus + line.holidayBonus;
            const deduction = line.penalty + line.socialInsuranceDeduction + line.utilityDeduction + line.otherDeduction;
            return (
              <tr key={line.id}>
                <td className="border border-[#cbd5e1] px-2 py-1">{line.employee.employeeCode}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 font-semibold">{line.employee.fullName}</td>
                <td className="border border-[#cbd5e1] px-2 py-1">{line.employee.position ?? "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{line.teachingHours || "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{line.teachingHours > 0 ? formatVnd(rate(line.teachingAmount, line.teachingHours)) : "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{line.teachingAmount > 0 ? formatVnd(line.teachingAmount) : "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{line.assistantHours || "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{line.assistantHours > 0 ? formatVnd(rate(line.assistantAmount, line.assistantHours)) : "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{line.assistantAmount > 0 ? formatVnd(line.assistantAmount) : "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{line.staffDays || "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{line.staffDays > 0 ? formatVnd(rate(line.baseSalaryAmount, line.staffDays)) : "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{line.baseSalaryAmount > 0 ? formatVnd(line.baseSalaryAmount) : "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{otherAdd > 0 ? formatVnd(otherAdd) : "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right">{deduction > 0 ? `-${formatVnd(deduction)}` : "—"}</td>
                <td className="border border-[#cbd5e1] px-2 py-1 text-right font-bold">{formatVnd(line.totalAmount)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-[#f1f5f9] font-bold">
            <td className="border border-[#cbd5e1] px-2 py-1.5" colSpan={3}>TỔNG CỘNG</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{totals.teachingHours}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5" />
            <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{formatVnd(totals.teachingAmount)}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{totals.assistantHours}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5" />
            <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{formatVnd(totals.assistantAmount)}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{totals.staffDays}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5" />
            <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{formatVnd(totals.baseSalaryAmount)}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{formatVnd(totals.otherAdd)}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">-{formatVnd(totals.deduction)}</td>
            <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{formatVnd(totals.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-8 grid grid-cols-3 gap-6 text-center text-xs">
        <div><p className="font-bold">Người lập bảng</p><p className="mt-12 text-[#94a3b8]">(Ký, ghi rõ họ tên)</p></div>
        <div><p className="font-bold">Kế toán</p><p className="mt-12 text-[#94a3b8]">(Ký, ghi rõ họ tên)</p></div>
        <div><p className="font-bold">Giám đốc</p><p className="mt-12 text-[#94a3b8]">(Ký, ghi rõ họ tên)</p></div>
      </div>
    </div>
  );
}
