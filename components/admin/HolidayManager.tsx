"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import HolidayClosureDrawer from "@/components/calendar/HolidayClosureDrawer";

type Holiday = {
  id: string;
  date: string | Date;
  name: string;
  branch: { name: string };
};

type BranchOption = { id: string; name: string };

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("vi-VN");
}

function buildHref(searchParams: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) params.set(k, v);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/admin/holidays${qs ? `?${qs}` : ""}`;
}

export default function HolidayManager({
  holidays,
  branches,
  defaultBranchId,
  total,
  page,
  pageCount,
  searchParams,
}: {
  holidays: Holiday[];
  branches: BranchOption[];
  defaultBranchId: string;
  total: number;
  page: number;
  pageCount: number;
  searchParams: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const branchId = defaultBranchId;
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function removeHoliday(id: string) {
    setDeletingId(id);
    await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Khai ngày nghỉ theo lịch tháng + xem trước các buổi bị cho nghỉ — dùng chung với Lịch tổng. */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted80">
          Khai ngày nghỉ bằng lịch tháng: các lớp tự cho nghỉ buổi rơi vào ngày đó, nội dung dồn sang buổi sau.
        </p>
        <HolidayClosureDrawer branches={branches} defaultBranchId={branchId} buttonClassName="btn-primary" />
      </div>

      <div className="card overflow-x-auto p-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas-parchment/60 text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="px-4 py-3 font-medium">Ngày</th>
              <th className="px-4 py-3 font-medium">Tên ngày lễ</th>
              <th className="px-4 py-3 font-medium">Cơ sở</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-3 font-medium">{formatDate(h.date)}</td>
                <td className="px-4 py-3">{h.name}</td>
                <td className="px-4 py-3 text-ink-muted80">{h.branch.name}</td>
                <td className="px-4 py-3 text-right">
                  <ConfirmActionButton
                    title="Xác nhận xóa ngày nghỉ?"
                    description={`Bỏ ngày nghỉ "${h.name}" tại ${h.branch.name}: các buổi đã cho nghỉ vì ngày này được khôi phục, buổi đã nối thêm ở cuối khóa được bỏ.`}
                    confirmLabel="Xóa ngày nghỉ"
                    tone="danger"
                    disabled={deletingId === h.id}
                    className="text-xs text-red-600"
                    onConfirm={() => removeHoliday(h.id)}
                  >
                    {deletingId === h.id ? "..." : "Xóa"}
                  </ConfirmActionButton>
                </td>
              </tr>
            ))}
            {holidays.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-muted48">
                  Chưa khai báo ngày nghỉ lễ nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted48">{total} ngày nghỉ lễ</p>
        {pageCount > 1 ? (
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={buildHref(searchParams, page - 1)} className="btn-ghost">
                Trước
              </Link>
            ) : null}
            <span className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1.5 text-xs font-semibold text-ink">
              Trang {page}/{pageCount}
            </span>
            {page < pageCount ? (
              <Link href={buildHref(searchParams, page + 1)} className="btn-ghost">
                Sau
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
