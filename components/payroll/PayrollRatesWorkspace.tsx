"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PayrollRateSetupPanel, { type RateSetupItem } from "@/components/payroll/PayrollRateSetupPanel";
import { exportSectionsToExcel, exportToCSV } from "@/lib/export-utils";

type FilterMode = "ALL" | "MISSING" | "ACTIVE";

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function hasMissingRate(item: RateSetupItem) {
  return (
    (item.teachingHours > 0 && item.teachingHourlyRate == null) ||
    (item.assistantHours > 0 && item.assistantHourlyRate == null) ||
    (item.staffDays > 0 && item.staffDailyRate == null)
  );
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseImportedNumber(raw: string | undefined) {
  if (!raw) return "";
  return raw.replace(/[^\d.-]/g, "");
}

export default function PayrollRatesWorkspace({ items }: { items: RateSetupItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("MISSING");
  const [isImporting, setIsImporting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "MISSING" && !hasMissingRate(item)) return false;
      if (filter === "ACTIVE" && item.teachingHours <= 0 && item.assistantHours <= 0 && item.staffDays <= 0) return false;
      if (!normalizedQuery) return true;
      return (
        item.fullName.toLowerCase().includes(normalizedQuery) ||
        item.employeeCode.toLowerCase().includes(normalizedQuery) ||
        (item.position ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [filter, items, query]);

  const missingCount = items.filter(hasMissingRate).length;
  const activeCount = items.filter((item) => item.teachingHours > 0 || item.assistantHours > 0 || item.staffDays > 0).length;
  const estimatedConfiguredPayroll = items.reduce(
    (sum, item) =>
      sum +
      (item.teachingHourlyRate ?? 0) * item.teachingHours +
      (item.assistantHourlyRate ?? 0) * item.assistantHours +
      (item.staffDailyRate ?? 0) * item.staffDays,
    0,
  );

  function downloadTemplate() {
    exportToCSV(
      items.map((item) => ({
        employeeCode: item.employeeCode,
        fullName: item.fullName,
        payMode: item.payMode,
        teachingHourlyRate: item.teachingHourlyRate ?? "",
        assistantHourlyRate: item.assistantHourlyRate ?? "",
        staffDailyRate: item.staffDailyRate ?? "",
      })),
      [
        { key: "employeeCode", label: "employeeCode" },
        { key: "fullName", label: "fullName" },
        { key: "payMode", label: "payMode" },
        { key: "teachingHourlyRate", label: "teachingHourlyRate" },
        { key: "assistantHourlyRate", label: "assistantHourlyRate" },
        { key: "staffDailyRate", label: "staffDailyRate" },
      ],
      "mau_cap_nhat_don_gia_nhan_su",
    );
  }

  function exportCurrentConfig() {
    exportSectionsToExcel(
      [
        {
          title: "Tóm tắt cấu hình lương",
          columns: [
            { key: "metric", label: "Chỉ số" },
            { key: "value", label: "Giá trị" },
          ],
          rows: [
            { metric: "Tổng nhân sự", value: String(items.length) },
            { metric: "Nhân sự đang có phát sinh", value: String(activeCount) },
            { metric: "Nhân sự thiếu đơn giá", value: String(missingCount) },
            { metric: "Tổng quỹ lương ước tính từ cấu hình hiện tại", value: formatVnd(estimatedConfiguredPayroll) },
          ],
        },
        {
          title: "Bảng đơn giá theo từng người",
          columns: [
            { key: "employeeCode", label: "Mã NV" },
            { key: "fullName", label: "Họ tên" },
            { key: "position", label: "Vị trí" },
            { key: "payMode", label: "Kiểu tính dạy/TG" },
            { key: "teachingHourlyRate", label: "Đơn giá dạy" },
            { key: "assistantHourlyRate", label: "Đơn giá trợ giảng" },
            { key: "staffDailyRate", label: "1 công HC" },
            { key: "teachingHours", label: "Khối lượng dạy" },
            { key: "assistantHours", label: "Khối lượng TG" },
            { key: "staffDays", label: "Khối lượng HC" },
            { key: "missing", label: "Cần kiểm tra" },
          ],
          rows: items.map((item) => ({
            employeeCode: item.employeeCode,
            fullName: item.fullName,
            position: item.position ?? "",
            payMode: item.payMode === "SESSION" ? "Theo ca" : "Theo giờ",
            teachingHourlyRate: item.teachingHourlyRate != null ? formatVnd(item.teachingHourlyRate) : "",
            assistantHourlyRate: item.assistantHourlyRate != null ? formatVnd(item.assistantHourlyRate) : "",
            staffDailyRate: item.staffDailyRate != null ? formatVnd(item.staffDailyRate) : "",
            teachingHours: item.teachingHours,
            assistantHours: item.assistantHours,
            staffDays: item.staffDays,
            missing: hasMissingRate(item) ? "Thiếu cấu hình" : "",
          })),
        },
      ],
      "bang_don_gia_nhan_su",
      "Payroll Rates",
    );
  }

  async function handleImport(file: File) {
    setIsImporting(true);
    setError(null);
    setMessage(null);

    try {
      const content = await file.text();
      const lines = content
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new Error("File CSV chưa có dữ liệu để import.");
      }

      const headers = parseCsvLine(lines[0]).map((header) => header.trim());
      const employeeCodeIndex = headers.indexOf("employeeCode");
      const payModeIndex = headers.indexOf("payMode");
      const teachingRateIndex = headers.indexOf("teachingHourlyRate");
      const assistantRateIndex = headers.indexOf("assistantHourlyRate");
      const staffRateIndex = headers.indexOf("staffDailyRate");

      if (employeeCodeIndex < 0) {
        throw new Error("File CSV phải có cột employeeCode.");
      }

      const itemsByCode = new Map(items.map((item) => [item.employeeCode.toLowerCase(), item]));
      let success = 0;
      const failures: string[] = [];

      for (let i = 1; i < lines.length; i += 1) {
        const columns = parseCsvLine(lines[i]);
        const employeeCode = (columns[employeeCodeIndex] ?? "").trim();
        if (!employeeCode) continue;

        const item = itemsByCode.get(employeeCode.toLowerCase());
        if (!item) {
          failures.push(`${employeeCode}: không tìm thấy nhân sự`);
          continue;
        }

        const payload = {
          payMode: payModeIndex >= 0 && columns[payModeIndex] ? columns[payModeIndex].trim().toUpperCase() : item.payMode,
          teachingHourlyRate: teachingRateIndex >= 0 ? parseImportedNumber(columns[teachingRateIndex]) : item.teachingHourlyRate ?? "",
          assistantHourlyRate: assistantRateIndex >= 0 ? parseImportedNumber(columns[assistantRateIndex]) : item.assistantHourlyRate ?? "",
          staffDailyRate: staffRateIndex >= 0 ? parseImportedNumber(columns[staffRateIndex]) : item.staffDailyRate ?? "",
        };

        const res = await fetch(`/api/employees/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          failures.push(`${employeeCode}: ${data.error ?? "không lưu được"}`);
          continue;
        }

        success += 1;
      }

      if (success > 0) {
        setMessage(
          failures.length > 0
            ? `Đã cập nhật ${success} nhân sự, còn ${failures.length} dòng cần xem lại.`
            : `Đã cập nhật thành công ${success} nhân sự.`,
        );
      }

      if (success === 0 && failures.length > 0) {
        setError(`Import chưa thành công. Ví dụ lỗi: ${failures.slice(0, 3).join(" | ")}`);
      } else if (failures.length > 0) {
        setError(`Một số dòng lỗi: ${failures.slice(0, 3).join(" | ")}`);
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đọc file CSV.");
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function recalculateOpenRuns() {
    setIsRecalculating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/payroll-runs/recalculate-open", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Không thể tính lại payroll.");
      }
      setMessage(`Đã tính lại ${data.recalculatedRuns ?? 0} kỳ lương đang mở.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tính lại payroll.");
    } finally {
      setIsRecalculating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border-2 border-[#e5e7eb] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9ca3af]">Bàn thao tác nhanh</p>
            <h2 className="mt-2 text-xl font-black text-[#111827]">Tìm người, lọc lỗi và cập nhật hàng loạt</h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6b7280]">
              Bạn chỉ cần tập trung vào những người đang có phát sinh công hoặc còn thiếu đơn giá. Sau khi cập nhật xong có thể tính lại các kỳ lương đang mở ngay tại đây.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">Thiếu đơn giá</p>
              <p className="mt-1 text-2xl font-black text-red-800">{missingCount}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Có phát sinh</p>
              <p className="mt-1 text-2xl font-black text-blue-800">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Quỹ lương ước tính theo cấu hình hiện tại</p>
              <p className="mt-1 text-2xl font-black text-emerald-800">{formatVnd(estimatedConfiguredPayroll)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ca3af]">Tìm nhanh</span>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo mã, tên hoặc vị trí..."
            />
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => setFilter("MISSING")}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${filter === "MISSING" ? "bg-red-600 text-white" : "border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"}`}
            >
              Chỉ người thiếu giá
            </button>
            <button
              type="button"
              onClick={() => setFilter("ACTIVE")}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${filter === "ACTIVE" ? "bg-[#111827] text-white" : "border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"}`}
            >
              Chỉ người có phát sinh
            </button>
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${filter === "ALL" ? "bg-[#111827] text-white" : "border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]"}`}
            >
              Xem tất cả
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportCurrentConfig}
            className="inline-flex items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
          >
            Xuất Excel cấu hình hiện tại
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center justify-center rounded-2xl border-2 border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
          >
            Tải mẫu CSV để cập nhật nhanh
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center justify-center rounded-2xl border-2 border-amber-200 bg-white px-5 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
          >
            {isImporting ? "Đang import..." : "Import CSV đơn giá"}
          </button>
          <button
            type="button"
            onClick={recalculateOpenRuns}
            disabled={isRecalculating}
            className="inline-flex items-center justify-center rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white transition hover:bg-black disabled:opacity-60"
          >
            {isRecalculating ? "Đang tính lại..." : "Tính lại các kỳ lương đang mở"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </div>

        <p className="mt-3 text-xs font-medium leading-5 text-[#6b7280]">
          File import nên dùng các cột: employeeCode, payMode, teachingHourlyRate, assistantHourlyRate, staffDailyRate.
          Có thể bỏ trống ô nào bạn chưa muốn thay đổi.
        </p>

        {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
      </div>

      {filteredItems.length > 0 ? (
        <PayrollRateSetupPanel
          items={filteredItems}
          title="Chỉnh hàng loạt đơn giá nhân sự"
          summary={`Đang hiển thị ${filteredItems.length}/${items.length} nhân sự theo bộ lọc hiện tại. Ưu tiên xử lý hết các dòng báo thiếu trước khi duyệt payroll.`}
        />
      ) : (
        <div className="rounded-3xl border-2 border-dashed border-[#d1d5db] bg-white px-6 py-10 text-center">
          <p className="text-lg font-black text-[#111827]">Không có nhân sự nào khớp bộ lọc</p>
          <p className="mt-2 text-sm font-medium text-[#6b7280]">Thử đổi bộ lọc hoặc xóa từ khóa tìm kiếm để xem đầy đủ hơn.</p>
        </div>
      )}
    </div>
  );
}
