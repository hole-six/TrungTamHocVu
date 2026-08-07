import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import AdminCreateUserDrawer from "@/components/admin/AdminCreateUserDrawer";
import UserAdminActions from "@/components/admin/UserAdminActions";
import PageGuide from "@/components/ui/PageGuide";

function formatDateTime(d: Date | null) {
  return d ? new Date(d).toLocaleString("vi-VN") : "—";
}

const USERS_PAGE_SIZE = 30;
const ADMIN_PAGE_GUIDE_SECTIONS = [
  {
    title: "Mục tiêu trang này",
    items: [
      "Quản lý người dùng, vai trò và cơ sở trong cùng một khu điều hành.",
      "Tạo tài khoản mới, sửa user hiện có và điều phối quyền truy cập theo vai trò.",
      "Đi nhanh sang danh sách cơ sở hoặc vai trò khi cần chỉnh cấu hình hệ thống.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Tìm user theo tên hoặc email để ra đúng người cần xử lý.",
      "Dùng nút tạo người dùng để cấp user, cơ sở và vai trò ngay trong một form.",
      "Khi cần quản trị sâu hơn, mở trang Cơ sở hoặc Vai trò từ các nút điều hướng trên header.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Vai trò quyết định phạm vi xem và thao tác của toàn hệ thống nên cần gán thật đúng.",
      "Sai cơ sở sẽ khiến user nhìn nhầm dữ liệu, vì vậy luôn kiểm tra branch trước khi lưu.",
      "Sau khi đổi quyền, đôi lúc người dùng cần tải lại phiên làm việc để thấy quyền mới ổn định.",
    ],
    tone: "warning" as const,
  },
];

