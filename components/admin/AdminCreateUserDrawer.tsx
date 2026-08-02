"use client";

import { useState } from "react";
import SlideOver from "@/components/ui/SlideOver";
import NewUserForm from "@/components/admin/NewUserForm";

type Branch = { id: string; code: string; name: string };
type Role = { id: string; code: string; name: string };

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

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo người dùng mới"
        description="Tạo tài khoản ngay tại màn admin để khỏi phải chuyển trang. Chọn vai trò, chi nhánh rồi tạo luôn."
        widthClassName="max-w-3xl"
      >
        <NewUserForm branches={branches} roles={roles} compact onCancel={() => setOpen(false)} onSuccess={() => setOpen(false)} />
      </SlideOver>
    </>
  );
}
