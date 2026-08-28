import { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import UserRoleEditor from "@/components/admin/UserRoleEditor";
import ModuleOverrideEditor from "@/components/admin/ModuleOverrideEditor";
import {
  ROLE_MATRIX,
  MODULE_LABEL,
  ACCESS_LEVEL_LABEL,
  OVERRIDE_AWARE_MODULES,
  type ModuleKey,
  type RoleCode,
  type AccessLevel,
} from "@/lib/server/role-matrix";

export const metadata: Metadata = { title: "Chi tiết người dùng" };

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const [target, branches, roles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      include: { roleRef: true, moduleOverrides: true },
    }),
    prisma.branch.findMany({ orderBy: { code: "asc" } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!target) notFound();

  const isSelf = target.id === session.user.id;
  const roleCode = target.roleRef?.code as RoleCode | undefined;
  const overrideByModule = new Map(target.moduleOverrides.map((o) => [o.module as ModuleKey, o]));
  const moduleKeys = Object.keys(MODULE_LABEL) as ModuleKey[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{target.fullName}</h1>
          <p className="mt-1 text-sm text-ink-muted48">
            {target.email} · {target.roleRef?.name ?? "Chưa gán vai trò"}
          </p>
        </div>
        <BackButton href="/admin" className="btn-ghost">
          ← Quay lại danh sách người dùng
        </BackButton>
      </div>

      <div className="card">
        <h2 className="font-display text-base font-bold text-ink">Vai trò / Chi nhánh / Trạng thái</h2>
        <div className="mt-3">
          <UserRoleEditor
            userId={target.id}
            roleId={target.roleId}
            branchId={target.branchId}
            isActive={target.isActive}
            branches={branches}
            roles={roles}
            isSelf={isSelf}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Quyền bổ sung theo module</h2>
          <p className="mt-1 text-sm text-ink-muted48">
            Cấp thêm chức năng riêng cho {target.fullName} ngoài quyền mặc định của vai trò{" "}
            {target.roleRef?.name ?? "hiện tại"} — không cần đổi vai trò hay tạo phòng ban mới. Override chỉ CỘNG
            THÊM quyền, không bao giờ bớt đi quyền vai trò đã có.
          </p>
        </div>

        {isSelf ? (
          <div className="alert-warning">Không thể tự cấp quyền bổ sung cho chính mình.</div>
        ) : (
          <div className="space-y-2">
            {moduleKeys.map((module) => {
              const defaultLevel = roleCode ? ROLE_MATRIX[module][roleCode] ?? "NONE" : "NONE";
              const override = overrideByModule.get(module);
              return (
                <ModuleOverrideEditor
                  key={module}
                  userId={target.id}
                  module={module}
                  moduleLabel={MODULE_LABEL[module]}
                  defaultLevelLabel={ACCESS_LEVEL_LABEL[defaultLevel]}
                  currentOverride={(override?.level as AccessLevel) ?? null}
                  levelLabel={ACCESS_LEVEL_LABEL}
                  overrideAware={OVERRIDE_AWARE_MODULES.includes(module)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