function buildQuery(base: Record<string, string | undefined>, overrides: Record<string, string | number>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...overrides })) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getAvatarGradient(index: number): string {
  const gradients = [
    "from-[#f97316] to-[#ea580c]",
    "from-[#0ea5e9] to-[#2563eb]",
    "from-[#10b981] to-[#059669]",
    "from-[#8b5cf6] to-[#7c3aed]",
    "from-[#ec4899] to-[#db2777]",
  ];
  return gradients[index % gradients.length];
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { userQuery?: string; userPage?: string; openCreateUser?: string };
}) {
  const currentUser = await getCurrentUser();

  const userQuery = searchParams.userQuery?.trim() ?? "";
  const userPage = Math.max(1, Number(searchParams.userPage) || 1);
  const createUserOpen = searchParams.openCreateUser === "1";

  const userWhere: Prisma.UserWhereInput = userQuery
    ? {
        OR: [{ fullName: { contains: userQuery } }, { email: { contains: userQuery } }],
      }
    : {};

  const [branches, roles, userTotal, users, branchCount] = await Promise.all([
    prisma.branch.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { users: true, students: true } } },
    }),
    prisma.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.user.count({ where: userWhere }),
    prisma.user.findMany({
      where: userWhere,
      orderBy: { createdAt: "asc" },
      include: { branch: true, roleRef: true },
      skip: (userPage - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
    }),
    prisma.branch.count(),
  ]);

  const userPageCount = Math.max(1, Math.ceil(userTotal / USERS_PAGE_SIZE));
  const userBaseQuery = { userQuery: searchParams.userQuery };
  const activeUsers = users.filter((u) => u.isActive).length;

  return (
    <div className="min-h-screen space-y-6 pb-20 sm:space-y-8">
      <PageGuide
        title="Guide quản trị"
        summary="Giải thích nhanh cách dùng khu quản trị để tránh cấp sai user hoặc sai quyền."
        sections={ADMIN_PAGE_GUIDE_SECTIONS}
        buttonLabel="Guide quản trị"
      />
      <section className="rounded-2xl border border-[#dbe7ff] bg-white px-4 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:px-6 sm:py-6 md:rounded-[32px] md:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between sm:gap-6">
          <div className="space-y-2 sm:space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#3da3ff] sm:text-xs">Admin</p>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#12304a] sm:text-3xl md:text-4xl">Quản trị hệ thống</h1>
              <p className="mt-1.5 text-xs text-[#5f7084] sm:mt-2 sm:max-w-2xl sm:text-sm md:text-base">
                Quản lý người dùng, vai trò và cơ sở trong cùng một màn. Tạo tài khoản mới ngay tại đây để vận hành nhanh hơn.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/branches" className="btn-ghost">
              Cơ sở
            </Link>
            <Link href="/admin/roles" className="btn-ghost">
              Vai trò
            </Link>
            <AdminCreateUserDrawer
              branches={branches.map((branch) => ({ id: branch.id, code: branch.code, name: branch.name }))}
              roles={roles}
              initialOpen={createUserOpen}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2">
          <Link
            href="/admin/branches"
            className="group flex items-center justify-between rounded-2xl border border-[#e8eef8] bg-[#fffaf5] px-4 py-4 transition hover:border-[#ffd4a8] hover:shadow-md sm:rounded-[24px] sm:px-5 sm:py-5 md:rounded-[28px]"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] shadow-[0_12px_24px_rgba(249,115,22,0.25)] sm:h-14 sm:w-14 sm:rounded-2xl">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" className="sm:h-6 sm:w-6">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-[#12304a] sm:text-xl">Cơ sở</p>
                <p className="mt-0.5 text-xs text-[#6d7d90] sm:mt-1 sm:text-sm">{branchCount} địa điểm</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#f97316] transition group-hover:translate-x-1 sm:text-sm">Mở →</span>
          </Link>

          <Link
            href="/admin/roles"
            className="group flex items-center justify-between rounded-2xl border border-[#e8eef8] bg-[#fff8f6] px-4 py-4 transition hover:border-[#ffc5bc] hover:shadow-md sm:rounded-[24px] sm:px-5 sm:py-5 md:rounded-[28px]"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#ea580c] to-[#dc2626] shadow-[0_12px_24px_rgba(234,88,12,0.22)] sm:h-14 sm:w-14 sm:rounded-2xl">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" className="sm:h-6 sm:w-6">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-[#12304a] sm:text-xl">Vai trò</p>
                <p className="mt-0.5 text-xs text-[#6d7d90] sm:mt-1 sm:text-sm">{roles.length} quyền hạn</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#ea580c] transition group-hover:translate-x-1 sm:text-sm">Mở →</span>
          </Link>
        </div>
      </section>

     

      <section className="overflow-hidden rounded-2xl border border-[#dbe7ff] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.05)] sm:rounded-[26px] md:rounded-[30px]">
        <div className="flex flex-col gap-3 border-b border-[#e8eef8] px-4 py-4 sm:gap-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#12304a] sm:text-2xl">Danh sách người dùng</h2>
            <p className="mt-1 text-xs text-[#6d7d90] sm:text-sm">Theo dõi tài khoản, vai trò, cơ sở và thao tác quản trị ngay trong một bảng gọn.</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="rounded-full border border-[#dbe7ff] bg-[#f7fbff] px-2.5 py-0.5 text-xs font-medium text-[#235f9d] sm:px-3 sm:py-1 sm:text-sm">
              {userTotal} tài khoản
            </span>
            <span className="rounded-full border border-[#dbe7ff] bg-white px-2.5 py-0.5 text-xs font-medium text-[#5f7084] sm:px-3 sm:py-1 sm:text-sm">
              {activeUsers} hoạt động
            </span>
          </div>
        </div>

        <div className="border-b border-[#e8eef8] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <form action="/admin" method="GET" className="flex w-full flex-col gap-2 sm:flex-row sm:gap-3 xl:max-w-2xl">
              <div className="relative flex-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" className="absolute left-3 top-1/2 -translate-y-1/2 sm:left-4 sm:h-[18px] sm:w-[18px]">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  name="userQuery"
                  defaultValue={userQuery}
                  placeholder="Tìm tên hoặc email..."
                  className="h-11 w-full rounded-xl border-2 border-[#dbe7ff] bg-white pl-10 pr-3 text-xs font-medium text-[#0f1729] placeholder:text-[#94a3b8] outline-none transition focus:border-[#3da3ff] focus:ring-4 focus:ring-[#3da3ff]/10 sm:h-12 sm:rounded-2xl sm:pl-12 sm:pr-4 sm:text-sm"
                />
              </div>
              <button type="submit" className="btn-ghost h-11 sm:h-12">
                Tìm
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <span className="rounded-full border border-[#dbe7ff] bg-[#f7fbff] px-2.5 py-0.5 text-xs font-medium text-[#235f9d] sm:px-3 sm:py-1 sm:text-sm">
                Trang {userPage}/{userPageCount}
              </span>
              <span className="rounded-full border border-[#e8eef8] bg-white px-2.5 py-0.5 text-xs font-medium text-[#5f7084] sm:px-3 sm:py-1 sm:text-sm">
                {users.length} bản ghi
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full min-w-[1080px]">
            <thead className="border-b border-[#e8eef8] bg-[#f8fbff]">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-[#7b8ea5]">Người dùng</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-[#7b8ea5]">Đăng nhập</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-[#7b8ea5]">Phân quyền</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.16em] text-[#7b8ea5]">Tác vụ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={u.id} className="border-b border-[#eef3f9] last:border-0 hover:bg-[#fbfdff]">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarGradient(idx)} text-sm font-black text-white shadow-md`}>
                        {getUserInitials(u.fullName)}
                        {u.isActive ? <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-[#10b981]" /> : null}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#12304a]">{u.fullName}</p>
                          {u.id === currentUser?.id ? (
                            <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-bold text-[#2563eb]">Bạn</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[#7b8ea5]">{u.roleRef?.name ?? "Chưa gán vai trò"}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <p className="font-medium text-[#3e5368]">{u.email}</p>
                    <p className="mt-1 text-xs text-[#7b8ea5]">
                      {u.lastLoginAt ? `Đăng nhập: ${formatDateTime(u.lastLoginAt)}` : "Chưa đăng nhập"}
                    </p>
                  </td>

                  <td className="px-6 py-5">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#dbe7ff] bg-[#f7fbff] px-3 py-1 text-xs font-semibold text-[#235f9d]">
                          {u.roleRef?.name ?? "Chưa gán vai trò"}
                        </span>
                        <span
                          className={
                            u.isActive
                              ? "rounded-full border border-[#c7f2dd] bg-[#effcf4] px-3 py-1 text-xs font-semibold text-[#0f9f61]"
                              : "rounded-full border border-[#ffd5dd] bg-[#fff5f7] px-3 py-1 text-xs font-semibold text-[#e11d48]"
                          }
                        >
                          {u.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </div>
                      <p className="text-xs text-[#7b8ea5]">{u.branch?.name ?? "Chưa gán cơ sở"}</p>
                    </div>
                  </td>

                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-[#dbe7ff] px-4 py-2 text-sm font-semibold text-[#235f9d] transition hover:bg-[#f7fbff]"
                      >
                        Xem
                      </Link>
                      <UserAdminActions
                        user={{
                          id: u.id,
                          email: u.email,
                          fullName: u.fullName,
                          roleId: u.roleId,
                          branchId: u.branchId,
                          isActive: u.isActive,
                        }}
                        branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
                        roles={roles}
                        isSelf={u.id === currentUser?.id}
                      />
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-sm font-medium text-[#7b8ea5]">
                    Không tìm thấy người dùng phù hợp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-4 px-4 py-4 lg:hidden">
          {users.map((u, idx) => (
            <div key={u.id} className="rounded-2xl border border-[#e8eef8] bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarGradient(idx)} text-sm font-black text-white shadow-md`}>
                  {getUserInitials(u.fullName)}
                  {u.isActive ? <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-[#10b981]" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-[#12304a] truncate">{u.fullName}</p>
                    {u.id === currentUser?.id ? (
                      <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-bold text-[#2563eb]">Bạn</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-[#7b8ea5] mb-1 truncate">{u.email}</p>
                  <p className="text-[10px] text-[#7b8ea5]">
                    {u.lastLoginAt ? `Đăng nhập: ${formatDateTime(u.lastLoginAt)}` : "Chưa đăng nhập"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#e8eef8] pt-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#dbe7ff] bg-[#f7fbff] px-3 py-1 text-xs font-semibold text-[#235f9d]">
                    {u.roleRef?.name ?? "Chưa gán vai trò"}
                  </span>
                  <span
                    className={
                      u.isActive
                        ? "rounded-full border border-[#c7f2dd] bg-[#effcf4] px-3 py-1 text-xs font-semibold text-[#0f9f61]"
                        : "rounded-full border border-[#ffd5dd] bg-[#fff5f7] px-3 py-1 text-xs font-semibold text-[#e11d48]"
                    }
                  >
                    {u.isActive ? "Đang hoạt động" : "Đã khóa"}
                  </span>
                </div>
                <p className="text-xs text-[#7b8ea5]">
                  <span className="font-medium">Cơ sở:</span> {u.branch?.name ?? "Chưa gán cơ sở"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-[#e8eef8] pt-3">
                <Link
                  href={`/admin/users/${u.id}`}
                  className="flex-1 inline-flex items-center justify-center rounded-xl border border-[#dbe7ff] px-4 py-2 text-sm font-semibold text-[#235f9d] transition hover:bg-[#f7fbff]"
                >
                  Xem
                </Link>
                <UserAdminActions
                  user={{
                    id: u.id,
                    email: u.email,
                    fullName: u.fullName,
                    roleId: u.roleId,
                    branchId: u.branchId,
                    isActive: u.isActive,
                  }}
                  branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
                  roles={roles}
                  isSelf={u.id === currentUser?.id}
                />
              </div>
            </div>
          ))}

          {users.length === 0 ? (
            <div className="py-12 text-center text-sm font-medium text-[#7b8ea5]">
              Không tìm thấy người dùng phù hợp.
            </div>
          ) : null}
        </div>

        {userPageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-[#e8eef8] px-6 py-5">
            <p className="text-sm text-[#5f7084]">
              Trang {userPage} / {userPageCount}
            </p>

            <div className="flex gap-2">
              {userPage > 1 ? (
                <Link href={`/admin${buildQuery(userBaseQuery, { userPage: userPage - 1 })}`} className="btn-ghost">
                  Trước
                </Link>
              ) : null}
              {userPage < userPageCount ? (
                <Link href={`/admin${buildQuery(userBaseQuery, { userPage: userPage + 1 })}`} className="btn-ghost">
                  Sau
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
