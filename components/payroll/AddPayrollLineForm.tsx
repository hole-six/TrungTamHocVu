"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPayrollLineForm({
  payrollRunId,
  employeeOptions,
}: {
  payrollRunId: string;
  employeeOptions: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!employeeId) return;

    setLoading(true);
    setError(null);

    const res = await fetch("/api/payroll-lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payrollRunId, employeeId }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể thêm nhân sự vào kỳ lương.");
      return;
    }

    setEmployeeId("");
    router.refresh();
  }

  if (employeeOptions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-4">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f97316]">
            Bổ sung thủ công
          </p>
          <h3 className="mt-1 text-base font-black text-[#111827]">
            Thêm nhân sự còn thiếu trong kỳ lương
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#6b7280]">
            Chỉ dùng khi sau bước tính lương tự động vẫn còn thiếu người.
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="input w-full lg:w-72"
          >
            <option value="">Chọn nhân sự cần thêm</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>

          <button
            onClick={add}
            disabled={!employeeId || loading}
            className="btn-ghost"
          >
            {loading ? "Đang thêm..." : "Thêm vào kỳ lương"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
