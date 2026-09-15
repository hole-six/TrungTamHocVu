"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";
import { useToast } from "@/components/ui/Toast";

// NGÀY NGHỈ CỦA TRUNG TÂM: tick các ngày trong tháng + lý do → mọi lớp của cơ sở tự cho nghỉ
// các buổi rơi vào những ngày đó. Buổi nghỉ không tính vào lộ trình: các buổi sau dồn lên học
// tài liệu của buổi nghỉ, lớp tự nối thêm buổi ở cuối khóa. Xóa ngày nghỉ = học lại như cũ.
// Toàn bộ quy tắc ở lib/server/session-cancellation.ts.

type Branch = { id: string; name: string };
type MonthData = {
  holidays: { id: string; date: string; name: string; cancelledSessions: number }[];
  sessionCountByDate: Record<string, number>;
};
type PlanItem = {
  sessionId: string;
  classCode: string;
  className: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  action: "CANCEL" | "SKIP";
  reason: string | null;
};
type Plan = { dates: string[]; items: PlanItem[]; cancelCount: number; classCount: number };

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const REASONS = ["Nghỉ lễ", "Nghỉ Tết", "Bão / thời tiết xấu", "Sự cố cơ sở", "Trung tâm tổ chức sự kiện"];

function monthKeyOf(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function dmy(key: string) {
  const [y, m, d] = key.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function HolidayClosureDrawer({
  branches,
  defaultBranchId,
  buttonClassName,
}: {
  branches: Branch[];
  defaultBranchId: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName ?? "btn-ghost text-xs sm:text-sm"}>
        Ngày nghỉ trung tâm
      </button>
      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Ngày nghỉ của trung tâm"
        description="Tick các ngày nghỉ trong tháng và ghi lý do. Mọi lớp của cơ sở tự cho nghỉ các buổi rơi vào những ngày đó; các buổi sau dồn lên học tiếp tài liệu, lớp tự thêm buổi ở cuối khóa."
        widthClassName="max-w-3xl"
      >
        {open ? <HolidayClosureBody branches={branches} defaultBranchId={defaultBranchId} /> : null}
      </ResponsiveDrawer>
    </>
  );
}

function HolidayClosureBody({ branches, defaultBranchId }: { branches: Branch[]; defaultBranchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || "");
  const [month, setMonth] = useState(() => monthKeyOf(new Date(Date.now() + 7 * 3600_000)));
  const [data, setData] = useState<MonthData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    const res = await fetch(`/api/holidays?month=${month}&branchId=${branchId}`);
    const json = await res.json().catch(() => null);
    if (res.ok && json) setData(json);
  }, [branchId, month]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const holidayByDate = useMemo(() => new Map((data?.holidays ?? []).map((h) => [h.date, h])), [data]);

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7; // Thứ 2 đầu tuần
    const list: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d += 1) list.push(`${month}-${String(d).padStart(2, "0")}`);
    return list;
  }, [month]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    setMonth(monthKeyOf(new Date(Date.UTC(y, m - 1 + delta, 1))));
    setSelected(new Set());
    setPlan(null);
  }
  function toggle(key: string) {
    if (holidayByDate.has(key)) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    setPlan(null);
  }

  async function submit(confirm: boolean) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, dates: [...selected].sort(), name, confirm }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Không lưu được ngày nghỉ.");
      return;
    }
    if (!confirm) {
      setPlan(json.plan);
      return;
    }
    const r = json.result;
    toast.success(
      `Đã khai ${r.dates.length} ngày nghỉ, cho nghỉ ${r.cancelCount} buổi của ${r.classCount} lớp` +
        (r.extended ? `, nối thêm ${r.extended} buổi ở cuối khóa.` : "."),
      "Đã áp dụng ngày nghỉ",
    );
    setSelected(new Set());
    setPlan(null);
    setName("");
    await load();
    router.refresh();
  }

  async function removeHoliday(id: string) {
    const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.blocked(json.error ?? "Không xóa được ngày nghỉ.", "Không thực hiện được");
      return;
    }
    toast.success(
      `Đã bỏ ngày nghỉ: khôi phục ${json.restored} buổi` + (json.removed ? `, bỏ ${json.removed} buổi đã nối thêm ở cuối khóa.` : "."),
      "Các lớp học lại ngày này",
    );
    await load();
    router.refresh();
  }

  const monthLabel = (() => {
    const [y, m] = month.split("-");
    return `Tháng ${Number(m)}/${y}`;
  })();

  return (
    <div className="space-y-4">
      {branches.length > 1 ? (
        <label className="form-group">
          <span className="label-sm">Cơ sở</span>
          <select className="input" value={branchId} onChange={(e) => { setBranchId(e.target.value); setSelected(new Set()); setPlan(null); }}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      <section className="rounded-2xl border border-hairline p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" className="btn-ghost-sm" onClick={() => shiftMonth(-1)} aria-label="Tháng trước">‹</button>
          <p className="text-sm font-bold text-ink">{monthLabel}</p>
          <button type="button" className="btn-ghost-sm" onClick={() => shiftMonth(1)} aria-label="Tháng sau">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-muted48">
          {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((key, index) => {
            if (!key) return <div key={`blank-${index}`} />;
            const holiday = holidayByDate.get(key);
            const isSelected = selected.has(key);
            const count = data?.sessionCountByDate[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                title={holiday ? `Đã nghỉ: ${holiday.name}` : count ? `${count} buổi học` : "Không có buổi học"}
                className={`flex min-h-[52px] flex-col items-center justify-start rounded-lg border px-0.5 py-1 text-xs transition ${
                  holiday
                    ? "cursor-default border-rose-200 bg-rose-50 text-rose-800"
                    : isSelected
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-hairline bg-white hover:border-sky-300"
                }`}
              >
                <span className="font-bold">{Number(key.slice(8))}</span>
                {holiday ? (
                  <span className="mt-0.5 line-clamp-1 text-[9px] font-semibold">Nghỉ</span>
                ) : count ? (
                  <span className={`mt-0.5 text-[9px] ${isSelected ? "text-white/90" : "text-ink-muted48"}`}>{count} buổi</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-ink-muted48">Bấm vào ngày để chọn / bỏ chọn. Ô đỏ là ngày đã khai nghỉ.</p>
      </section>

      {data && data.holidays.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50/40 p-3 sm:p-4">
          <p className="text-sm font-bold text-ink">Ngày nghỉ đã khai trong {monthLabel.toLowerCase()}</p>
          {data.holidays.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
              <span>
                <strong>{dmy(h.date)}</strong> · {h.name}
                <span className="ml-1 text-xs text-ink-muted48">({h.cancelledSessions} buổi đang nghỉ)</span>
              </span>
              <ConfirmActionButton
                title={`Bỏ ngày nghỉ ${dmy(h.date)}?`}
                description={`Các lớp học lại ngày này: khôi phục ${h.cancelledSessions} buổi đã cho nghỉ và bỏ các buổi đã nối thêm ở cuối khóa.`}
                confirmLabel="Bỏ ngày nghỉ"
                tone="danger"
                onConfirm={() => removeHoliday(h.id)}
                className="btn-ghost-sm text-rose-700"
              >
                Bỏ nghỉ
              </ConfirmActionButton>
            </div>
          ))}
        </section>
      ) : null}

      {selected.size > 0 ? (
        <section className="space-y-3 rounded-2xl border border-hairline p-3 sm:p-4">
          <p className="text-sm font-bold text-ink">
            Đã chọn {selected.size} ngày: {[...selected].sort().map(dmy).join(", ")}
          </p>
          <label className="form-group">
            <span className="label-sm">Lý do nghỉ</span>
            <input className="input" value={name} placeholder="VD: Nghỉ lễ Quốc khánh 2/9" onChange={(e) => { setName(e.target.value); setPlan(null); }} />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((reason) => (
              <button key={reason} type="button" className="rounded-full border border-hairline px-2.5 py-1 text-xs hover:border-sky-300" onClick={() => { setName(reason); setPlan(null); }}>
                {reason}
              </button>
            ))}
          </div>

          {plan ? (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">
                Sẽ cho nghỉ {plan.cancelCount} buổi của {plan.classCount} lớp.
                {plan.items.some((i) => i.action === "SKIP") ? ` Bỏ qua ${plan.items.filter((i) => i.action === "SKIP").length} buổi.` : ""}
              </p>
              <p className="text-xs">
                Các buổi sau ngày nghỉ sẽ học tiếp đúng tài liệu còn dang dở; lớp đã sinh lịch tới cuối khóa được nối thêm buổi ở cuối.
                Không ai bị trừ buổi hay tính lương cho buổi nghỉ.
              </p>
              <div className="max-h-[32vh] space-y-1 overflow-y-auto pr-1">
                {plan.items.length === 0 ? <p className="text-xs">Không có buổi học nào vào những ngày này.</p> : null}
                {plan.items.map((item) => (
                  <p key={item.sessionId} className={`rounded-lg px-2 py-1 text-xs ${item.action === "CANCEL" ? "bg-white" : "bg-rose-100 text-rose-800"}`}>
                    {dmy(item.sessionDate)} {item.startTime}–{item.endTime} · <strong>{item.classCode}</strong> {item.className}
                    {item.action === "SKIP" ? ` — bỏ qua: ${item.reason}` : ""}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <div className="alert-danger">{error}</div> : null}
          <div className="flex flex-wrap gap-2">
            {plan ? (
              <>
                <button type="button" className="btn-primary" disabled={loading} onClick={() => submit(true)}>
                  {loading ? "Đang áp dụng..." : `Xác nhận nghỉ ${selected.size} ngày`}
                </button>
                <button type="button" className="btn-ghost" disabled={loading} onClick={() => setPlan(null)}>Sửa lại</button>
              </>
            ) : (
              <button type="button" className="btn-primary" disabled={loading || !name.trim()} onClick={() => submit(false)}>
                {loading ? "Đang kiểm tra..." : "Xem các buổi bị ảnh hưởng"}
              </button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
