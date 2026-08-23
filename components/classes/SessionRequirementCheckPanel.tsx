"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Assignment = {
  id: string;
  employeeId: string;
  role: string;
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
  };
};

type SessionRequirementCheckPanelProps = {
  sessionId: string;
  requirementText: string | null;
  assignments: Assignment[];
  existingCheck: {
    id: string;
    status: string;
    employeeId: string;
    employeeName: string;
    checkedAt: Date;
    scoreEvent: { points: number } | null;
  } | null;
  canSubmit: boolean;
};

export default function SessionRequirementCheckPanel({
  sessionId,
  requirementText,
  assignments,
  existingCheck,
  canSubmit,
}: SessionRequirementCheckPanelProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [status, setStatus] = useState<"SUBMITTED" | "NOT_SUBMITTED">("SUBMITTED");
  const [deductPoints, setDeductPoints] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nếu không có requirement text, không hiển thị gì
  if (!requirementText) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      setError("Vui lòng chọn nhân sự chịu trách nhiệm");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch(`/api/sessions/${sessionId}/requirement-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: selectedEmployeeId,
        status,
        deductPoints: status === "NOT_SUBMITTED" && deductPoints,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể lưu xác nhận");
      return;
    }

    setShowForm(false);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-black text-[#0f1729]">Yêu cầu chuẩn bị / Bài tập giáo viên</h3>
          <p className="text-xs text-[#64748b]">Xác nhận công việc giáo viên cần hoàn thành cho buổi này</p>
        </div>
      </div>

      {/* Requirement Text */}
      <div className="mt-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Nội dung yêu cầu</p>
        <p className="mt-2 text-sm leading-relaxed text-[#0f1729]">{requirementText}</p>
      </div>

      {/* Existing Check Display */}
      {existingCheck ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-[#e5eaf7] bg-[#f8fafc] px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  existingCheck.status === "SUBMITTED" ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <div>
                <p className="text-sm font-bold text-[#0f1729]">
                  {existingCheck.status === "SUBMITTED" ? "✓ Đã nộp" : "✗ Chưa nộp"}
                </p>
                <p className="text-xs text-[#64748b]">
                  {existingCheck.employeeName} · {new Date(existingCheck.checkedAt).toLocaleString("vi-VN")}
                </p>
              </div>
            </div>
            {existingCheck.scoreEvent ? (
              <span className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
                Trừ {existingCheck.scoreEvent.points} điểm
              </span>
            ) : null}
          </div>
        </div>
      ) : canSubmit ? (
        <div className="mt-4">
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full rounded-xl border-2 border-dashed border-[#3b82f6] bg-[#eff6ff] px-4 py-3 text-sm font-bold text-[#1d4ed8] transition hover:border-[#1d4ed8] hover:bg-[#dbeafe]"
            >
              + Đánh dấu xác nhận
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#e5eaf7] bg-[#fafbfc] p-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#64748b]">
                  Nhân sự chịu trách nhiệm <span className="text-red-600">*</span>
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  required
                  className="mt-2 w-full rounded-lg border border-[#e5eaf7] bg-white px-3 py-2.5 text-sm font-semibold text-[#0f1729] outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20"
                >
                  <option value="">-- Chọn nhân sự --</option>
                  {assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.employeeId}>
                      {assignment.employee.fullName} ({assignment.employee.employeeCode}) - {assignment.role === "TEACHER" ? "Giáo viên" : assignment.role === "ASSISTANT" ? "Trợ giảng" : "Trợ giảng 2"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#64748b]">
                  Trạng thái <span className="text-red-600">*</span>
                </label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("SUBMITTED");
                      setDeductPoints(false);
                    }}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${
                      status === "SUBMITTED"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                        : "border-[#e5eaf7] bg-white text-[#64748b] hover:border-emerald-300"
                    }`}
                  >
                    <svg className="mx-auto mb-1 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Đã nộp
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("NOT_SUBMITTED")}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${
                      status === "NOT_SUBMITTED"
                        ? "border-red-500 bg-red-50 text-red-700 shadow-sm"
                        : "border-[#e5eaf7] bg-white text-[#64748b] hover:border-red-300"
                    }`}
                  >
                    <svg className="mx-auto mb-1 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Chưa nộp
                  </button>
                </div>
              </div>

              {/* Deduct Points Option (only for NOT_SUBMITTED) */}
              {status === "NOT_SUBMITTED" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={deductPoints}
                      onChange={(e) => setDeductPoints(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900">Trừ điểm tích cực</p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-800">
                        Tích vào đây nếu muốn trừ điểm tích cực của nhân sự được chọn. Điểm trừ sẽ được ghi nhận vào hệ thống lương và báo cáo.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
                >
                  {loading ? "Đang lưu..." : "Xác nhận"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                  disabled={loading}
                  className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-3 text-sm font-bold text-[#64748b] transition hover:bg-[#f8fafc] disabled:opacity-60"
                >
                  Hủy
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[#e5eaf7] bg-[#fafbfc] px-4 py-3 text-center text-sm text-[#64748b]">
          Chỉ có thể xác nhận sau khi buổi học đã hoàn thành
        </div>
      )}
    </div>
  );
}
