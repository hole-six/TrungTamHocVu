"use client";

import { useState } from "react";
import { formatDate } from "@/lib/export-utils";

type MakeupItem = {
  id: string;
  status: string;
  reason: string | null;
  requestedDate: Date | string | null;
  createdAt: Date | string;
  missedSession: { sessionDate: Date | string; class: { className: string } } | null;
  scheduledSession: { sessionDate: Date | string; class: { className: string } } | null;
  enrollment: { packageLabel: string | null } | null;
};

type SessionOption = {
  id: string;
  sessionDate: Date | string;
  startTime: string | null;
  endTime: string | null;
  class: { className: string };
};

function statusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Chờ duyệt</span>;
    case "APPROVED":
      return <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">Đã duyệt</span>;
    case "SCHEDULED":
      return <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800">Đã xếp buổi</span>;
    case "COMPLETED":
      return <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Hoàn tất</span>;
    case "CANCELLED":
      return <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">Đã hủy</span>;
    default:
      return <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{status}</span>;
  }
}

export default function MakeupRequestPanel({
  studentId,
  enrollmentId,
  requests,
  sessionOptions,
  canManage,
}: {
  studentId: string;
  enrollmentId?: string;
  requests: MakeupItem[];
  sessionOptions: SessionOption[];
  canManage: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [reason, setReason] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentId) {
      alert("Học viên chưa có gói học/ghi danh hoạt động để tạo yêu cầu bù.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/makeup-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          enrollmentId,
          reason: reason || "Học sinh xin bù buổi nghỉ",
          requestedDate: requestedDate ? new Date(requestedDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Không thể tạo yêu cầu bù");
        return;
      }
      window.location.reload();
    } catch {
      alert("Đã xảy ra lỗi kết nối");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSession = async (requestId: string) => {
    if (!selectedSessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/makeup-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "SCHEDULED",
          scheduledSessionId: selectedSessionId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Không thể xếp buổi");
        return;
      }
      window.location.reload();
    } catch {
      alert("Đã xảy ra lỗi kết nối");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (requestId: string) => {
    if (!confirm("Xác nhận học sinh ĐÃ THAM GIA buổi bù này? Buổi học sẽ được điểm danh và tự động trừ 1 buổi vào gói học.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/makeup-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Không thể hoàn tất");
        return;
      }
      window.location.reload();
    } catch {
      alert("Đã xảy ra lỗi kết nối");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h2 className="text-lg font-black tracking-tight text-[#0f1729]">Yêu cầu học bù (Makeup Requests)</h2>
          <p className="mt-1 text-sm text-[#64748b]">
            Quản lý mong muốn học bù của học viên. Học bù là lý do tham gia một buổi học thực tế, không cần tạo lớp riêng.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0066cc] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0052a3] transition-colors shadow-sm"
          >
            <span>{showCreate ? "Đóng form" : "+ Tạo yêu cầu học bù"}</span>
          </button>
        )}
      </div>

      {/* Form Tạo Yêu Cầu */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-4">
          <p className="text-sm font-bold text-[#0f1729]">Đăng ký yêu cầu học bù mới</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#64748b]">Ngày mong muốn học bù</label>
              <input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#0f1729] focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b]">Lý do / Ghi chú</label>
              <input
                type="text"
                placeholder="Vd: Nghỉ ốm buổi thứ 2..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#0f1729] focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#0066cc] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#0052a3] disabled:opacity-50"
            >
              {loading ? "Đang lưu..." : "Xác nhận tạo yêu cầu"}
            </button>
          </div>
        </form>
      )}

      {/* Danh sách yêu cầu */}
      {requests.length === 0 ? (
        <div className="rounded-xl bg-[#f8faff] border border-dashed border-[#e5eaf7] p-8 text-center">
          <p className="text-sm text-[#64748b]">Chưa có yêu cầu học bù nào cho học viên này.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4 transition-colors hover:border-[#3b82f6] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {statusBadge(item.status)}
                  <span className="text-sm font-bold text-[#0f1729]">
                    {item.reason || "Yêu cầu bù buổi"}
                  </span>
                  {item.enrollment?.packageLabel && (
                    <span className="text-xs text-[#64748b]">({item.enrollment.packageLabel})</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748b]">
                  <span>Tạo ngày: {formatDate(item.createdAt)}</span>
                  {item.requestedDate && <span>Mong muốn: {formatDate(item.requestedDate)}</span>}
                  {item.missedSession && (
                    <span>Nghỉ buổi: {formatDate(item.missedSession.sessionDate)} ({item.missedSession.class.className})</span>
                  )}
                </div>

                {item.scheduledSession && (
                  <div className="mt-2 rounded-lg bg-white border border-[#e5eaf7] px-3 py-1.5 text-xs text-indigo-900 font-semibold">
                    🎯 Đã xếp vào: {formatDate(item.scheduledSession.sessionDate)} — Lớp: {item.scheduledSession.class.className}
                  </div>
                )}
              </div>

              {/* Actions */}
              {canManage && (
                <div className="flex items-center gap-2">
                  {item.status === "PENDING" && assigningId !== item.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigningId(item.id);
                        setSelectedSessionId("");
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      Xếp buổi dạy
                    </button>
                  )}

                  {assigningId === item.id && (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedSessionId}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-[#0f1729]"
                      >
                        <option value="">-- Chọn buổi bù phù hợp --</option>
                        {sessionOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {formatDate(s.sessionDate)} {s.startTime ? `(${s.startTime})` : ""} - {s.class.className}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedSessionId || loading}
                        onClick={() => handleAssignSession(item.id)}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssigningId(null)}
                        className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                      >
                        Hủy
                      </button>
                    </div>
                  )}

                  {item.status === "SCHEDULED" && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleComplete(item.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      ✓ Xác nhận hoàn tất
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
