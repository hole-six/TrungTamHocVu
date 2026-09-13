"use client";

// Bộ khối dùng chung cho các drawer "chi tiết 1 thực thể" (học viên, lớp học...) —
// CỐ TÌNH tối giản: 1 khung viền duy nhất mỗi Section, không khung lồng khung bên
// trong. Row/Stat chỉ là label+giá trị, không tự vẽ viền — nội dung nào cần khung
// riêng (form, danh sách phụ) thì tự quyết định, không mặc định có sẵn.

// Style dùng chung cho hàng nút "hành động nhanh" ngay trong thân drawer — CỐ TÌNH
// trung tính (viền trắng, chữ đen, chỉ đổi màu khi hover), không dùng màu cam
// thương hiệu (.btn-primary) vốn để dành cho đúng 1 CTA thật sự quan trọng (vd
// "Thu tiền ngay" khi có công nợ) — một hàng 3-4 nút thao tác thường ngày mà cái
// nào cũng cam sẽ không còn phân biệt được đâu là việc thật sự cần ưu tiên.
export const ACTION_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-bold text-[#0f1729] shadow-sm transition hover:border-[#0f1729] hover:text-[#0f1729] disabled:cursor-not-allowed disabled:opacity-60";

export function Section({
  id,
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  /** DOM id — dùng khi nơi gọi cần tự mở section này bằng tay (vd
   *  `document.getElementById(id).open = true`) thay vì qua click của người dùng. */
  id?: string;
  title: string;
  hint?: string | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className="group overflow-hidden rounded-xl border border-[#e5eaf7] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-[#f8faff] [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-black text-[#0f1729]">{title}</span>
        <span className="flex min-w-0 items-center gap-2">
          {hint ? <span className="truncate text-sm text-[#64748b]">{hint}</span> : null}
          <svg
            className="h-4 w-4 shrink-0 text-[#94a3b8] transition-transform group-open:rotate-180"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-[#f1f5f9] px-4 py-4">{children}</div>
    </details>
  );
}

// Danh sách trường dạng 1 dòng đầy đủ chiều ngang — dùng khi giá trị dài/không đều
// (văn xuôi, danh sách biến động), khó xếp gọn vào lưới cố định.
export function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="flex gap-3 border-b border-[#f1f5f9] py-2 last:border-0">
      <span className="w-[124px] shrink-0 text-xs text-[#94a3b8]">{label}</span>
      <span className={`flex-1 text-sm ${empty ? "text-[#cbd5e1]" : "font-medium text-[#0f1729]"}`}>
        {empty ? "—" : children}
      </span>
    </div>
  );
}

// Danh sách trường cố định xếp thành lưới 2-3 cột thay vì mỗi trường 1 dòng đầy đủ
// chiều ngang — cùng nội dung nhưng chiếm ít chiều cao hơn hẳn, không cần khung/viền
// riêng vì đã nằm trong khung của Section cha.
export function Stat({ label, wide, children }: { label: string; wide?: boolean; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className={wide ? "col-span-full" : ""}>
      <p className="text-xs text-[#94a3b8]">{label}</p>
      <p className={`mt-0.5 text-sm ${empty ? "text-[#cbd5e1]" : "font-semibold text-[#0f1729]"}`}>{empty ? "—" : children}</p>
    </div>
  );
}
