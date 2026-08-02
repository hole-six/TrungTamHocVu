function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("vi-VN");
}

function formatPeriodLabel(periodName: string) {
  const [year, month] = periodName.split("-");
  if (!year || !month) return periodName;
  return `Tháng ${Number(month)}/${year}`;
}

function getInvoiceSerial(invoiceNo: string | undefined) {
  if (!invoiceNo) return "—";
  const parts = invoiceNo.match(/(\d+)(?!.*\d)/);
  return parts?.[1] ?? invoiceNo.slice(-6).toUpperCase();
}

function getBranchShortName(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "TT";
}

function getDueDateLabel(periodName: string) {
  const [year, month] = periodName.split("-");
  if (!year || !month) return `trong kỳ ${periodName}`;
  const nextMonth = Number(month) + 1;
  const nextYear = nextMonth > 12 ? Number(year) + 1 : Number(year);
  const normalizedMonth = nextMonth > 12 ? 1 : nextMonth;
  return `trước ngày 10/${String(normalizedMonth).padStart(2, "0")}/${nextYear}`;
}

function getMonthNumber(periodName: string) {
  return periodName.split("-")[1] ?? "";
}

export type InvoiceChargeData = {
  id: string;
  sessionCount: number;
  absentCount: number;
  deductedCount: number;
  unitPrice: number;
  tuitionAmount: number;
  materialsAmount: number;
  openingBalance: number;
  totalAmount: number;
  billingModel: string;
  student: { id?: string; fullName: string; studentCode: string };
  class: { className: string; branch: { name: string } };
  billingPeriod: { periodName: string };
  allocations: { amount: number }[];
  invoice: { invoiceNo: string; issuedAt: Date | string } | null;
};

export type PaymentProfileData = {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  qrImageData: string | null;
  paymentInstruction: string | null;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 mb-1 text-[14px] font-bold">{children}</p>;
}

function GridValueRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_220px] border-b border-black last:border-b-0">
      <div className={`px-2 py-1.5 text-[13px] ${bold ? "font-semibold" : ""}`}>{label}</div>
      <div className={`border-l border-black px-2 py-1.5 text-center text-[13px] ${bold ? "font-bold" : ""}`}>{value}</div>
    </div>
  );
}

