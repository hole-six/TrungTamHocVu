"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RoadmapItem = {
  id: string;
  sessionNumber: number;
  title: string;
  objective: string | null;
  materials: string | null;
  teacherGuide: string | null;
  homeworkGuide: string | null;
  teacherRequirement: string | null;
};

type DraftMap = Record<
  string,
  {
    title: string;
    objective: string;
    materials: string;
    teacherGuide: string;
    homeworkGuide: string;
    teacherRequirement: string;
  }
>;

function createDraft(item: RoadmapItem) {
  return {
    title: item.title ?? "",
    objective: item.objective ?? "",
    materials: item.materials ?? "",
    teacherGuide: item.teacherGuide ?? "",
    homeworkGuide: item.homeworkGuide ?? "",
    teacherRequirement: item.teacherRequirement ?? "",
  };
}

export default function ClassRoadmapManager({
  classId,
  items,
  totalSessions,
  editable,
}: {
  classId: string;
  items: RoadmapItem[];
  totalSessions: number | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [drafts, setDrafts] = useState<DraftMap>(() =>
    Object.fromEntries(items.map((item) => [item.id, createDraft(item)])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const activeItem = useMemo(() => items.find((item) => item.id === activeId) ?? items[0] ?? null, [activeId, items]);
  const activeDraft = activeItem ? drafts[activeItem.id] ?? createDraft(activeItem) : null;

  function patchDraft(itemId: string, key: keyof DraftMap[string], value: string) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { title: "", objective: "", materials: "", teacherGuide: "", homeworkGuide: "", teacherRequirement: "" }),
        [key]: value,
      },
    }));
    setSavedId(null);
    setError(null);
  }

  async function saveCurrent() {
    if (!activeItem || !activeDraft) return;
    setSavingId(activeItem.id);
    setError(null);
    setSavedId(null);
    try {
      const response = await fetch(`/api/classes/${classId}/roadmap`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: activeItem.id,
          ...activeDraft,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "Không thể lưu lộ trình buổi học.");
      }
      setSavedId(activeItem.id);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu lộ trình buổi học.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-hairline pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Lộ trình giảng dạy toàn khóa</h2>
          <p className="mt-1 text-sm text-ink-muted48">
            Mỗi buổi học có một mục tiêu, tài liệu và hướng dẫn riêng. Giáo viên mở buổi là thấy ngay hôm nay cần dạy gì.
          </p>
        </div>
        <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
          <p className="font-semibold text-ink">{items.length}{totalSessions ? ` / ${totalSessions}` : ""} buổi đã có khung lộ trình</p>
          <p className="mt-1 text-xs">Khi tăng tổng số buổi, hệ thống sẽ tự sinh thêm mục để hoàn thiện dần.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-sm text-ink-muted48">Lớp này chưa có tổng số buổi nên chưa thể sinh lộ trình.</div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
            {items.map((item) => {
              const selected = item.id === activeItem?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                    selected
                      ? "border-sky-300 bg-[linear-gradient(135deg,#f2f9ff_0%,#ffffff_100%)] shadow-[0_18px_45px_-35px_rgba(14,116,144,0.6)]"
                      : "border-hairline bg-white hover:border-sky-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Buổi {item.sessionNumber}</p>
                      <p className="mt-2 text-base font-semibold text-ink">{drafts[item.id]?.title || item.title || `Buổi ${item.sessionNumber}`}</p>
                    </div>
                    {selected ? <span className="badge bg-sky-100 text-sky-700">Đang xem</span> : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-ink-muted80">
                    {drafts[item.id]?.objective || item.objective || "Chưa có mục tiêu buổi học. Bấm vào để điền rõ nội dung dạy."}
                  </p>
                </button>
              );
            })}
          </div>

          {activeItem && activeDraft ? (
            <div className="space-y-4 rounded-[28px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Khung nội dung cố định</p>
                  <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">Buổi {activeItem.sessionNumber}</h3>
                </div>
                {savedId === activeItem.id ? <span className="badge bg-emerald-100 text-emerald-700">Đã lưu</span> : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-group md:col-span-2">
                  <span className="label">Tên bài / tên buổi</span>
                  <input
                    className="input"
                    value={activeDraft.title}
                    onChange={(event) => patchDraft(activeItem.id, "title", event.target.value)}
                    placeholder={`Ví dụ: Unit 1 - Lesson ${activeItem.sessionNumber}`}
                    readOnly={!editable}
                  />
                </label>

                <label className="form-group">
                  <span className="label">Mục tiêu buổi học</span>
                  <textarea
                    className="input min-h-[120px]"
                    value={activeDraft.objective}
                    onChange={(event) => patchDraft(activeItem.id, "objective", event.target.value)}
                    placeholder="Học viên cần đạt gì sau buổi này?"
                    readOnly={!editable}
                  />
                </label>

                <label className="form-group">
                  <span className="label">Tài liệu / đầu sách / học cụ</span>
                  <textarea
                    className="input min-h-[120px]"
                    value={activeDraft.materials}
                    onChange={(event) => patchDraft(activeItem.id, "materials", event.target.value)}
                    placeholder="Sách, workbook, minitest, file nghe, trò chơi, học cụ..."
                    readOnly={!editable}
                  />
                </label>

                <label className="form-group">
                  <span className="label">Gợi ý cách dạy cho giáo viên</span>
                  <textarea
                    className="input min-h-[150px]"
                    value={activeDraft.teacherGuide}
                    onChange={(event) => patchDraft(activeItem.id, "teacherGuide", event.target.value)}
                    placeholder="Mở bài thế nào, cần nhấn mạnh phần nào, lưu ý học viên yếu/mạnh ra sao..."
                    readOnly={!editable}
                  />
                </label>

                <label className="form-group">
                  <span className="label">Dặn dò / bài tập dự kiến</span>
                  <textarea
                    className="input min-h-[150px]"
                    value={activeDraft.homeworkGuide}
                    onChange={(event) => patchDraft(activeItem.id, "homeworkGuide", event.target.value)}
                    placeholder="Bài tập, việc phụ huynh cần phối hợp, lưu ý cần gửi cuối buổi..."
                    readOnly={!editable}
                  />
                </label>

                <label className="form-group md:col-span-2">
                  <span className="label">Yêu cầu giáo viên phải làm cho buổi này (để trống = không có yêu cầu)</span>
                  <textarea
                    className="input min-h-[90px]"
                    value={activeDraft.teacherRequirement}
                    onChange={(event) => patchDraft(activeItem.id, "teacherRequirement", event.target.value)}
                    placeholder="Ví dụ: Phải giao bài tập Unit 3, chấm và trả kết quả trước buổi sau..."
                    readOnly={!editable}
                  />
                  <p className="form-hint">Sau khi điểm danh xong buổi này, hệ thống sẽ yêu cầu xác nhận Đã nộp/Chưa nộp cho đúng nội dung này.</p>
                </label>
              </div>

              {error ? <div className="alert-danger text-sm">{error}</div> : null}

              {editable ? (
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline pt-4">
                  <button type="button" onClick={saveCurrent} disabled={savingId === activeItem.id} className="btn-primary min-w-[180px]">
                    {savingId === activeItem.id ? "Đang lưu..." : "Lưu lộ trình buổi này"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
