import Link from "next/link";

// Màn "không có quyền" dùng chung.
//
// Trước đây các trang gọi notFound() khi người dùng thiếu quyền, nên giáo vụ bấm vào
// một mục rồi nhận trang trắng "không tìm thấy" — không biết là hệ thống hỏng hay mình
// không được phép, và việc tiếp theo luôn là gọi điện hỏi. API đã làm đúng từ lâu (trả
// 403 kèm câu giải thích), chỉ có giao diện là chưa.
//
// Cũng KHÔNG nên dùng chỗ này cho bản ghi không tồn tại — cái đó vẫn phải là notFound().
export default function NoPermission({
  module,
  hint,
}: {
  /** Tên mục theo cách người dùng gọi, ví dụ "Thu chi", "Bảng lương". */
  module: string;
  /** Câu gợi ý thêm nếu có cách khác để lấy thông tin. */
  hint?: string;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-2xl">
        🔒
      </div>
      <h1 className="mt-5 text-xl font-black text-[#0f1729]">Bạn không có quyền xem mục {module}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#64748b]">
        Hệ thống vẫn hoạt động bình thường — chỉ là vai trò của bạn không được mở mục này.
        {hint ? ` ${hint}` : ""} Nếu công việc của bạn cần tới nó, nhờ quản lý cấp thêm quyền giúp.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-xl bg-[#0f1729] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1e293b]"
        >
          Về trang tổng quan
        </Link>
      </div>
    </div>
  );
}
