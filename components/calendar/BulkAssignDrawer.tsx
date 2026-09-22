"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import { useToast } from "@/components/ui/Toast";
import { DefaultStaffEditor } from "@/components/classes/ClassDefaultAssignmentManager";

// PHÂN CÔNG HÀNG LOẠT ngay trên lịch tổng. Hai cách, đúng 2 nhu cầu thật:
//   1. "Theo buổi": tick các buổi trong tuần đang xem → chọn GV/TG → xem trước → xác nhận.
//      Hợp cho dạy thay cả tuần, lấp các buổi "Thiếu phân công".
//   2. "Cố định cho lớp": đổi nhân sự mặc định của lớp — dùng CHUNG bộ sửa với trang lớp
//      (DefaultStaffEditor), nên đổi ở đây hay trong lớp đều ra cùng một kết quả.
// Mọi quy tắc (trùng lịch, nghỉ việc, buổi đã dạy, đơn giá) nằm ở server:
// lib/server/bulk-staff-assignment.ts và lib/server/class-default-assignments.ts.

export type BulkSession = {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  assignments: { role: string; employeeId: string; name: string }[];
};
type Employee = { id: string; fullName: string; shortName: string; position: string | null };
type ClassOption = { id: string; classCode: string; className: string };

type PlanItem = {
  sessionId: string;
  classCode: string;
  className: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  role: "TEACHER" | "ASSISTANT";
  action: "ASSIGN" | "REPLACE" | "KEEP" | "SKIP";
  addNames: string[];
  removeNames: string[];
  keepNames: string[];
  skipped: { name: string; reason: string }[];
  reason: string | null;
};
/** Nhân sự mặc định của lớp (có thể 2 GV, 2 TG) — để điền nhanh khi chọn buổi của 1 lớp. */
export type ClassDefaultStaff = Record<string, { teacherIds: string[]; assistantIds: string[] }>;
const MAX_PER_ROLE = 4;
type Plan = { items: PlanItem[]; counts: Record<PlanItem["action"], number> };

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
function dayLabel(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const isClosed = (status: string) => status === "CANCELLED" || status === "RESCHEDULED";
const names = (s: BulkSession, role: "TEACHER" | "ASSISTANT") =>
  s.assignments.filter((a) => (role === "TEACHER" ? a.role === "TEACHER" : a.role !== "TEACHER")).map((a) => a.name);

const ACTION_STYLE: Record<PlanItem["action"], { label: string; cls: string }> = {
  ASSIGN: { label: "Gán mới", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  REPLACE: { label: "Thay người", cls: "border-sky-200 bg-sky-50 text-sky-800" },
  KEEP: { label: "Giữ nguyên", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  SKIP: { label: "Bỏ qua", cls: "border-rose-200 bg-rose-50 text-rose-800" },
};

export default function BulkAssignDrawer({
  sessions,
  employees,
  classes,
  classDefaults,
  weekLabel,
}: {
  sessions: BulkSession[];
  employees: Employee[];
  classes: ClassOption[];
  classDefaults: ClassDefaultStaff;
  weekLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"sessions" | "class">("sessions");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary text-xs sm:text-sm">
        Phân công hàng loạt
      </button>
      <ResponsiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Phân công hàng loạt"
        description={`Gán giáo viên / trợ giảng cho nhiều buổi cùng lúc — ${weekLabel}.`}
        widthClassName="max-w-4xl"
      >
        {open ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              {([
                ["sessions", "Theo buổi trong tuần", "Tick buổi cần gán"],
                ["class", "Cố định cho cả lớp", "Mọi buổi chưa dạy của lớp"],
              ] as const).map(([key, label, hint]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-xl px-3 py-2 text-left transition ${tab === key ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
                >
                  <span className="block text-sm font-bold text-ink">{label}</span>
                  <span className="block text-xs text-ink-muted48">{hint}</span>
                </button>
              ))}
            </div>
            {tab === "sessions" ? (
              <SessionsTab sessions={sessions} employees={employees} classDefaults={classDefaults} />
            ) : (
              <ClassTab classes={classes} />
            )}
          </div>
        ) : null}
      </ResponsiveDrawer>
    </>
  );
}

function SessionsTab({
  sessions,
  employees,
  classDefaults,
}: {
  sessions: BulkSession[];
  employees: Employee[];
  classDefaults: ClassDefaultStaff;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  // Danh sách người theo vai trò — lớp có thể 1–2 giáo viên, 1–2 trợ giảng. Ô trống = chưa chọn.
  const [teacherIds, setTeacherIds] = useState<string[]>([""]);
  const [assistantIds, setAssistantIds] = useState<string[]>([""]);
  const chosenTeachers = teacherIds.filter(Boolean);
  const chosenAssistants = assistantIds.filter(Boolean);
  const [mode, setMode] = useState<"FILL_EMPTY" | "REPLACE">("FILL_EMPTY");
  // Quy tắc trùng khung giờ: 1 người 1 lớp là chuẩn; muốn xếp lớp THỨ HAI cùng giờ thì
  // phải tick ô này (lớp thứ 3 thì hệ thống chặn hẳn, tick cũng không xếp được).
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectable = sessions.filter((s) => !isClosed(s.status));
  const missing = selectable.filter((s) => s.status !== "COMPLETED" && (names(s, "TEACHER").length === 0 || names(s, "ASSISTANT").length === 0));
  const upcoming = selectable.filter((s) => s.status !== "COMPLETED");

  const groups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const map = new Map<string, { classCode: string; className: string; items: BulkSession[] }>();
    for (const s of sessions) {
      if (keyword && !`${s.classCode} ${s.className}`.toLowerCase().includes(keyword)) continue;
      const group = map.get(s.classId) ?? { classCode: s.classCode, className: s.className, items: [] };
      group.items.push(s);
      map.set(s.classId, group);
    }
    return [...map.entries()].sort((a, b) => a[1].classCode.localeCompare(b[1].classCode));
  }, [sessions, search]);

  function change(next: Set<string>) {
    setSelected(next);
    setPlan(null);
    setError(null);
  }
  function toggle(ids: string[], on: boolean) {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    change(next);
  }

  async function submit(confirm: boolean) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/sessions/bulk-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionIds: [...selected], teacherIds: chosenTeachers, assistantIds: chosenAssistants, mode, confirm, allowOverlap }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không phân công được.");
      return;
    }
    if (!confirm) {
      setPlan(data.plan);
      return;
    }
    const skipped = data.plan?.counts?.SKIP ?? 0;
    toast.success(
      `Đã phân công ${data.written} lượt.${skipped ? ` Bỏ qua ${skipped} lượt (xem lý do trước khi gán lại).` : ""}`,
      "Phân công xong",
    );
    setPlan(null);
    setSelected(new Set());
    router.refresh();
  }

  const actionable = plan ? plan.counts.ASSIGN + plan.counts.REPLACE : 0;
  // Các buổi đang chọn cùng thuộc 1 lớp → cho điền nhanh đúng nhân sự mặc định của lớp đó.
  const selectedClassIds = [...new Set(sessions.filter((x) => selected.has(x.id)).map((x) => x.classId))];
  const onlyClassId = selectedClassIds.length === 1 ? selectedClassIds[0] : null;
  const onlyClassDefaults = onlyClassId ? classDefaults[onlyClassId] : undefined;
  const singleClassDefaults =
    onlyClassDefaults && onlyClassDefaults.teacherIds.length + onlyClassDefaults.assistantIds.length > 0 ? onlyClassDefaults : null;
  const singleClassCode = onlyClassId ? sessions.find((x) => x.classId === onlyClassId)?.classCode ?? "" : "";

  if (plan) {
    const order: PlanItem["action"][] = ["ASSIGN", "REPLACE", "SKIP", "KEEP"];
    const sorted = [...plan.items].sort((a, b) => order.indexOf(a.action) - order.indexOf(b.action) || a.sessionDate.localeCompare(b.sessionDate));
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {order.map((action) => (
            <span key={action} className={`rounded-full border px-3 py-1 text-xs font-bold ${ACTION_STYLE[action].cls}`}>
              {ACTION_STYLE[action].label}: {plan.counts[action]}
            </span>
          ))}
        </div>
        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {sorted.map((item, index) => (
            <div key={index} className={`rounded-xl border px-3 py-2 text-sm ${ACTION_STYLE[item.action].cls}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {item.classCode} · {dayLabel(item.sessionDate)} {item.startTime}–{item.endTime}
                </span>
                <span className="text-xs font-bold">{ACTION_STYLE[item.action].label}</span>
              </div>
              <div className="mt-0.5 space-y-0.5 text-xs">
                <p>
                  <span className="font-bold">{item.role === "TEACHER" ? "GV" : "TG"}:</span>{" "}
                  {item.addNames.length ? <>thêm <strong>{item.addNames.join(", ")}</strong></> : null}
                  {item.addNames.length && item.removeNames.length ? " · " : null}
                  {item.removeNames.length ? <>gỡ <strong>{item.removeNames.join(", ")}</strong></> : null}
                  {(item.addNames.length || item.removeNames.length) && item.keepNames.length ? " · " : null}
                  {item.keepNames.length ? <>giữ {item.keepNames.join(", ")}</> : null}
                  {!item.addNames.length && !item.removeNames.length && !item.keepNames.length ? "không đổi" : null}
                </p>
                {item.skipped.map((k, i) => (
                  <p key={i}>⚠ {k.name}: {k.reason}</p>
                ))}
                {item.reason ? <p>{item.reason}</p> : null}
              </div>
            </div>
          ))}
        </div>
        {error ? <div className="alert-danger">{error}</div> : null}
        <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
          <button type="button" disabled={loading || actionable === 0} onClick={() => submit(true)} className="btn-primary">
            {loading ? "Đang lưu..." : actionable ? `Xác nhận gán ${actionable} lượt` : "Không có lượt nào để gán"}
          </button>
          <button type="button" disabled={loading} onClick={() => setPlan(null)} className="btn-ghost">
            Quay lại chọn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-hairline p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-ink">1. Chọn buổi ({selected.size} đã chọn)</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost-sm" onClick={() => change(new Set(missing.map((s) => s.id)))}>
              Buổi thiếu GV/TG ({missing.length})
            </button>
            <button type="button" className="btn-ghost-sm" onClick={() => change(new Set(upcoming.map((s) => s.id)))}>
              Tất cả buổi chưa dạy ({upcoming.length})
            </button>
            {selected.size ? (
              <button type="button" className="btn-ghost-sm" onClick={() => change(new Set())}>
                Bỏ chọn
              </button>
            ) : null}
          </div>
        </div>
        <input className="input" placeholder="Lọc theo mã lớp / tên lớp..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1">
          {groups.length === 0 ? <p className="py-6 text-center text-sm text-ink-muted48">Tuần này không có buổi nào khớp.</p> : null}
          {groups.map(([classId, group]) => {
            const ids = group.items.filter((s) => !isClosed(s.status)).map((s) => s.id);
            const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
            return (
              <div key={classId} className="rounded-xl border border-hairline">
                <label className="flex cursor-pointer items-center gap-2 border-b border-hairline bg-slate-50 px-3 py-2">
                  <input type="checkbox" checked={allOn} disabled={ids.length === 0} onChange={(e) => toggle(ids, e.target.checked)} />
                  <span className="text-sm font-bold text-ink">{group.classCode}</span>
                  <span className="truncate text-xs text-ink-muted48">{group.className} · {group.items.length} buổi</span>
                </label>
                {group.items.map((s) => {
                  const gv = names(s, "TEACHER");
                  const tg = names(s, "ASSISTANT");
                  const closed = isClosed(s.status);
                  return (
                    <label key={s.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm ${closed ? "opacity-50" : "cursor-pointer hover:bg-sky-50/50"}`}>
                      <input type="checkbox" disabled={closed} checked={selected.has(s.id)} onChange={(e) => toggle([s.id], e.target.checked)} />
                      <span className="w-20 shrink-0 font-semibold text-ink sm:w-28">{dayLabel(s.sessionDate)}</span>
                      <span className="w-24 shrink-0 text-ink-muted80">{s.startTime}–{s.endTime}</span>
                      {/* Điện thoại: tên GV/TG xuống dòng riêng, không bị cắt chữ. */}
                      <span className="order-last basis-full pl-6 text-xs sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto sm:truncate sm:pl-0">
                        <span className={gv.length ? "text-ink" : "font-bold text-amber-700"}>GV: {gv.length ? gv.join(", ") : "thiếu"}</span>
                        {" · "}
                        <span className={tg.length ? "text-ink" : "font-bold text-amber-700"}>TG: {tg.length ? tg.join(", ") : "thiếu"}</span>
                      </span>
                      {s.status === "COMPLETED" ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Đã dạy</span> : null}
                      {closed ? <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">{s.status === "CANCELLED" ? "Đã hủy" : "Đã dời"}</span> : null}
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-hairline p-3 sm:p-4">
        <p className="text-sm font-bold text-ink">2. Chọn người và cách gán</p>
        {singleClassDefaults ? (
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() => {
              setTeacherIds(singleClassDefaults.teacherIds.length ? [...singleClassDefaults.teacherIds] : [""]);
              setAssistantIds(singleClassDefaults.assistantIds.length ? [...singleClassDefaults.assistantIds] : [""]);
              setPlan(null);
            }}
          >
            Điền theo nhân sự mặc định của lớp {singleClassCode} ({singleClassDefaults.teacherIds.length} GV · {singleClassDefaults.assistantIds.length} TG)
          </button>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <StaffListPicker
            label="Giáo viên"
            values={teacherIds}
            onChange={(next) => { setTeacherIds(next); setPlan(null); }}
            employees={employees}
            blocked={chosenAssistants}
          />
          <StaffListPicker
            label="Trợ giảng"
            values={assistantIds}
            onChange={(next) => { setAssistantIds(next); setPlan(null); }}
            employees={employees}
            blocked={chosenTeachers}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ["FILL_EMPTY", "Chỉ điền buổi còn trống", "Buổi chưa có GV (hoặc TG) thì gán cả danh sách; đã có người thì giữ nguyên. An toàn, nên dùng."],
            ["REPLACE", "Đặt đúng danh sách này", "GV/TG của buổi thành đúng những người đã chọn: thêm người thiếu, gỡ người không có trong danh sách. Buổi đã dạy, đã check-in, đang dạy thay giữ nguyên."],
          ] as const).map(([value, label, hint]) => (
            <label key={value} className={`cursor-pointer rounded-xl border px-3 py-2 ${mode === value ? "border-sky-400 bg-sky-50" : "border-hairline"}`}>
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <input type="radio" name="bulk-mode" checked={mode === value} onChange={() => { setMode(value); setPlan(null); }} />
                {label}
              </span>
              <span className="mt-1 block text-xs text-ink-muted48">{hint}</span>
            </label>
          ))}
        </div>

        <label className={`mt-3 flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 ${allowOverlap ? "border-amber-300 bg-amber-50" : "border-hairline"}`}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={allowOverlap}
            onChange={(event) => {
              setAllowOverlap(event.target.checked);
              setPlan(null);
            }}
          />
          <span>
            <span className="block text-sm font-bold text-ink">Cho phép xếp trùng giờ (tối đa 2 lớp/khung giờ)</span>
            <span className="mt-0.5 block text-xs text-ink-muted48">
              Mặc định 1 người chỉ đứng 1 lớp trong một khung giờ. Tick ô này khi thật sự muốn xếp người đó kèm lớp thứ 2 cùng
              giờ — lớp thứ 3 thì hệ thống luôn chặn.
            </span>
          </span>
        </label>
      </section>

      {error ? <div className="alert-danger">{error}</div> : null}
      <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        <button
          type="button"
          className="btn-primary"
          disabled={loading || selected.size === 0 || (!chosenTeachers.length && !chosenAssistants.length)}
          onClick={() => submit(false)}
        >
          {loading ? "Đang kiểm tra..." : `Xem trước (${selected.size} buổi)`}
        </button>
        <p className="text-xs text-ink-muted48">Chưa ghi gì cho tới khi bấm xác nhận ở bước xem trước. Buổi trùng giờ sẽ bị bỏ qua kèm lý do, trừ khi đã tick cho phép xếp trùng.</p>
      </div>
    </div>
  );
}

function StaffListPicker({
  label,
  values,
  onChange,
  employees,
  blocked,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  employees: Employee[];
  /** Người đã chọn ở vai trò kia — không cho chọn trùng. */
  blocked: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="label-sm">{label}</span>
        {values.length < MAX_PER_ROLE ? (
          <button type="button" className="btn-ghost-sm" onClick={() => onChange([...values, ""])}>
            + Thêm {label.toLowerCase()}
          </button>
        ) : null}
      </div>
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <select
            className="input min-w-0 flex-1"
            value={value}
            onChange={(e) => onChange(values.map((v, i) => (i === index ? e.target.value : v)))}
          >
            <option value="">{`— ${label} ${index + 1}: không gán —`}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id} disabled={blocked.includes(e.id) || (values.includes(e.id) && e.id !== value)}>
                {e.fullName}{e.shortName ? ` (${e.shortName})` : ""}{e.position ? ` · ${e.position}` : ""}
              </option>
            ))}
          </select>
          {values.length > 1 ? (
            <button
              type="button"
              className="btn-ghost-sm text-rose-600"
              aria-label={`Bỏ ${label.toLowerCase()} ${index + 1}`}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            >
              Bỏ
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

type ClassSummary = {
  employees: Employee[];
  defaultAssignments: { id: string; role: string; notes?: string | null; employeeId: string; employee?: { fullName: string; shortName: string | null } | null }[];
};

function ClassTab({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const [classId, setClassId] = useState("");
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(id: string) {
    setClassId(id);
    setSummary(null);
    setError(null);
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/classes/${id}/summary`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Không tải được nhân sự của lớp.");
      return;
    }
    setSummary({ employees: data.employees ?? [], defaultAssignments: data.defaultAssignments ?? [] });
  }

  return (
    <div className="space-y-4">
      <label className="form-group">
        <span className="label-sm">Chọn lớp</span>
        <select className="input" value={classId} onChange={(e) => void load(e.target.value)}>
          <option value="">— Chọn lớp cần đặt giáo viên / trợ giảng cố định —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.classCode} · {c.className}
            </option>
          ))}
        </select>
        <span className="hint">Giống hệt mục “Chỉnh nhân sự” trong lớp: đổi người thì mọi buổi chưa dạy của lớp đổi theo (có xem trước).</span>
      </label>
      {loading ? <p className="text-sm text-ink-muted48">Đang tải nhân sự của lớp...</p> : null}
      {error ? <div className="alert-danger">{error}</div> : null}
      {summary ? (
        <DefaultStaffEditor
          key={classId}
          classId={classId}
          employees={summary.employees}
          assignments={summary.defaultAssignments}
          onSaved={async () => {
            // Tải lại nhân sự mặc định mà KHÔNG gỡ bộ sửa, để thông báo "Đã lưu..." còn hiện.
            const res = await fetch(`/api/classes/${classId}/summary`);
            const data = await res.json().catch(() => null);
            if (res.ok && data) setSummary({ employees: data.employees ?? [], defaultAssignments: data.defaultAssignments ?? [] });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
