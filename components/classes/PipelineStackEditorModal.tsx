"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type PipelineClass = {
  id: string;
  classCode: string;
  className: string;
  classGroup: string | null;
  nextClassId: string | null;
  activeEnrollments: number;
};

const UNGROUPED_KEY = "__ungrouped__";

// Không có nextClassId nào trong chuỗi các thay đổi NHÁP hiện tại quay lại classId gốc
// — cảnh báo sớm phía client trước khi bấm Lưu, server (route PATCH) vẫn là nguồn xác
// thực cuối cùng cho việc chặn vòng lặp thật sự.
function detectsCycle(classId: string, draftNextByClassId: Map<string, string | null>): boolean {
  let cursor = draftNextByClassId.get(classId) ?? null;
  let hops = 0;
  while (cursor && hops < draftNextByClassId.size + 1) {
    if (cursor === classId) return true;
    cursor = draftNextByClassId.get(cursor) ?? null;
    hops += 1;
  }
  return false;
}

export default function PipelineStackEditorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<PipelineClass[]>([]);
  const [draft, setDraft] = useState<Map<string, string | null>>(new Map());
  const [draftGroup, setDraftGroup] = useState<Map<string, string | null>>(new Map());
  const [autoSyncGroup, setAutoSyncGroup] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/classes/pipeline")
      .then((res) => (res.ok ? res.json() : Promise.reject("Failed")))
      .then((data) => {
        const items: PipelineClass[] = data.items ?? [];
        setClasses(items);
        setDraft(new Map(items.map((c) => [c.id, c.nextClassId])));
        setDraftGroup(new Map(items.map((c) => [c.id, c.classGroup])));
        setLoading(false);
      })
      .catch(() => {
        setError("Không tải được danh sách lớp.");
        setLoading(false);
      });
  }, [open]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, PipelineClass[]>();
    for (const c of classes) {
      const key = draftGroup.get(c.id)?.trim() || UNGROUPED_KEY;
      byGroup.set(key, [...(byGroup.get(key) ?? []), c]);
    }
    return [...byGroup.entries()].sort(([a], [b]) => (a === UNGROUPED_KEY ? 1 : b === UNGROUPED_KEY ? -1 : a.localeCompare(b, "vi")));
  }, [classes, draftGroup]);

  // Option cùng classGroup xếp trước (đúng trực giác "trong ngăn xếp"), sau đó tới các
  // lớp khác trong chi nhánh — chuyển trình độ thực tế thường NHẢY ngăn xếp (vd A2→B1),
  // không giới hạn chọn trong đúng 1 ngăn xếp.
  function optionsFor(cls: PipelineClass) {
    const group = draftGroup.get(cls.id)?.trim() || null;
    const sameGroup = classes.filter((c) => c.id !== cls.id && (draftGroup.get(c.id)?.trim() || null) === group);
    const others = classes.filter((c) => c.id !== cls.id && (draftGroup.get(c.id)?.trim() || null) !== group);
    return [...sameGroup, ...others];
  }

  const changedCount = [...draft.entries()].filter(([id, next]) => classes.find((c) => c.id === id)?.nextClassId !== next).length;
  const groupChangedCount = [...draftGroup.entries()].filter(([id, group]) => (classes.find((c) => c.id === id)?.classGroup ?? null) !== (group?.trim() || null)).length;
  const hasCycle = classes.some((c) => detectsCycle(c.id, draft));

  // Toàn bộ chuỗi chuyển tiếp theo bản nháp hiện tại, đi từ lớp ĐẦU chuỗi (không lớp nào
  // trỏ tới) tới hết — ngăn xếp là chuỗi dài A1 → A2 → B1 → C1 → ..., nhìn từng dòng
  // "lớp → lớp kế" riêng lẻ ở dưới thì không thấy được cả chuỗi đang nối ra sao.
  const chains = useMemo(() => {
    const byId = new Map(classes.map((c) => [c.id, c]));
    const pointedTo = new Set([...draft.values()].filter((id): id is string => Boolean(id)));
    const result: PipelineClass[][] = [];
    for (const head of classes) {
      if (pointedTo.has(head.id) || !draft.get(head.id)) continue;
      const path: PipelineClass[] = [head];
      const seen = new Set([head.id]);
      let cursor = draft.get(head.id) ?? null;
      while (cursor && !seen.has(cursor) && byId.has(cursor)) {
        const node = byId.get(cursor)!;
        path.push(node);
        seen.add(cursor);
        cursor = draft.get(cursor) ?? null;
      }
      result.push(path);
    }
    return result.sort((a, b) => b.length - a.length);
  }, [classes, draft]);

  function setNextClass(classId: string, nextClassId: string | null) {
    setDraft((current) => new Map(current).set(classId, nextClassId));
    if (!autoSyncGroup || !nextClassId) return;

    setDraftGroup((current) => {
      const next = new Map(current);
      const sourceClass = classes.find((item) => item.id === classId);
      const stackName = next.get(classId)?.trim() || sourceClass?.classGroup?.trim() || sourceClass?.classCode || null;
      if (!stackName) return next;
      next.set(classId, stackName);
      next.set(nextClassId, stackName);

      let cursor = draft.get(nextClassId) ?? null;
      const seen = new Set([classId, nextClassId]);
      while (cursor && !seen.has(cursor)) {
        next.set(cursor, stackName);
        seen.add(cursor);
        cursor = draft.get(cursor) ?? null;
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const updates = classes
      .filter((c) => draft.get(c.id) !== c.nextClassId)
      .map((c) => ({ classId: c.id, nextClassId: draft.get(c.id) ?? null }));
    const groupUpdates = classes
      .filter((c) => (draftGroup.get(c.id)?.trim() || null) !== (c.classGroup ?? null))
      .map((c) => ({ classId: c.id, classGroup: draftGroup.get(c.id)?.trim() || null }));

    const response = await fetch("/api/classes/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates, groupUpdates }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(result.error ?? "Không lưu được thay đổi.");
      return;
    }
    onClose();
    router.refresh();
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Sắp xếp ngăn xếp chuyển tiếp">
      <button type="button" className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} aria-label="Đóng" />

      <div className="relative z-[91] flex max-h-[85vh] w-full max-w-4xl flex-col rounded-[28px] border border-[#dbe7ff] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
        <div className="flex items-start justify-between gap-3 border-b border-[#e5eaf7] px-6 py-5">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-[#12304a]">Sắp xếp ngăn xếp chuyển tiếp</h3>
            <p className="mt-1 text-sm text-[#64748b]">
              Chọn lớp tiếp theo cho từng lớp — quyết định học viên học hết lớp này sẽ được đề xuất chuyển sang đâu.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[#e5eaf7] p-2 text-[#64748b] hover:bg-[#f8faff]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#64748b]">Đang tải...</p>
          ) : (
            <div className="space-y-6">
              {chains.length > 0 ? (
                <div className="rounded-xl border border-[#e5eaf7] bg-white px-4 py-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Chuỗi chuyển tiếp hiện tại</p>
                  <div className="space-y-1.5">
                    {chains.map((chain) => (
                      <div key={chain[0].id} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="mr-1 rounded bg-[#0f1729] px-1.5 py-0.5 font-bold text-white">{chain.length} lớp</span>
                        {chain.map((node, index) => (
                          <span key={node.id} className="inline-flex items-center gap-1.5">
                            {index > 0 ? <span className="text-[#94a3b8]">→</span> : null}
                            <span className="rounded border border-[#e2e8f0] bg-[#f8faff] px-1.5 py-0.5 font-mono font-bold text-[#0f1729]">{node.classCode}</span>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="flex items-start gap-3 rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-[#12304a]">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={autoSyncGroup}
                  onChange={(event) => setAutoSyncGroup(event.target.checked)}
                />
                <span>
                  <span className="block font-bold">Tự đồng bộ hai chiều khi gắn lớp kế</span>
                  <span className="mt-1 block text-xs leading-5 text-[#64748b]">
                    Khi chọn A → B, hệ thống tự đưa B vào cùng ngăn với A; nếu B đã nối tiếp lớp khác thì các lớp phía sau cũng đi cùng ngăn.
                  </span>
                </span>
              </label>
              {groups.map(([groupKey, groupClasses]) => (
                <div key={groupKey}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">
                    {groupKey === UNGROUPED_KEY ? "Chưa gán ngăn xếp" : `Ngăn ${groupKey}`}
                  </p>
                  <div className="space-y-2">
                    {groupClasses.map((cls) => {
                      const cycle = detectsCycle(cls.id, draft);
                      return (
                        <div key={cls.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${cycle ? "border-rose-300 bg-rose-50" : "border-[#e5eaf7] bg-[#f8faff]"}`}>
                          <div className="min-w-[180px] flex-1">
                            <p className="text-sm font-bold text-[#0f1729]">{cls.className}</p>
                            <p className="text-xs text-[#64748b]">{cls.classCode} · {cls.activeEnrollments} học viên</p>
                          </div>
                          <span className="text-[#94a3b8]">→</span>
                          <select
                            className="input min-w-[220px] flex-1"
                            value={draft.get(cls.id) ?? ""}
                            onChange={(event) => {
                              const value = event.target.value || null;
                              setNextClass(cls.id, value);
                            }}
                          >
                            <option value="">Chưa cấu hình</option>
                            {optionsFor(cls).map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.classCode} - {option.className}
                              </option>
                            ))}
                          </select>
                          <input
                            className="input min-w-[170px] max-w-[220px]"
                            value={draftGroup.get(cls.id) ?? ""}
                            onChange={(event) => {
                              const value = event.target.value.trim() || null;
                              setDraftGroup((current) => new Map(current).set(cls.id, value));
                            }}
                            placeholder="Ngăn xếp"
                            aria-label={`Ngăn xếp của ${cls.classCode}`}
                          />
                          {cycle ? <span className="text-xs font-bold text-rose-600">Tạo vòng lặp!</span> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? <div className="mx-6 mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div> : null}

        <div className="flex items-center justify-between gap-3 border-t border-[#e5eaf7] px-6 py-4">
          <p className={`text-xs ${hasCycle ? "font-bold text-rose-600" : "text-[#64748b]"}`}>
            {hasCycle
              ? "Có vòng lặp — sửa các dòng tô đỏ rồi mới lưu được"
              : changedCount + groupChangedCount > 0
                ? `${changedCount} lớp đổi lớp tiếp theo · ${groupChangedCount} lớp đổi ngăn`
                : "Chưa có thay đổi nào"}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost">
              Hủy
            </button>
            <button type="button" onClick={save} disabled={saving || changedCount + groupChangedCount === 0 || hasCycle} className="btn-primary">
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
