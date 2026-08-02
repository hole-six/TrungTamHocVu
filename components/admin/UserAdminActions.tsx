"use client";

import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import UserEditDrawer from "@/components/admin/UserEditDrawer";

type Branch = { id: string; name: string };
type Role = { id: string; code: string; name: string };

type UserItem = {
  id: string;
  email: string;
  fullName: string;
  roleId: string | null;
  branchId: string | null;
  isActive: boolean;
};

export default function UserAdminActions({
  user,
  branches,
  roles,
  isSelf,
}: {
  user: UserItem;
  branches: Branch[];
  roles: Role[];
  isSelf: boolean;
}) {
  const router = useRouter();

  async function deleteUser() {
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Không thể xóa người dùng.");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <UserEditDrawer user={user} branches={branches} roles={roles} />
      <ConfirmActionButton
        title="Xác nhận xóa người dùng?"
        description={
          isSelf
            ? "Bạn không thể tự xóa tài khoản của chính mình."
            : `Bạn có chắc chắn muốn xóa tài khoản ${user.fullName}? Chỉ nên xóa khi tài khoản này chưa gắn với nhân sự hoặc phụ huynh.`
        }
        confirmLabel="Xóa người dùng"
        tone="danger"
        disabled={isSelf}
        className="inline-flex items-center justify-center rounded-xl border border-[#ffd5dd] bg-[#fff5f7] px-4 py-2 text-sm font-semibold text-[#e11d48] transition hover:bg-[#ffecef] disabled:cursor-not-allowed disabled:opacity-50"
        onConfirm={deleteUser}
      >
        Xóa
      </ConfirmActionButton>
    </div>
  );
}
