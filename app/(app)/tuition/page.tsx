import Link from "next/link";
import { notFound } from "next/navigation";
import BatchInvoiceView from "@/components/tuition/BatchInvoiceView";
import SpotlightTour, { type TourStep } from "@/components/ui/GuidedTour/SpotlightTour";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canView, canUpdate } from "@/lib/server/role-matrix";
import { getBatchInvoiceViewData } from "@/lib/server/batch-invoice-view";
import { getCurrentBranchId } from "@/lib/branch-filter";

const TUITION_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="tuition-period-switcher"]',
    title: "Chọn đúng kỳ trước khi làm bất cứ gì",
    description:
      "Mọi số liệu trên trang này — công nợ, đã thu, danh sách xuất phiếu — đều thuộc về ĐÚNG kỳ đang chọn ở đây, không phải \"tháng hiện tại\" theo lịch thật. Các nút tròn là 6 kỳ gần nhất; nếu cần lùi xa hơn, gõ trực tiếp tháng/năm vào ô bên cạnh rồi bấm Mở kỳ. Thao tác nhầm kỳ là lỗi phổ biến nhất khi in phiếu hàng loạt — luôn nhìn lại tên kỳ đang hiện ở tiêu đề trước khi chọn học viên để in.",
    placement: "bottom",
  },
  {
    target: '[data-tour="tuition-summary"]',
    title: "5 số cần đọc đúng thứ tự",
    description:
      "\"Đã chọn\" và \"Tổng tiền chọn\" chỉ tính trên những dòng anh đã tick chọn để in/xử lý — không phải tổng cả kỳ. \"Còn nợ\" đếm số HỌC VIÊN chưa thu đủ, không phải số tiền. Quan trọng nhất là \"Lệch kiểu thu\" (badge vàng): đây là số phiếu đã được sinh ra theo một kiểu thu (theo tháng hoặc trọn khóa) nhưng sau đó học viên đã ĐỔI kiểu thu khác — phiếu cũ lúc này sai và cần làm mới trước khi gửi cho phụ huynh, xem chi tiết ở bước sau.",
    placement: "bottom",
  },
  {
    target: '[data-tour="tuition-tabs"]',
    title: "3 tab tách biệt: Lọc danh sách, Xuất phiếu, Chuyển khoản/QR",
    description:
      "\"Lọc danh sách\" để tìm đúng nhóm học viên cần xử lý (theo tên, kiểu thu, đã/chưa thu) và có 2 nút chọn nhanh: \"Chọn người còn nợ\" (tick tất cả ai chưa thu đủ) và \"Chọn tất cả đang thấy\" (tick theo đúng bộ lọc hiện tại). \"Xuất phiếu\" chọn chế độ gộp chung 1 file PDF hay tách riêng từng phiếu — nút tải chỉ bật khi đã chọn ít nhất 1 học viên ở tab kia. \"Chuyển khoản/QR\" là nơi khai báo số tài khoản và ảnh QR — cấu hình này dùng CHUNG cho mọi phiếu in ra từ trang này, sửa 1 lần ở đây là áp dụng hết, không cần chỉnh từng phiếu.",
    placement: "right",
  },
  {
    target: '[data-tour="tuition-billing-col"]',
    title: "Badge vàng \"Phiếu lệch kiểu thu\" — phải xử lý trước khi in",
    description:
      "Mỗi dòng luôn có 2 badge: kiểu thu (Theo tháng/Trọn khóa) và trạng thái đã thu. Nếu thấy thêm badge vàng \"Phiếu lệch kiểu thu\", nghĩa là kiểu thu ghi trên phiếu này khác với kiểu thu học viên đang áp dụng THỰC TẾ ở thời điểm hiện tại — thường do phụ huynh vừa đổi từ đóng theo tháng sang trọn khóa (hoặc ngược lại) sau khi phiếu đã được sinh. In phiếu này ngay sẽ gửi sai số tiền cho phụ huynh. Nếu phiếu đó CHƯA thu tiền, hệ thống cho phép bấm nút \"Chuyển thu tháng\"/\"Chuyển trọn khóa\" ngay trên dòng đó để làm mới phiếu đúng kiểu — nếu ĐÃ thu tiền một phần thì không tự chuyển được nữa, cần xử lý thủ công để tránh mất tiền đã thu.",
    placement: "top",
  },
  {
    target: '[data-tour="tuition-actions-col"]',
    title: "3 lối tắt: hồ sơ học phí, tải phiếu, thu nhanh",
    description:
      "\"Học phí HV\" mở thẳng tab học phí trong hồ sơ học viên đó — dùng khi cần xem toàn bộ lịch sử công nợ nhiều kỳ, không chỉ kỳ đang xem. \"Tải phiếu\" chỉ hiện khi còn nợ, xuất đúng 1 file PDF cho riêng dòng đó. Nút thu tiền nhanh (nếu anh có quyền) mở form nhập số tiền đã thu ngay tại chỗ, số gợi ý sẵn đúng bằng phần còn thiếu — không cần tính tay.",
    placement: "top",
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
                <SpotlightTour steps={TUITION_TOUR_STEPS} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2" data-tour="tuition-period-switcher">
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
