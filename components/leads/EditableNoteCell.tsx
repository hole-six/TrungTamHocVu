"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

function summarizeNote(notes: string | null) {
  if (!notes?.trim()) return "";
  const compact = notes.replace(/\s+/g, " ").trim();
  return compact.length > 78 ? `${compact.slice(0, 78)}...` : compact;
}

export default function EditableNoteCell({ leadId, notes }: { leadId: string; notes: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => summarizeNote(notes), [notes]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) {
      setValue(notes ?? "");
    }
  }, [notes, open]);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: value }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full max-w-[260px] rounded-xl border border-transparent px-2 py-1.5 text-left text-ink-muted80 transition hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
        title="Mở ghi chú chi tiết"
      >
        {preview ? (
          <div className="space-y-1">
            <p className="line-clamp-2 text-xs leading-5 text-ink-muted80">{preview}</p>
            <p className="text-[11px] font-semibold text-primary">Xem đầy đủ</p>
          </div>
        ) : (
          <span className="text-xs text-ink-muted48">+ Thêm ghi chú</span>
        )}
      </button>

      {mounted && open
        ? createPortal(
            <div className="slideover-root">
              <button type="button" className="slideover-backdrop" onClick={() => setOpen(false)} aria-label="Đóng drawer ghi chú" />
              <div className="slideover-panel max-w-2xl">
                <div className="slideover-header">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Ghi chú lead</p>
                    <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">Xem và cập nhật ghi chú đầy đủ</h3>
                    <p className="text-sm text-ink-muted48">
                      Nội dung dài nên được mở riêng ở drawer để đọc và chỉnh cho dễ, không bị chật trong bảng.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-hairline bg-white px-3 py-2 text-sm font-semibold text-ink-muted80 transition hover:border-primary/30 hover:text-primary"
                  >
                    Đóng
                  </button>
                </div>

                <div className="slideover-body space-y-4">
                  <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] p-4">
                    <p className="text-sm font-semibold text-ink">Bản ghi chú hiện tại</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted48">
                      Có thể ghi dài nhiều dòng, lịch sử trao đổi, lưu ý phụ huynh, tình trạng học sinh hoặc các điểm cần follow-up.
                    </p>
                  </div>

                  <label className="space-y-2">
                    <span className="label">Nội dung ghi chú</span>
                    <textarea
                      autoFocus
                      rows={18}
                      className="input min-h-[420px] w-full resize-y text-sm leading-6"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setValue(notes ?? "");
                          setOpen(false);
                        }
                      }}
                      placeholder="Nhập ghi chú đầy đủ ở đây..."
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => {
                      setValue(notes ?? "");
                      setOpen(false);
                    }}
                    className="btn-ghost"
                  >
                    Hủy
                  </button>
                  <button type="button" onClick={save} disabled={saving} className="btn-primary">
                    {saving ? "Đang lưu..." : "Lưu ghi chú"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
