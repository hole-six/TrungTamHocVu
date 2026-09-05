"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DataTableResponsive } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { formatVnd } from "@/lib/export-utils";
import StudentLink from "@/components/students/StudentLink";

type LessonItem = {
  id: string;
  classId: string;
  className: string;
  date: Date | string;
  sessionNumber: number | null;
  lesson: string | null;
  objective: string | null;
  status: string;
};

type ConsumedItem = {
  id: string;
  classId: string;
  className: string;
  date: Date | string;
  note: string | null;
};

export type CreditRow = {
  key: string;
  origin: string;
  student: { id: string; fullName: string; studentCode: string };
  enrollment: { classId: string | null; class?: { className: string } | null; packageLabel?: string | null };
  totalCount: number;
  availableCount: number;
  consumedCount: number;
  voidedCount: number;
  paidAmount: number;
  sourceItems: LessonItem[];
  consumedItems: ConsumedItem[];
  notes: string;
};

type CreditsTableProps = {
  initialData: CreditRow[];
  statusParam: string;
  typeParam: string;
  studentParam: string;
  showConsumedColumn: boolean;
};

function formatDate(date: Date | string | null | undefined) {
  return date ? new Date(date).toLocaleDateString("vi-VN") : "—";
}

function TypeBadge({ origin }: { origin: string }) {
  if (origin === "ABSENCE") {
    return <span className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Bổ trợ vắng cần bài</span>;
  }
  if (origin === "PAID_CATCHUP") {
    return <span className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700">Bổ trợ đầu khóa</span>;
  }
  if (origin === "WEAK_STUDENT") {
    return <span className="inline-flex rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">Bổ trợ học sinh yếu</span>;
  }
  if (origin === "WITHDRAWAL_REMAINING") {
    // Cố tình KHÔNG dùng chữ "Bổ trợ" — bản chất khác hẳn ABSENCE/PAID_CATCHUP/WEAK_STUDENT
    // (những buổi CẦN dạy bù), đây là tiền/buổi THỪA khi rút lớp hoặc lớp tự kết thúc mà
    // học viên chưa dùng hết gói đã mua — dùng ở lớp mới, không phải "bài cần bù".
    return <span className="inline-flex rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700">Số dư chuyển từ lớp cũ</span>;
  }
  return <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">{origin}</span>;
}

function LessonList({ row }: { row: CreditRow }) {
  if (row.origin === "PAID_CATCHUP") {
    return <span className="text-xs text-[#64748b]">Không cần bài riêng. Xếp vào lớp bổ trợ đầu khóa theo nhu cầu nhập học.</span>;
  }

  if (row.origin === "WEAK_STUDENT") {
    return <span className="text-xs text-[#64748b]">{row.notes || "Chưa ghi nội dung cần bổ trợ."}</span>;
  }

  if (row.origin === "WITHDRAWAL_REMAINING") {
    return <span className="text-xs text-[#64748b]">{row.notes || "Số dư buổi/tiền còn lại từ lớp cũ — xếp học viên vào lớp mới để dùng hết."}</span>;
  }

  if (row.sourceItems.length === 0) {
    return <span className="text-xs text-amber-700">Credit vắng chưa có buổi gốc. Cần kiểm tra lại enrollment.</span>;
  }

  return (
    <div className="space-y-1.5">
      {row.sourceItems.slice(0, 4).map((item) => (
        <div key={item.id} className="rounded-lg bg-[#fff7ed] px-2.5 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 font-bold text-[#9a3412]">
            <Link href={`/classes/${item.classId}/sessions/${item.id}`} className="underline underline-offset-2">
              {formatDate(item.date)}
            </Link>
            {item.sessionNumber ? <span>Buổi {item.sessionNumber}</span> : null}
          </div>
          <p className="mt-0.5 text-[#0f1729]">{item.lesson ?? "Chưa có bài trong nhật ký/roadmap"}</p>
          {item.objective ? <p className="mt-0.5 line-clamp-1 text-[#64748b]">{item.objective}</p> : null}
        </div>
      ))}
      {row.sourceItems.length > 4 ? <p className="text-[11px] font-semibold text-[#64748b]">+{row.sourceItems.length - 4} buổi cần bù khác</p> : null}
    </div>
  );
}

function ConsumedList({ row }: { row: CreditRow }) {
  if (row.consumedItems.length === 0) {
    return <span className="text-xs text-[#94a3b8]">Chưa bổ trợ buổi nào</span>;
  }

  return (
    <div className="space-y-1.5">
      {row.consumedItems.slice(0, 5).map((item) => (
        <div key={item.id} className="text-xs">
          <Link href={`/classes/${item.classId}/sessions/${item.id}`} className="font-bold text-[#1d4ed8] underline underline-offset-2">
            {formatDate(item.date)}
          </Link>
          <span className="text-[#64748b]"> · {item.className}</span>
        </div>
      ))}
      {row.consumedItems.length > 5 ? <p className="text-[11px] font-semibold text-[#64748b]">+{row.consumedItems.length - 5} ngày khác</p> : null}
    </div>
  );
}

