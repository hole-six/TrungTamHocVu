"use client";

import { useState } from "react";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import NewUserForm from "@/components/admin/NewUserForm";
import FormGuide from "@/components/ui/FormGuide";

type Branch = { id: string; code: string; name: string };
type Role = { id: string; code: string; name: string };

const GUIDE_SECTIONS = [
  {
    title: "Form này dành cho ai?",
    items: [
      "Dùng khi admin cần tạo tài khoản đăng nhập mới cho nhân sự vận hành, giáo viên, kế toán hoặc các vai trò khác trong hệ thống.",
      "Nên tạo đúng tài khoản theo từng người thật, không dùng chung tài khoản nếu muốn theo dõi trách nhiệm và lịch sử thao tác rõ ràng.",
      "Sau khi tạo xong, người dùng sẽ đăng nhập bằng email và mật khẩu khởi tạo này.",
    ],
    tone: "info" as const,
  },
  {
    title: "Nhập thế nào cho chuẩn?",
    items: [
      "Họ tên nên là tên thật để sau này đối chiếu với nhân sự và các log hành động.",
      "Vai trò quyết định quyền xem/sửa/xóa trong hệ thống, nên phải chọn rất cẩn thận.",
      "Chi nhánh giúp lọc dữ liệu theo cơ sở, đặc biệt quan trọng nếu trung tâm có nhiều cơ sở hoạt động song song.",
    ],
    tone: "success" as const,
  },
  {
    title: "Cần tránh điều gì?",
    items: [
      "Không tạo nhầm 2 tài khoản cho cùng một người nếu không có chủ đích rõ ràng.",
      "Không cấp vai trò quá cao chỉ vì tiện thao tác.",
      "Mật khẩu khởi tạo nên chuyển riêng cho người dùng, không gửi công khai vào nhóm vận hành.",
    ],
    tone: "warning" as const,
  },
];

export default function AdminCreateUserDrawer({
  branches,
  roles,
  initialOpen = false,
}: {
  branches: Branch[];
  roles: Role[];
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8M8 12h8" />
        </svg>
        Tạo người dùng
      </button>

      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo người dùng mới"
        description="Tạo tài khoản ngay tại màn admin để khỏi phải chuyển trang. Chọn vai trò, chi nhánh rồi tạo luôn."
        widthClassName="max-w-3xl"
        guide={<FormGuide title="Hướng dẫn tạo người dùng mới" summary="Đây là form cấp tài khoản đăng nhập cho người sử dụng hệ thống. Khi tạo đúng vai trò và chi nhánh ngay từ đầu, việc vận hành và phân quyền sẽ gọn hơn rất nhiều." sections={GUIDE_SECTIONS} position="inline" />}
      >
        <NewUserForm branches={branches} roles={roles} compact onCancel={() => setOpen(false)} onSuccess={() => setOpen(false)} />
      </ResponsiveDrawer>
    </>
  );
}
