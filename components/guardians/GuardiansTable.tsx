"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTableResponsive from "@/components/ui/DataTable/DataTableResponsive";
import type { Column, BulkAction } from "@/components/ui/DataTable";
import { isFrontDeskRole, isTeachingStaffRole } from "@/lib/client-roles";
import { exportToExcel } from "@/lib/export-utils";
import GuardianDrawer from "@/components/guardians/GuardianDrawer";

type GuardianChild = {
  id: string;
  fullName: string;
  leadCode?: string | null;
  className?: string | null;
  outstanding: number;
};

type Guardian = {
  id: string;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  portalEmail?: string | null;
  portalActive?: boolean;
  leads?: Array<{ id: string; leadCode: string }>;
  children?: GuardianChild[];
  _count?: {
    leads: number;
    students: number;
  };
};

type GuardiansTableProps = {
  initialData: Guardian[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
  stats?: {
    total: number;
    withPortal: number;
    withStudents: number;
    withDebt: number;
    linkedStudents: number;
  };
};

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function guardianDebt(children: GuardianChild[] | undefined) {
  return (children ?? []).reduce((sum, child) => sum + Math.max(0, child.outstanding), 0);
}

export default function GuardiansTable({
  initialData,
  total,
  page,
  pageSize,
  userRole,
  stats,
}: GuardiansTableProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [filterKey, setFilterKey] = useState<"ALL" | "PORTAL" | "DEBT" | "STUDENTS">("ALL");
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const visibleData = data.filter((row) => {
    if (filterKey === "PORTAL") return Boolean(row.portalEmail);
    if (filterKey === "DEBT") return guardianDebt(row.children) > 0;
    if (filterKey === "STUDENTS") return (row._count?.students ?? 0) > 0;
    return true;
  });

  const exportRows = (rows: Guardian[]) => {
    exportToExcel(
      rows.map((row) => ({
        fullName: row.fullName,
        phone: row.phone ?? "",
        portalEmail: row.portalEmail ?? "",
        portalStatus: row.portalEmail ? (row.portalActive ? "Đang hoạt động" : "Chưa kích hoạt") : "Chưa cấp",
        address: row.address ?? "",
        studentCount: row._count?.students ?? 0,
        leadCount: row._count?.leads ?? 0,
        totalDebt: guardianDebt(row.children),
        linkedStudents: row.children?.map((child) => child.fullName).join(", ") ?? "",
      })),
      [
        { key: "fullName", label: "Phụ huynh" },
        { key: "phone", label: "Số điện thoại" },
        { key: "portalEmail", label: "Portal" },
        { key: "portalStatus", label: "Trạng thái portal" },
        { key: "address", label: "Địa chỉ" },
        { key: "studentCount", label: "Số học viên" },
        { key: "leadCount", label: "Số lead" },
        { key: "totalDebt", label: "Tổng công nợ" },
        { key: "linkedStudents", label: "Học viên liên kết" },
      ],
      "phu-huynh",
      "PhuHuynh",
    );
  };

  const columns: Column<Guardian>[] = [
    {
      key: "fullName",
      label: "Phụ huynh",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 via-cyan-50 to-white text-sm font-bold text-sky-700 shadow-sm ring-1 ring-sky-100">
            {value.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{value}</p>
            <p className="mt-1 text-xs text-ink-muted48">
              {(row._count?.students ?? 0) > 0 ? `${row._count?.students} học viên liên kết` : "Chưa liên kết học viên"}
            </p>
            {row.address ? <p className="mt-1 truncate text-xs text-ink-muted48">{row.address}</p> : null}
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Liên hệ / Portal",
      render: (value, row) => (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-ink">{value ?? "Chưa có số điện thoại"}</p>
            <p className="mt-1 text-xs text-ink-muted48">{row.portalEmail ?? "Chưa cấp portal"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`badge ${row.portalEmail ? (row.portalActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700") : "bg-slate-100 text-slate-600"}`}>
              {row.portalEmail ? (row.portalActive ? "Portal hoạt động" : "Portal chưa kích hoạt") : "Chưa có portal"}
            </span>
            {(row._count?.leads ?? 0) > 0 ? <span className="badge bg-sky-50 text-sky-700">{row._count?.leads} lead liên quan</span> : null}
          </div>
        </div>
      ),
    },
    {
      key: "children",
      label: "Học viên đang theo dõi",
      render: (value) =>
        value && value.length > 0 ? (
          <div className="space-y-2">
            {value.slice(0, 2).map((child: GuardianChild) => (
              <div key={child.id} className="rounded-2xl border border-hairline bg-canvas-parchment/35 px-3 py-2">
                <p className="text-sm font-semibold text-ink">{child.fullName}</p>
                <p className="mt-1 text-xs text-ink-muted48">
                  {child.className ?? "Chưa có lớp"} {child.leadCode ? `· Lead ${child.leadCode}` : ""}
                </p>
              </div>
            ))}
            {value.length > 2 ? <p className="text-xs font-medium text-primary">+ {value.length - 2} học viên khác</p> : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-hairline bg-canvas-parchment/20 px-3 py-4 text-xs text-ink-muted48">
            Chưa liên kết học viên
          </div>
        ),
    },
    {
      key: "id",
      label: "Công nợ / 360",
      render: (_, row) => {
        const totalDebt = guardianDebt(row.children);
        const firstStudent = row.children?.[0];
        return (
          <div className="space-y-3">
            <div>
              <p className={`text-sm font-bold ${totalDebt > 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatVnd(totalDebt)}</p>
              <p className="mt-1 text-xs text-ink-muted48">
                {totalDebt > 0 ? "Tổng công nợ của các học viên liên kết" : "Hiện không có công nợ"}
              </p>
            </div>
            {firstStudent ? (
              <button type="button" onClick={() => router.push(`/students/${firstStudent.id}`)} className="btn-360-sm">
                Mở hồ sơ 360
              </button>
            ) : (
              <button type="button" disabled className="btn-ghost-sm">
                Chưa có hồ sơ 360
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const bulkActions: BulkAction<Guardian>[] = [];

  if (isFrontDeskRole(userRole)) {
    bulkActions.push({ label: "Xuất Excel", onClick: async (rows) => exportRows(rows), variant: "primary" });
  }

  const handleSearch = async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/guardians?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
    const result = await res.json();
    setData(result.items);
    setLoading(false);
    router.push(`/guardians?q=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`);
  };

  const filterChips = (
    <>
      {[
        { key: "ALL" as const, label: "Tất cả", count: stats?.total ?? data.length },
        { key: "PORTAL" as const, label: "Có portal", count: stats?.withPortal ?? data.filter((row) => Boolean(row.portalEmail)).length },
        { key: "STUDENTS" as const, label: "Có học viên", count: stats?.withStudents ?? data.filter((row) => (row._count?.students ?? 0) > 0).length },
        { key: "DEBT" as const, label: "Có công nợ", count: stats?.withDebt ?? data.filter((row) => guardianDebt(row.children) > 0).length },
      ].map((chip) => {
        const active = filterKey === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilterKey(chip.key)}
            className={`shrink-0 rounded-full border px-4 py-3 text-sm font-semibold transition ${
              active ? "border-transparent bg-primary text-white" : "border-hairline bg-white text-ink-muted64 hover:border-primary/30 hover:text-primary"
            }`}
          >
            {chip.label} {chip.count}
          </button>
        );
      })}
    </>
  );

  return (
    <>
      <DataTableResponsive
        data={visibleData}
        columns={columns}
        actions={[]}
        bulkActions={bulkActions}
        searchable
        searchPlaceholder="Tìm phụ huynh, SĐT, học viên..."
        onSearch={handleSearch}
        filterChips={filterChips}
        sortable
        selectable={false}
        showCountBadge={false}
        pagination={{
          total,
          page,
          pageSize,
          onPageChange: (newPage) => router.push(`/guardians?page=${newPage}&pageSize=${pageSize}`),
          onPageSizeChange: (newSize) => router.push(`/guardians?page=1&pageSize=${newSize}`),
        }}
        emptyState={{
          title: "Chưa có phụ huynh",
          description: filterKey === "ALL" ? "Phụ huynh thường được tạo tự động khi thêm lead hoặc học viên." : "Không có phụ huynh nào khớp nhóm đang lọc.",
          action: !isTeachingStaffRole(userRole)
            ? {
                label: "Thêm phụ huynh",
                onClick: () => setShowCreateDrawer(true),
              }
            : undefined,
        }}
        loading={loading}
        stickyHeader
        rowKey="id"
        onRowClick={(row) => router.push(`/guardians/${row.id}`)}
        primaryColumn="fullName"
        secondaryColumns={["phone"]}
      />
      <GuardianDrawer isOpen={showCreateDrawer} onClose={() => setShowCreateDrawer(false)} />
    </>
  );
}
