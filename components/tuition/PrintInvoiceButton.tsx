"use client";

// In 1 phiếu học phí — mở ĐÚNG phiếu mà trang Học phí đang xuất (cùng route
// /api/invoices/[chargeId]/pdf, cùng thông tin chuyển khoản/QR của cơ sở) trong tab mới
// để xem và bấm in ngay. Dùng ở hồ sơ học viên và ngay sau khi gán lớp, để giáo vụ in
// phiếu cho đúng 1 em tại quầy mà không phải sang trang Học phí lọc lại học viên đó.
export default function PrintInvoiceButton({
  chargeId,
  label = "In phiếu",
  className,
}: {
  chargeId: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`/api/invoices/${chargeId}/pdf?inline=1`}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-bold text-[#0f1729] transition hover:border-[#0f1729]"
      }
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      {label}
    </a>
  );
}
