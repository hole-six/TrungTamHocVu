"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, TrendingDown, TrendingUp, DollarSign, Save } from "lucide-react";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Branch = { id: string; name: string };

type ScoreEvent = {
  id: string;
  eventDate: string;
  type: string;
  points: number;
  reason: string | null;
  branch: { name: string };
};

function formatVnDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function ScoreEventsList({ employeeId, month, refreshKey }: { employeeId: string; month: string; refreshKey: number }) {
  const router = useRouter();
  const [events, setEvents] = useState<ScoreEvent[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/employees/${employeeId}/score-events?month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEvents(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, month, refreshKey]);

  async function remove(eventId: string) {
    setDeletingId(eventId);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/score-events/${eventId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeletingId(null);
    if (!res.ok) {
      setError(data.error ?? "Không thể xóa điểm.");
      return;
    }
    setEvents((current) => (current ? current.filter((item) => item.id !== eventId) : current));
    router.refresh();
  }

  if (events === null) return null;
  if (events.length === 0) return <p className="px-6 pb-4 text-sm text-[#9ca3af]">Chưa có điểm nào ghi nhận trong tháng {month}.</p>;

  return (
    <div className="space-y-2 px-6 pb-5">
      {events.map((event) => (
        <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border-2 border-[#f3f4f6] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold ${event.type === "DEDUCT" ? "text-red-600" : "text-emerald-600"}`}>
              {event.type === "DEDUCT" ? "−" : "+"}
              {event.points}
            </span>
            <div>
              <p className="text-sm font-medium text-[#111827]">
                {formatVnDate(event.eventDate)} · {event.branch.name}
              </p>
              {event.reason ? <p className="text-xs text-[#6b7280]">{event.reason}</p> : null}
            </div>
          </div>
          <ConfirmActionButton
            title="Xác nhận xóa điểm?"
            description={`Xóa ${event.type === "DEDUCT" ? "điểm trừ" : "điểm cộng"} ${event.points} ngày ${formatVnDate(event.eventDate)}${event.reason ? ` (${event.reason})` : ""}.`}
            confirmLabel="Xóa"
            tone="danger"
            disabled={deletingId === event.id}
            className="text-xs text-red-600"
            onConfirm={() => remove(event.id)}
          >
            {deletingId === event.id ? "..." : "Xóa"}
          </ConfirmActionButton>
        </div>
      ))}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function BranchBonusRow({
  employeeId,
  month,
  branch,
  currentBonus,
}: {
  employeeId: string;
  month: string;
  branch: Branch;
  currentBonus: number | null;
}) {
  const router = useRouter();
  const [bonusPercent, setBonusPercent] = useState(currentBonus !== null ? String(currentBonus * 100) : "");
  const [loading, setLoading] = useState(false);

  async function saveBonus(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/employees/${employeeId}/monthly-bonus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, branchId: branch.id, bonusPercent: Number(bonusPercent) / 100 }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={saveBonus} className="group flex items-center gap-3 rounded-xl border-2 border-[#f3f4f6] bg-white px-4 py-3 transition-all hover:border-[#f97316] hover:shadow-md">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#f97316] to-[#ea580c]">
        <DollarSign className="h-5 w-5 text-white" strokeWidth={2.5} />
      </div>
      <span className="min-w-[120px] font-semibold text-[#111827]">{branch.name}</span>
      <div className="flex flex-1 items-center gap-2">
        <input
          type="number"
          step="1"
          className="h-10 w-24 rounded-lg border-2 border-[#e5e7eb] bg-white px-3 text-center font-bold text-[#111827] outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20"
          value={bonusPercent}
          onChange={(e) => setBonusPercent(e.target.value)}
          placeholder="0"
        />
        <span className="font-semibold text-[#6b7280]">%</span>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn-primary-sm"
      >
        <Save className="h-4 w-4" strokeWidth={2.5} />
        {loading ? "..." : "Lưu"}
      </button>
    </form>
  );
}

export default function AssistantScoreForm({
  employeeId,
  month,
  branches,
  bonusByBranch,
}: {
  employeeId: string;
  month: string;
  branches: Branch[];
  bonusByBranch: Record<string, number | null>;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [type, setType] = useState("DEDUCT");
  const [points, setPoints] = useState("1");
  const [eventDate, setEventDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/score-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, type, points: Number(points), eventDate, reason }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể ghi nhận điểm.");
      return;
    }
    setEventDate("");
    setReason("");
    setEventsRefreshKey((current) => current + 1);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Form Ghi nhận điểm */}
      <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white overflow-hidden">
        <div className="border-b-2 border-[#f3f4f6] bg-gradient-to-r from-[#fafafa] to-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c]">
              <Plus className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#111827]">Ghi nhận điểm trừ/cộng</h3>
              <p className="text-sm text-[#6b7280]">Thêm điểm đánh giá cho giảng viên</p>
            </div>
          </div>
        </div>

        <form onSubmit={addEvent} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Cơ sở */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                Cơ sở
              </label>
              <select
                className="h-11 w-full rounded-lg border-2 border-[#e5e7eb] bg-white px-3 font-medium text-[#111827] outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Loại */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                Loại điểm
              </label>
              <select
                className="h-11 w-full rounded-lg border-2 border-[#e5e7eb] bg-white px-3 font-medium text-[#111827] outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="DEDUCT">❌ Điểm trừ</option>
                <option value="ADD">✅ Điểm cộng</option>
              </select>
            </div>

            {/* Số điểm */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                Số điểm
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                className="h-11 w-full rounded-lg border-2 border-[#e5e7eb] bg-white px-3 font-bold text-[#111827] outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>

            {/* Ngày */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                Ngày
              </label>
              <input
                type="date"
                required
                className="h-11 w-full rounded-lg border-2 border-[#e5e7eb] bg-white px-3 font-medium text-[#111827] outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>

          {/* Lý do */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6b7280]">
              Lý do (tùy chọn)
            </label>
            <input
              className="h-11 w-full rounded-lg border-2 border-[#e5e7eb] bg-white px-4 font-medium text-[#111827] outline-none transition-all focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20"
              placeholder="VD: Đến muộn, thiếu chuẩn bị bài..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border-2 border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            {loading ? "Đang lưu..." : "Ghi nhận điểm"}
          </button>
        </form>

        <div className="border-t-2 border-[#f3f4f6] px-6 pt-4">
          <p className="pb-3 text-xs font-bold uppercase tracking-wider text-[#6b7280]">Điểm đã ghi nhận tháng {month}</p>
        </div>
        <ScoreEventsList employeeId={employeeId} month={month} refreshKey={eventsRefreshKey} />
      </div>

      {/* Form Mức thưởng */}
      <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white overflow-hidden">
        <div className="border-b-2 border-[#f3f4f6] bg-gradient-to-r from-[#fafafa] to-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
              <DollarSign className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#111827]">Mức thưởng tháng {month}</h3>
              <p className="text-sm text-[#6b7280]">Nhập % thưởng theo từng cơ sở</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-900">
              💡 Nhập tay sau khi xem tỉ lệ A của từng cơ sở — hệ thống không tự suy ra mức thưởng.
            </p>
          </div>

          {branches.map((b) => (
            <BranchBonusRow
              key={b.id}
              employeeId={employeeId}
              month={month}
              branch={b}
              currentBonus={bonusByBranch[b.id] ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
