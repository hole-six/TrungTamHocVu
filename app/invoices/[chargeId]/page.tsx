import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/components/PrintButton";

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

export default async function InvoicePage({ params }: { params: { chargeId: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const charge = await prisma.charge.findUnique({
    where: { id: params.chargeId },
    include: {
      student: true,
      class: { include: { branch: true } },
      billingPeriod: true,
      allocations: true,
      invoice: true,
    },
  });
  if (!charge) notFound();

  let invoice = charge.invoice;
  if (!invoice) {
    const invoiceNo = `INV${charge.billingPeriod.periodName.replace("-", "")}${charge.id.slice(0, 6).toUpperCase()}`;
    invoice = await prisma.invoice.create({ data: { chargeId: charge.id, invoiceNo } });
  }

  const paid = charge.allocations.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Hóa đơn học phí</h1>
        <PrintButton />
      </div>

      <div className="rounded-xl border border-hairline bg-white p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-hairline pb-4">
          <div>
            <p className="font-display text-lg font-semibold">{charge.class.branch.name}</p>
            <p className="text-sm text-ink-muted48">Hóa đơn học phí</p>
          </div>
          <div className="text-right text-sm">
            <p>
              Số: <strong>{invoice.invoiceNo}</strong>
            </p>
            <p className="text-ink-muted48">Ngày xuất: {formatDate(invoice.issuedAt)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-ink-muted48">Học viên</p>
            <p className="font-medium">{charge.student.fullName}</p>
            <p className="text-ink-muted48">{charge.student.studentCode}</p>
          </div>
          <div>
            <p className="text-ink-muted48">Lớp / Kỳ</p>
            <p className="font-medium">{charge.class.className}</p>
            <p className="text-ink-muted48">Kỳ {charge.billingPeriod.periodName}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="py-2 font-medium">Khoản mục</th>
              <th className="py-2 text-right font-medium">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-hairline">
              <td className="py-2">
                Học phí ({charge.sessionCount} buổi − {charge.absentCount} nghỉ − {charge.deductedCount} trừ) ×{" "}
                {formatVnd(charge.unitPrice)}
              </td>
              <td className="py-2 text-right">{formatVnd(charge.tuitionAmount)}</td>
            </tr>
            <tr className="border-b border-hairline">
              <td className="py-2">Giáo trình</td>
              <td className="py-2 text-right">{formatVnd(charge.materialsAmount)}</td>
            </tr>
            <tr className="border-b border-hairline">
              <td className="py-2">Số dư đầu kỳ</td>
              <td className="py-2 text-right">{formatVnd(charge.openingBalance)}</td>
            </tr>
            <tr className="border-b border-hairline font-medium">
              <td className="py-2">Tổng cộng</td>
              <td className="py-2 text-right">{formatVnd(charge.totalAmount)}</td>
            </tr>
            <tr className="font-medium text-primary">
              <td className="py-2">Đã thanh toán</td>
              <td className="py-2 text-right">{formatVnd(paid)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="py-2">Còn lại</td>
              <td className="py-2 text-right">{formatVnd(charge.totalAmount - paid)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-8 text-center text-xs text-ink-muted48">Cảm ơn quý phụ huynh đã đồng hành cùng trung tâm.</p>
      </div>
    </div>
  );
}
