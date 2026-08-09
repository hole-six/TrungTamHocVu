"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import GuardianForm from "@/components/guardians/GuardianForm";
import FormGuide from "@/components/ui/FormGuide";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";

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

  return (
    <ResponsiveDrawer
      open={isOpen}
      onClose={onClose}
      title="Thêm phụ huynh mới"
      description="Tạo hồ sơ phụ huynh vào hệ thống"
      widthClassName="max-w-2xl"
      guide={
        <FormGuide
          title="Hướng dẫn tạo phụ huynh mới"
          summary="Hồ sơ phụ huynh là nút rất quan trọng trong vận hành vì nó liên quan trực tiếp tới liên hệ, học phí và các thông báo gửi ra ngoài. Tạo đúng ngay từ đầu sẽ đỡ rất nhiều công sửa sau này."
          sections={GUIDE_SECTIONS}
          position="inline"
        />
      }
    >
      <GuardianForm
        onSuccess={(guardianId) => {
          onClose();
          router.push(`/guardians/${guardianId}`);
          router.refresh();
        }}
        onCancel={onClose}
      />
    </ResponsiveDrawer>
  );
}