export default function CreditsTable({ initialData, statusParam, typeParam, studentParam, showConsumedColumn }: CreditsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const handleFilterChange = (key: string, value: string | null, extra?: Record<string, string | null>) =>
    updateParams({ [key]: value, ...extra });

  const filterValues = {
    status: statusParam,
    type: typeParam,
    student: studentParam,
    availableFrom: searchParams.get("availableFrom") ?? "",
    availableTo: searchParams.get("availableTo") ?? "",
  };

  const columns: Column<CreditRow>[] = [
    {
      key: "student",
      label: "Học viên",
      width: showConsumedColumn ? "17%" : "20%",
      filter: { type: "text", paramKey: "student", placeholder: "Tên hoặc mã HV..." },
      render: (_value, row) => (
        <div>
          <StudentLink studentId={row.student.id} className="font-black text-[#0f1729] hover:text-[#1d4ed8]">
            {row.student.fullName}
          </StudentLink>
          {row.enrollment.classId ? (
            <Link href={`/classes/${row.enrollment.classId}`} className="mt-2 inline-flex text-xs font-bold text-[#1d4ed8] underline underline-offset-2">
              {row.enrollment.class?.className ?? row.enrollment.packageLabel ?? "Gói học"}
            </Link>
          ) : (
            <span className="mt-2 inline-flex text-xs text-[#64748b]">
              {row.enrollment.packageLabel ?? "Gói học"}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "origin",
      label: "Loại bổ trợ",
      width: showConsumedColumn ? "13%" : "16%",
      filter: {
        type: "select",
        paramKey: "type",
        placeholder: "Tất cả",
        options: [
          { label: "Bổ trợ vắng cần bài", value: "ABSENCE" },
          { label: "Bổ trợ đầu khóa", value: "PAID_CATCHUP" },
          { label: "Bổ trợ học sinh yếu", value: "WEAK_STUDENT" },
          { label: "Số dư chuyển từ lớp cũ", value: "WITHDRAWAL_REMAINING" },
        ],
      },
      render: (value, row) => (
        <div>
          <TypeBadge origin={value} />
          {row.paidAmount > 0 ? <p className="mt-2 text-xs font-bold text-[#0f766e]">Đã tính phí {formatVnd(row.paidAmount)}</p> : null}
          {row.notes ? <p className="mt-2 line-clamp-2 text-xs text-[#64748b]">{row.notes}</p> : null}
        </div>
      ),
    },
    {
      key: "totalCount",
      label: "Số buổi",
      align: "center",
      width: showConsumedColumn ? "8%" : "10%",
      filter: {
        type: "select",
        paramKey: "status",
        placeholder: "Còn phải xếp",
        options: [
          { label: "Còn phải xếp", value: "AVAILABLE" },
          { label: "Đã bổ trợ", value: "CONSUMED" },
          { label: "Tất cả trạng thái", value: "ALL" },
        ],
      },
      render: (value, row) => (
        <div>
          <p className="text-lg font-black text-[#0f1729]">{value}</p>
          <p className="text-[11px] text-[#64748b]">Đã dùng {row.consumedCount}</p>
        </div>
      ),
    },
    {
      key: "availableCount",
      label: "Còn lại",
      align: "center",
      width: showConsumedColumn ? "8%" : "10%",
      filter: { type: "numberRange", paramKeyFrom: "availableFrom", paramKeyTo: "availableTo", placeholder: "buổi" },
      render: (value, row) => (
        <div>
          <p className={`text-lg font-black ${value > 0 ? "text-[#dc2626]" : "text-[#059669]"}`}>{value}</p>
          {row.voidedCount > 0 ? <p className="text-[11px] text-[#94a3b8]">Hủy {row.voidedCount}</p> : null}
        </div>
      ),
    },
    {
      key: "sourceItems",
      label: "Bài/ngày cần bù",
      width: showConsumedColumn ? "24%" : "30%",
      render: (_value, row) => <LessonList row={row} />,
    },
    ...(showConsumedColumn
      ? [
          {
            key: "consumedItems",
            label: "Các ngày đã bổ trợ",
            width: "18%",
            render: (_value, row) => <ConsumedList row={row} />,
          } as Column<CreditRow>,
        ]
      : []),
    {
      key: "actions",
      label: "Tác vụ",
      align: "right",
      width: showConsumedColumn ? "12%" : "14%",
      render: (_value, row) => (
        <div className="flex flex-col items-end gap-2">
          <StudentLink studentId={row.student.id} className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-1.5 text-xs font-bold text-[#1d4ed8] hover:bg-[#dbeafe]">
            Mở học viên
          </StudentLink>
          {row.enrollment.classId ? (
            <Link href={`/classes/${row.enrollment.classId}`} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-bold text-[#475569] hover:bg-[#fafafa]">
              Mở lớp gốc
            </Link>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <DataTableResponsive
      data={initialData}
      columns={columns}
      searchable={false}
      showCountBadge={false}
      sortable={false}
      selectable={false}
      filterValues={filterValues}
      onFilterChange={handleFilterChange}
      emptyState={{
        title: "Không có học viên trong bộ lọc này",
        description: "Khi điểm danh vắng hoặc bán bổ trợ đầu khóa, dữ liệu sẽ xuất hiện ở đây.",
      }}
      loading={isPending}
      rowKey="key"
      className={showConsumedColumn ? "[&_table]:min-w-[1100px] [&_table]:table-fixed" : "[&_table]:min-w-[900px] [&_table]:table-fixed"}
      primaryColumn="student"
      secondaryColumns={["origin", "availableCount"]}
    />
  );
}
