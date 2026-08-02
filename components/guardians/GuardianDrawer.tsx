"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import GuardianForm from "@/components/guardians/GuardianForm";
import FormGuide from "@/components/ui/FormGuide";

const GUIDE_SECTIONS = [
  {
    title: "Tạo phụ huynh mới khi nào?",
    items: [
      "Dùng khi trung tâm cần tạo hồ sơ người liên hệ chính của học viên để lưu số điện thoại, thông tin trao đổi và liên kết học phí sau này.",
      "Một phụ huynh có thể liên kết với một hoặc nhiều học viên, nên hồ sơ phụ huynh cần được nhập đúng ngay từ đầu.",
      "Nếu phụ huynh đã tồn tại trong hệ thống thì không nên tạo mới trùng, hãy tìm lại để liên kết thêm học viên.",
    ],
    tone: "info" as const,
  },
  {
    title: "Những gì cần nhập cẩn thận",
    items: [
      "Tên, số điện thoại và quan hệ với học viên phải thật chính xác vì đây là dữ liệu vận hành dùng hằng ngày.",
      "Nếu có email hoặc thông tin portal phụ huynh thì càng nên nhập đúng để tránh lỗi cấp tài khoản sau này.",
      "Luôn nghĩ theo góc nhìn CSO: đây là người sẽ nhận thông báo, học phí, lịch học và các trao đổi vận hành quan trọng.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi hay gặp",
    items: [
      "Tạo trùng phụ huynh chỉ vì khác cách viết tên hoặc chưa kiểm tra số điện thoại.",
      "Nhập sai số điện thoại làm đứt luồng liên hệ và gửi thông báo.",
      "Bỏ qua thông tin quan hệ với học viên khiến người sau khó hiểu ai là người chịu trách nhiệm chính.",
    ],
    tone: "warning" as const,
  },
];

export default function GuardianDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="slideover-root">
      <div className="slideover-backdrop" onClick={onClose} />

      <div className="slideover-panel max-w-2xl">
        <div className="slideover-header">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 shadow-lg shadow-sky-500/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-ink">Thêm phụ huynh mới</h3>
                <p className="text-sm text-ink-muted48">Tạo hồ sơ phụ huynh vào hệ thống</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FormGuide title="Hướng dẫn tạo phụ huynh mới" summary="Hồ sơ phụ huynh là nút rất quan trọng trong vận hành vì nó liên quan trực tiếp tới liên hệ, học phí và các thông báo gửi ra ngoài. Tạo đúng ngay từ đầu sẽ đỡ rất nhiều công sửa sau này." sections={GUIDE_SECTIONS} position="inline" />
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-white text-ink-muted48 transition-all hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="slideover-body">
          <GuardianForm
            onSuccess={(guardianId) => {
              onClose();
              router.push(`/guardians/${guardianId}`);
              router.refresh();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
