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
    <div className="flex flex-wrap items-center gap-2">
      <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="input w-64">
        <option value="">— Chọn nhân sự để thêm —</option>
        {employeeOptions.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.fullName}
          </option>
        ))}
      </select>
      <button onClick={add} disabled={!employeeId || loading} className="btn-ghost">
        {loading ? "Đang thêm..." : "+ Thêm nhân sự vào kỳ"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
