"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { ACTION_CLASS } from "@/components/ui/DetailDrawerParts";

type Branch = { id: string; name: string };

type ScoreEvent = {
  id: string;
  eventDate: string;
  type: string;
  points: number;
  reason: string | null;
  branchId: string;
  branch: { name: string };
};

function formatVnDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function EditScoreEventForm({
  employeeId,
  event,
  branches,
  onDone,
  onSaved,
}: {
  employeeId: string;
  event: ScoreEvent;
  branches: Branch[];
  onDone: () => void;
  onSaved: () => void;
}) {
  const [branchId, setBranchId] = useState(event.branchId);
  const [type, setType] = useState(event.type);
  const [points, setPoints] = useState(String(event.points));
  const [eventDate, setEventDate] = useState(event.eventDate.slice(0, 10));
  const [reason, setReason] = useState(event.reason ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/score-events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, type, points: Number(points), eventDate, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không thể sửa điểm.");
      return;
    }
    onSaved();
  }

  return (
    <div className="space-y-2 border-b border-[#f1f5f9] py-3 last:border-0">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className="input-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select className="input-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="DEDUCT">Điểm trừ</option>
          <option value="ADD">Điểm cộng</option>
        </select>
        <input type="number" min="0.5" step="0.5" className="input-sm" value={points} onChange={(e) => setPoints(e.target.value)} />
        <input type="date" className="input-sm" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
      </div>
      <input className="input-sm w-full" placeholder="Lý do (tùy chọn)" value={reason} onChange={(e) => setReason(e.target.value)} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={loading} className="btn-ghost-sm">
          {loading ? "Đang lưu..." : "Lưu"}
        </button>
        <button type="button" onClick={onDone} className="btn-ghost-sm">
          Hủy
        </button>
      </div>
    </div>
  );
}

function ScoreEventsList({ employeeId, month, branches, refreshKey }: { employeeId: string; month: string; branches: Branch[]; refreshKey: number }) {
  const router = useRouter();
  const [events, setEvents] = useState<ScoreEvent[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

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
  }, [employeeId, month, refreshKey, localRefreshKey]);

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
  if (events.length === 0) return <p className="text-sm text-[#94a3b8]">Chưa có điểm nào ghi nhận trong tháng {month}.</p>;

  return (
    <div>
      {events.map((event) =>
        editingId === event.id ? (
          <EditScoreEventForm
            key={event.id}
            employeeId={employeeId}
            event={event}
            branches={branches}
            onDone={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              setLocalRefreshKey((k) => k + 1);
              router.refresh();
            }}
          />
        ) : (
          <div key={event.id} className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] py-2.5 last:border-0">
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold ${event.type === "DEDUCT" ? "text-red-600" : "text-emerald-600"}`}>
                {event.type === "DEDUCT" ? "−" : "+"}
                {event.points}
              </span>
              <div>
                <p className="text-sm font-medium text-[#0f1729]">
                  {formatVnDate(event.eventDate)} · {event.branch.name}
                </p>
                {event.reason ? <p className="text-xs text-[#64748b]">{event.reason}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditingId(event.id)} className="text-xs font-semibold text-[#2563eb]">
                Sửa
              </button>
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
          </div>
        )
      )}
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
    <form onSubmit={saveBonus} className="flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] pb-3 last:border-0">
      <span className="min-w-[120px] text-sm font-semibold text-[#0f1729]">{branch.name}</span>
      <div className="flex flex-1 items-center gap-2">
        <input
          type="number"
          step="1"
          className="input w-24 text-center"
          value={bonusPercent}
          onChange={(e) => setBonusPercent(e.target.value)}
          placeholder="0"
        />
        <span className="text-sm font-semibold text-[#64748b]">%</span>
      </div>
      <button type="submit" disabled={loading} className="btn-ghost-sm">
        {loading ? "..." : "Lưu"}
      </button>
    </form>
  );
}

// Tách riêng khỏi form ghi nhận điểm — dùng cho tab "Cơ sở" (đúng nghĩa đen người
// dùng yêu cầu), trong khi form ghi nhận điểm trừ/cộng ở dưới thuộc tab "Cơ chế điểm".
export function BranchBonusForm({
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
  // Không tự vẽ khung/tiêu đề — component này chỉ được dùng bên trong Section của
  // drawer nhân sự, vốn đã có sẵn khung + tiêu đề.
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#64748b]">
        Nhập tay sau khi xem tỉ lệ A của từng cơ sở — hệ thống không tự suy ra mức thưởng.
      </p>
      {branches.map((b) => (
        <BranchBonusRow key={b.id} employeeId={employeeId} month={month} branch={b} currentBonus={bonusByBranch[b.id] ?? null} />
      ))}
    </div>
  );
}

export default function AssistantScoreForm({
  employeeId,
  month,
  branches,
}: {
  employeeId: string;
  month: string;
  branches: Branch[];
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

  // Không tự vẽ khung/tiêu đề — luôn nằm trong Section của drawer nhân sự. Dùng đúng
  // .input/.label chung của hệ thống thay vì bộ input viền dày + focus cam riêng.
  return (
    <div className="space-y-4">
      <form onSubmit={addEvent} className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="space-y-1">
            <span className="label-sm">Cơ sở</span>
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label-sm">Loại điểm</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="DEDUCT">Điểm trừ</option>
              <option value="ADD">Điểm cộng</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label-sm">Số điểm</span>
            <input type="number" min="0.5" step="0.5" className="input" value={points} onChange={(e) => setPoints(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="label-sm">Ngày</span>
            <input type="date" required className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="label-sm">Lý do (tùy chọn)</span>
          <input
            className="input"
            placeholder="VD: Đến muộn, thiếu chuẩn bị bài..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button type="submit" disabled={loading} className={ACTION_CLASS}>
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          {loading ? "Đang lưu..." : "Ghi nhận điểm"}
        </button>
      </form>

      <div className="border-t border-[#f1f5f9] pt-3">
        <p className="pb-2 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Điểm đã ghi nhận tháng {month}</p>
        <ScoreEventsList employeeId={employeeId} month={month} branches={branches} refreshKey={eventsRefreshKey} />
      </div>
    </div>
  );
}