export default function InvoiceDocument({
  charge,
  paymentProfile,
}: {
  charge: InvoiceChargeData;
  paymentProfile?: PaymentProfileData | null;
}) {
  const paid = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const remaining = Math.max(charge.totalAmount - paid, 0);
  const periodLabel = formatPeriodLabel(charge.billingPeriod.periodName);
  const serial = getInvoiceSerial(charge.invoice?.invoiceNo);
  const branchName = charge.class.branch.name || "Trung tâm";
  const transferContent = `${charge.student.fullName} - ${charge.class.className}`.replace(/\s+/g, " ");
  const totalSessions = charge.sessionCount + charge.absentCount + charge.deductedCount;
  const dueDateLabel = getDueDateLabel(charge.billingPeriod.periodName);
  const monthNumber = getMonthNumber(charge.billingPeriod.periodName);
  const isCourseBilling = charge.billingModel === "COURSE";

  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white p-[8mm] text-black print:min-h-[297mm] print:p-[8mm]">
      <div className="border border-black px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-[58px] w-[58px] items-center justify-center border border-black bg-[#f5f7fb] text-[15px] font-bold">
              {getBranchShortName(branchName)}
            </div>
            <div className="pt-1">
              <p className="text-[15px] font-bold uppercase leading-5">{branchName}</p>
            </div>
          </div>

          <div className="text-right leading-5">
            <p className="text-[18px] font-bold uppercase">Phiếu thông</p>
            <p className="text-[18px] font-bold uppercase">báo học phí</p>
            <p className="mt-1 text-[16px] font-bold">{periodLabel}</p>
          </div>
        </div>

        <div className="mt-2 text-[14px] font-bold">STT: {serial}</div>

        <div className="mt-2 border border-black">
          <div className="grid grid-cols-[92px_minmax(0,1fr)_76px_minmax(0,1fr)] border-b border-black">
            <div className="border-r border-black px-2 py-3 text-center text-[13px] font-semibold">Mã Học sinh</div>
            <div className="border-r border-black px-2 py-3 text-center text-[15px] font-semibold">{charge.student.studentCode}</div>
            <div className="border-r border-black px-2 py-3 text-center text-[13px] font-semibold">Cơ sở</div>
            <div className="px-2 py-3 text-center text-[15px] font-semibold">{branchName}</div>
          </div>

          <div className="grid grid-cols-[92px_minmax(0,1fr)_76px_minmax(0,1fr)]">
            <div className="border-r border-black px-2 py-3 text-center text-[13px] font-semibold">Họ tên</div>
            <div className="border-r border-black px-2 py-3 text-center text-[15px] font-semibold">{charge.student.fullName}</div>
            <div className="border-r border-black px-2 py-3 text-center text-[13px] font-semibold">Lớp</div>
            <div className="px-2 py-3 text-center text-[15px] font-semibold">{charge.class.className}</div>
          </div>
        </div>

        <SectionTitle>{isCourseBilling ? "Công nợ trước khóa:" : "Học phí tháng trước:"}</SectionTitle>
        <div className="border border-black">
          <GridValueRow
            label={isCourseBilling ? "Công nợ / tồn trước khi vào phiếu này (VND)" : "Học phí nợ tính đến đầu kỳ (VND)"}
            value={formatVnd(charge.openingBalance)}
            bold
          />
        </div>

        <SectionTitle>{isCourseBilling ? "Thông tin khóa học:" : "Học phí tháng này:"}</SectionTitle>
        <div className="border border-black">
          {isCourseBilling ? (
            <>
              <GridValueRow label="Tổng số buổi toàn khóa" value={totalSessions} />
              <GridValueRow label="Số buổi đã tính trong phiếu khóa" value={charge.sessionCount} />
              <GridValueRow label="Tiền giáo trình / phát sinh (VND)" value={formatVnd(charge.materialsAmount)} />
              <GridValueRow
                label="Học phí trọn khóa (VND)"
                value={<span className="text-[18px] font-bold">{formatVnd(charge.tuitionAmount)}</span>}
                bold
              />
            </>
          ) : (
            <>
              <GridValueRow label={`Số buổi nghỉ tháng ${monthNumber}`} value={charge.absentCount} />
              <GridValueRow label={`Tổng số buổi tháng ${monthNumber}`} value={totalSessions} />
              <GridValueRow label="Số buổi tính phí" value={charge.sessionCount} />
              <GridValueRow label="Tiền giáo trình (VND)" value={formatVnd(charge.materialsAmount)} />
              <GridValueRow
                label={`Học phí tháng ${monthNumber} (VND)`}
                value={<span className="text-[18px] font-bold">{formatVnd(charge.tuitionAmount)}</span>}
                bold
              />
            </>
          )}
        </div>

        <SectionTitle>Thanh toán:</SectionTitle>
        <div className="grid grid-cols-[minmax(0,1fr)_220px] border border-black">
          <div className="border-r border-black px-2 py-5 text-center text-[17px] font-bold uppercase">Tổng phải nộp (VND)</div>
          <div className="px-2 py-5 text-center text-[22px] font-bold">{formatVnd(charge.totalAmount)}</div>
        </div>

        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] border border-t-0 border-black">
          <div className="border-r border-black">
            <div className="grid grid-cols-[minmax(0,1fr)_190px] border-b border-black">
              <div className="border-r border-black px-2 py-2 text-[12.5px] leading-5">
                Thanh toán tiền mặt <span className="italic">(PH mang kèm thông báo này để thu)</span>
              </div>
              <div className="px-2 py-2 text-[12.5px] leading-5">
                Tại các cơ sở <span className="italic">(có kèm theo liên hồng của TT)</span>
              </div>
            </div>

            <div className="grid grid-cols-[160px_130px_minmax(0,1fr)]">
              <div className="border-r border-black px-2 py-2 text-[12.5px] leading-5">
                <p>Thanh toán chuyển khoản</p>
                <p>
                  <strong>NH:</strong> {paymentProfile?.bankName || "Chưa cấu hình"}
                </p>
                <p>
                  <strong>STK:</strong> {paymentProfile?.accountNumber || "Chưa cấu hình"}
                </p>
                <p>{paymentProfile?.accountHolder || "Chưa cấu hình chủ tài khoản"}</p>
              </div>

              <div className="flex items-center justify-center border-r border-black px-2 py-2">
                {paymentProfile?.qrImageData ? (
                  <img src={paymentProfile.qrImageData} alt="QR thanh toán" className="h-[92px] w-[92px] object-contain" />
                ) : (
                  <div className="flex h-[92px] w-[92px] items-center justify-center border border-dashed border-slate-400 p-2 text-center text-[10px] text-slate-500">
                    Chưa có QR
                  </div>
                )}
              </div>

              <div className="px-2 py-2 text-[12.5px] leading-5">
                <p>
                  <span className="italic">Nội dung:</span> <strong>{transferContent}</strong>
                </p>
                <p className="mt-1">{paymentProfile?.paymentInstruction || "PH chuyển khoản xong chụp xác nhận gửi cho giáo vụ / nhóm phụ huynh."}</p>
              </div>
            </div>
          </div>

          <div className="text-[12.5px] leading-5">
            <div className="border-b border-black px-2 py-2">
              <p>
                Đã thanh toán: <strong>{formatVnd(paid)}</strong>
              </p>
              <p>
                Còn cần nộp: <strong>{formatVnd(remaining)}</strong>
              </p>
            </div>
            <div className="px-2 py-2">
              <p>
                Hạn thanh toán: <strong>{dueDateLabel}</strong>
              </p>
              <p className="mt-1">Ngày xuất: {charge.invoice ? formatDate(charge.invoice.issuedAt) : "—"}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 text-center leading-5">
          <p className="text-[12.5px] italic">Mọi thắc mắc PH liên hệ trực tiếp với Trung tâm để được giải đáp.</p>
          <p className="text-[15px] font-bold uppercase italic">{branchName} - chất lượng là mục tiêu hoạt động</p>
          <p className="text-[12.5px]">Chân thành cảm ơn sự tin tưởng của Quý phụ huynh!</p>
        </div>
      </div>
    </div>
  );
}
