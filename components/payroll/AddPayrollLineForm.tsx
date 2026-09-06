"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";

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
      setError(data.error ?? "Không thể thêm nhân sự vào tháng lương.");
      return;
    }

    setEmployeeId("");
    router.refresh();
  }

  if (employeeOptions.length === 0) return null;

  // Không tự vẽ khung/tiêu đề — luôn nằm trong Section của drawer xử lý lương tháng.
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="input w-full sm:w-72">
          <option value="">Chọn nhân sự cần thêm</option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </select>

        <button onClick={add} disabled={!employeeId || loading} className={ACTION_CLASS}>
          {loading ? "Đang thêm..." : "Thêm vào tháng lương"}
        </button>
      </div>
      <p className="text-xs text-[#94a3b8]">Chỉ dùng khi sau bước tính lương tự động vẫn còn thiếu người.</p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
