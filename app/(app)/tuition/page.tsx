import Link from "next/link";
import { notFound } from "next/navigation";
import BatchInvoiceView from "@/components/tuition/BatchInvoiceView";
import PageGuide from "@/components/ui/PageGuide";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canUpdate } from "@/lib/server/role-matrix";
import { getBatchInvoiceViewData } from "@/lib/server/batch-invoice-view";
import { getCurrentBranchId } from "@/lib/branch-filter";

const TUITION_PAGE_GUIDE_SECTIONS = [
  {
    title: "Màn này để làm gì?",
    items: [
      "Đây là màn vận hành học phí chính theo từng kỳ/tháng thu.",
      "Từ đây người vận hành chọn kỳ, xem danh sách cần thu, mở chi tiết công nợ và xử lý thu tiền hoặc xuất phiếu.",
      "Hãy luôn nhìn đúng kỳ đang mở trước khi thao tác để tránh thu hay in nhầm tháng.",
    ],
    tone: "info" as const,
  },
  {
    title: "Thứ tự thao tác nên đi",
    items: [
      "Bước 1: chọn đúng kỳ thu cần làm việc.",
      "Bước 2: rà danh sách công nợ hoặc batch phiếu của kỳ đó.",
      "Bước 3: mở chi tiết một học viên nếu cần hiểu cấu phần nợ.",
      "Bước 4: thu tiền, in phiếu hoặc mở hồ sơ 360 tùy tình huống.",
    ],
    tone: "success" as const,
  },
  {
    title: "Điểm cần tránh",
    items: [
      "Không thao tác khi chưa chắc kỳ đang mở là tháng nào.",
      "Không nhìn số còn nợ tổng mà bỏ qua cấu phần nợ bên trong.",
      "Không in hoặc thu theo quán tính nếu phụ huynh vừa đổi kiểu đóng theo tháng/trọn khóa mà chưa được cập nhật đúng.",
    ],
    tone: "warning" as const,
  },
];

export default async function TuitionPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const user = await getCurrentUser();
  const role = user ? await getUserRole(user.id) : null;

  if (!canView("tuition", role)) {
    notFound();
  }

  const canManageTuition = canUpdate("tuition", role);
  const branchId = (await getCurrentBranchId()) ?? undefined;

  const periods = await prisma.billingPeriod.findMany({
    where: branchId ? { branchId } : undefined,
    orderBy: { periodName: "desc" },
    take: 24,
    select: {
      id: true,
      periodName: true,
      status: true,
      _count: { select: { charges: true } },
    },
  });

  if (periods.length === 0) {
    return (
      <div className="space-y-6">
        <section className="card border border-hairline bg-white shadow-[0_12px_34px_rgba(31,68,111,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Thu học phí</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">Màn vận hành học phí</h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted80">Hiện chưa có kỳ thu nào để mở. Tạo kỳ đầu tiên rồi hệ thống sẽ dùng chính màn này để thu tiền, xuất phiếu và đổi kiểu thu.</p>
          <div className="mt-5">
            <Link href="/admin" className="btn-primary">
              Mở khu quản trị để tạo kỳ thu
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const selectedPeriod =
    periods.find((item) => item.periodName === searchParams?.period) ??
    periods[0];

  const batchView = await getBatchInvoiceViewData(selectedPeriod.id);
  if (!batchView) notFound();

  return (
    <div className="space-y-6">
      <PageGuide
        title="Guide vận hành học phí"
        summary="Đây là màn trung tâm để xử lý học phí theo kỳ. Người mới chỉ cần nắm đúng kỳ đang mở, hiểu từng dòng công nợ và biết khi nào nên thu tiền, in phiếu hay mở hồ sơ 360."
        sections={TUITION_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide học phí"
      />
      <section className="rounded-[28px] border border-hairline bg-white px-5 py-4 shadow-[0_12px_34px_rgba(31,68,111,0.08)]">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Thu học phí</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-ink">{selectedPeriod.periodName}</h1>
                <span className="rounded-full border border-[#dfe8f2] bg-[#f8fbff] px-3 py-1 text-sm font-medium text-[#6f7f94]">
                  {selectedPeriod._count.charges} phiếu
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {periods.slice(0, 6).map((period) => {
                const active = period.id === selectedPeriod.id;
                return (
                  <Link
                    key={period.id}
                    href={`/tuition?period=${period.periodName}`}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                      active ? "bg-primary text-white shadow-sm" : "border border-hairline bg-white text-ink-muted80 hover:border-primary/30 hover:text-primary"
                    }`}
                  >
                    {period.periodName}
                  </Link>
                );
              })}
            </div>
          </div>

          <form className="flex flex-col gap-2 sm:flex-row sm:items-center" action="/tuition" method="get">
            <input
              type="month"
              name="period"
              defaultValue={selectedPeriod.periodName}
              className="input min-w-[170px]"
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              Mở kỳ
            </button>
          </form>
        </div>
      </section>

      <BatchInvoiceView
        periodName={batchView.periodName}
        periodId={batchView.periodId}
        branchId={batchView.branchId}
        paymentProfile={batchView.paymentProfile}
        charges={batchView.charges}
        canManageTuition={canManageTuition}
        embedded
      />
    </div>
  );
}
