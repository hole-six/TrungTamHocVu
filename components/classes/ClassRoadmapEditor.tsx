"use client";

import { useEffect, useState } from "react";

// KHUNG SOẠN LỘ TRÌNH / TÀI LIỆU THEO TỪNG BUỔI — dùng CHUNG cho form Tạo lớp và Sửa lớp.
//
// Trước đây khung này chỉ nằm trong form Sửa lớp, còn form Tạo lớp cố ý bỏ ra cho gọn.
// Hệ quả: mở lớp mới xong phải đóng form, mở lại "Sửa lớp" rồi mới soạn được giáo án —
// hai bước cho một việc. Tách thành một thành phần để hai form dùng đúng một bản, không
// sao chép 150 dòng rồi để hai nơi lệch nhau dần.
//
// Ba cách điền, từ nhanh tới chậm:
//   1. Sao chép từ một lớp đã có (thường là lớp cùng khóa, khóa trước) — nhanh nhất.
//   2. Tải file Excel mẫu, điền rồi nạp lại.
//   3. Gõ trực tiếp từng buổi.

export type RoadmapDraft = {
  sessionNumber: number;
  title: string;
  objective: string;
  materials: string;
  teacherGuide: string;
  homeworkGuide: string;
  teacherRequirement: string;
};

type RoadmapSource = {
  id: string;
  classCode: string;
  className: string;
  courseName: string | null;
  status: string;
  sameCourse: boolean;
  sessionCount: number;
  authoredCount: number;
};

export function buildRoadmapDraft(sessionNumber: number): RoadmapDraft {
  return {
    sessionNumber,
    title: `Buổi ${sessionNumber}`,
    objective: "",
    materials: "",
    teacherGuide: "",
    homeworkGuide: "",
    teacherRequirement: "",
  };
}

/** Buổi này có nội dung THẬT do người soạn, không phải khung rỗng "Buổi N". */
export function isAuthoredRoadmapDraft(item: RoadmapDraft): boolean {
  const title = item.title.trim();
  return (
    (title !== "" && title !== `Buổi ${item.sessionNumber}`) ||
    Boolean(item.objective.trim()) ||
    Boolean(item.materials.trim()) ||
    Boolean(item.teacherGuide.trim()) ||
    Boolean(item.homeworkGuide.trim()) ||
    Boolean(item.teacherRequirement.trim())
  );
}

// ---- Chèn / xóa / đổi chỗ buổi ----
//
// Ví dụ thật: tới tuần thi học kỳ, trung tâm chèn thêm 2 buổi ôn thi vào giữa lộ trình.
// Nội dung nối với buổi học THEO VỊ TRÍ (buổi thứ k lấy mục thứ k), nên chèn một mục vào vị
// trí p thì mọi mục từ p trở đi lùi xuống 1, tổng số buổi tăng 1; xóa thì ngược lại. NGÀY
// học không đổi — lịch vẫn theo lịch cố định, chỉ nội dung dịch sang buổi kế tiếp.
//
// Tên mặc định "Buổi N" chứa luôn số thứ tự: dịch vị trí mà giữ nguyên chữ thì buổi 7 lại
// mang tên "Buổi 6" và bị coi như tên tự đặt. Các hàm dưới đây đổi tên mặc định theo vị trí
// mới, còn tên do người soạn đặt thì giữ nguyên.

function renumberDraft(item: RoadmapDraft, nextNumber: number): RoadmapDraft {
  const isDefaultTitle = item.title.trim() === "" || item.title.trim() === `Buổi ${item.sessionNumber}`;
  return { ...item, sessionNumber: nextNumber, title: isDefaultTitle ? `Buổi ${nextNumber}` : item.title };
}

/** Chèn một buổi trống vào đúng vị trí `position`; các buổi từ đó trở đi lùi xuống 1. */
export function insertRoadmapDraftAt(list: RoadmapDraft[], position: number): RoadmapDraft[] {
  const shifted = list.map((item) => (item.sessionNumber >= position ? renumberDraft(item, item.sessionNumber + 1) : item));
  return [...shifted, buildRoadmapDraft(position)].sort((a, b) => a.sessionNumber - b.sessionNumber);
}

/** Xóa buổi ở vị trí `position`; các buổi phía sau tiến lên 1. */
export function removeRoadmapDraftAt(list: RoadmapDraft[], position: number): RoadmapDraft[] {
  return list
    .filter((item) => item.sessionNumber !== position)
    .map((item) => (item.sessionNumber > position ? renumberDraft(item, item.sessionNumber - 1) : item))
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}

/** Đổi chỗ nội dung hai buổi. */
export function swapRoadmapDrafts(list: RoadmapDraft[], first: number, second: number): RoadmapDraft[] {
  return list
    .map((item) => {
      if (item.sessionNumber === first) return renumberDraft(item, second);
      if (item.sessionNumber === second) return renumberDraft(item, first);
      return item;
    })
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}

export type RoadmapSessionDate = { date: string; status: "TAUGHT" | "SCHEDULED" | "PROJECTED" };

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
function formatSessionDate(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/**
 * Giữ danh sách buổi luôn đủ từ 1 tới tổng số buổi. KHÔNG xóa các buổi vượt quá khi
 * người dùng giảm tổng số buổi — tăng lại thì nội dung đã soạn vẫn còn nguyên.
 */
export function useRoadmapDrafts(initial: RoadmapDraft[], totalSessions: number) {
  const [roadmapItems, setRoadmapItems] = useState<RoadmapDraft[]>(initial);

  useEffect(() => {
    if (!Number.isFinite(totalSessions) || totalSessions <= 0) return;
    setRoadmapItems((prev) => {
      const missing: RoadmapDraft[] = [];
      for (let sessionNumber = 1; sessionNumber <= totalSessions; sessionNumber += 1) {
        if (!prev.some((item) => item.sessionNumber === sessionNumber)) missing.push(buildRoadmapDraft(sessionNumber));
      }
      if (missing.length === 0) return prev;
      return [...prev, ...missing].sort((a, b) => a.sessionNumber - b.sessionNumber);
    });
  }, [totalSessions]);

  const roadmapItemsInRange = roadmapItems.filter((item) => item.sessionNumber <= totalSessions);
  const hiddenAuthoredCount = roadmapItems.filter(
    (item) => item.sessionNumber > totalSessions && isAuthoredRoadmapDraft(item),
  ).length;

  return { roadmapItems, setRoadmapItems, roadmapItemsInRange, hiddenAuthoredCount };
}

export default function ClassRoadmapEditor({
  items,
  setItems,
  totalSessions,
  classCode,
  courseId,
  excludeClassId,
  sessionDates,
  taughtCount = 0,
  onTotalSessionsChange,
}: {
  /** Các buổi trong phạm vi tổng số buổi hiện tại. */
  items: RoadmapDraft[];
  setItems: React.Dispatch<React.SetStateAction<RoadmapDraft[]>>;
  totalSessions: number;
  classCode: string;
  /** Khóa học của lớp đang soạn — lớp cùng khóa được xếp lên đầu danh sách sao chép. */
  courseId?: string | null;
  /** Không cho sao chép từ chính lớp đang sửa. */
  excludeClassId?: string;
  /** Ngày dự kiến của từng buổi, theo số thứ tự buổi. */
  sessionDates?: Record<number, RoadmapSessionDate>;
  /** Các buổi từ 1 tới số này đã dạy — khóa, không chèn/xóa/đổi chỗ được. */
  taughtCount?: number;
  /** Chèn/xóa buổi thì tổng số buổi của lớp tăng/giảm theo. Không truyền = không cho chèn/xóa. */
  onTotalSessionsChange?: (next: number) => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [sources, setSources] = useState<RoadmapSource[] | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(courseId ? { courseId } : {});
    let cancelled = false;
    fetch(`/api/classes/roadmap-sources?${query.toString()}`)
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data) => {
        if (cancelled) return;
        setSources((data.items ?? []).filter((item: RoadmapSource) => item.id !== excludeClassId));
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, excludeClassId]);

  const visibleItems = items.slice(0, visibleCount);
  const authoredCount = items.filter(isAuthoredRoadmapDraft).length;

  function patch(sessionNumber: number, key: keyof Omit<RoadmapDraft, "sessionNumber">, value: string) {
    setItems((prev) => prev.map((item) => (item.sessionNumber === sessionNumber ? { ...item, [key]: value } : item)));
    setError(null);
    setNotice(null);
  }

  function insertAt(position: number) {
    if (!onTotalSessionsChange) return;
    if (position <= taughtCount) {
      setError(`Không chèn được vào trước buổi ${taughtCount} vì các buổi đó đã dạy — chèn phía sau buổi ${taughtCount}.`);
      return;
    }
    setItems((prev) => insertRoadmapDraftAt(prev, position));
    onTotalSessionsChange(totalSessions + 1);
    setVisibleCount((current) => Math.max(current, position + 1));
    setError(null);
    setNotice(`Đã chèn buổi mới vào vị trí ${position}. Các buổi phía sau lùi xuống 1, tổng số buổi thành ${totalSessions + 1}. Bấm lưu để áp dụng.`);
  }

  function removeAt(position: number) {
    if (!onTotalSessionsChange) return;
    if (position <= taughtCount) {
      setError(`Buổi ${position} đã dạy, không xóa được.`);
      return;
    }
    if (totalSessions <= 1) return;
    setItems((prev) => removeRoadmapDraftAt(prev, position));
    onTotalSessionsChange(totalSessions - 1);
    setError(null);
    setNotice(`Đã xóa buổi ${position}. Các buổi phía sau tiến lên 1, tổng số buổi thành ${totalSessions - 1}. Bấm lưu để áp dụng.`);
  }

  function move(position: number, direction: -1 | 1) {
    const target = position + direction;
    if (target < 1 || target > items.length) return;
    if (position <= taughtCount || target <= taughtCount) {
      setError("Không đổi chỗ với buổi đã dạy.");
      return;
    }
    setItems((prev) => swapRoadmapDrafts(prev, position, target));
    setError(null);
    setNotice(null);
  }

  // Ghép dữ liệu nhận về (từ lớp khác hoặc từ file) vào đúng số buổi. Chỉ ghi đè ô nào
  // nguồn CÓ nội dung — ô nguồn để trống thì giữ nguyên nội dung đang soạn dở.
  function mergeIncoming(incoming: Partial<RoadmapDraft>[]) {
    const bySession = new Map(incoming.map((row) => [Number(row.sessionNumber), row]));
    setItems((prev) =>
      prev.map((item) => {
        const row = bySession.get(item.sessionNumber);
        if (!row) return item;
        return {
          ...item,
          title: row.title?.trim() || item.title,
          objective: row.objective?.trim() || item.objective,
          materials: row.materials?.trim() || item.materials,
          teacherGuide: row.teacherGuide?.trim() || item.teacherGuide,
          homeworkGuide: row.homeworkGuide?.trim() || item.homeworkGuide,
          teacherRequirement: row.teacherRequirement?.trim() || item.teacherRequirement,
        };
      }),
    );
    // Đếm thẳng từ dữ liệu vào, không đọc biến bị sửa trong callback setState — callback
    // đó không chắc đã chạy xong trước dòng này (lỗi cũ: số hiện ra luôn bằng 0). Chỉ đếm
    // buổi THẬT SỰ có nội dung: lớp nguồn 48 buổi mà mới soạn 4 thì báo "đã chép 4 buổi",
    // không báo 48 cho người dùng tưởng đã có đủ giáo án.
    return incoming.filter(
      (row) =>
        items.some((item) => item.sessionNumber === Number(row.sessionNumber)) &&
        isAuthoredRoadmapDraft({ ...buildRoadmapDraft(Number(row.sessionNumber)), ...row } as RoadmapDraft),
    ).length;
  }

  async function copyFromClass() {
    if (!sourceId) return;
    if (items.length === 0) {
      setError("Cần nhập tổng số buổi trước rồi mới sao chép lộ trình.");
      return;
    }
    setCopying(true);
    setError(null);
    const response = await fetch(`/api/classes/${sourceId}/roadmap`);
    const data = await response.json().catch(() => ({}));
    setCopying(false);
    if (!response.ok) {
      setError(data.error ?? "Không lấy được lộ trình của lớp đã chọn.");
      return;
    }
    const rows: Partial<RoadmapDraft>[] = (data.items ?? []).map((row: Record<string, unknown>) => ({
      sessionNumber: Number(row.sessionNumber),
      title: String(row.title ?? ""),
      objective: String(row.objective ?? ""),
      materials: String(row.materials ?? ""),
      teacherGuide: String(row.teacherGuide ?? ""),
      homeworkGuide: String(row.homeworkGuide ?? ""),
      teacherRequirement: String(row.teacherRequirement ?? ""),
    }));
    const count = mergeIncoming(rows);
    const source = sources?.find((item) => item.id === sourceId);
    const overflow = rows.filter((row) => Number(row.sessionNumber) > totalSessions).length;
    setNotice(
      (count > 0
        ? `Đã sao chép nội dung ${count} buổi từ lớp ${source?.classCode ?? ""}.`
        : `Lớp ${source?.classCode ?? ""} chưa có buổi nào nằm trong ${totalSessions} buổi của lớp này.`) +
        (overflow > 0 ? ` Lớp nguồn có thêm ${overflow} buổi vượt quá ${totalSessions} buổi của lớp này nên không chép.` : "") +
        " Kiểm tra lại rồi bấm lưu.",
    );
  }

  async function downloadTemplate() {
    if (items.length === 0) {
      setError("Cần nhập tổng số buổi trước rồi mới tải được file mẫu lộ trình.");
      return;
    }
    setError(null);
    const query = new URLSearchParams({ totalSessions: String(items.length), classCode: classCode.trim() || "lop-hoc" });
    const response = await fetch(`/api/classes/roadmap-template?${query.toString()}`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Không thể tạo file mẫu Excel.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mau-lo-trinh-${classCode.trim() || "lop-hoc"}-${items.length}-buoi.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice("Đã tải file mẫu .xlsx — điền giáo án/tài liệu theo từng buổi rồi bấm “Nạp file Excel”.");
  }

  async function importFile(file: File) {
    if (items.length === 0) {
      setError("Cần nhập tổng số buổi trước rồi mới nạp file lộ trình.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/classes/roadmap-import", { method: "POST", body: formData });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Không thể đọc file lộ trình đã tải lên.");
      return;
    }
    const count = mergeIncoming(Array.isArray(result.items) ? result.items : []);
    setError(null);
    setNotice(`Đã nạp nội dung ${count} buổi từ file "${file.name}". Kiểm tra lại rồi bấm lưu.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        {sources && sources.length > 0 ? (
          <label className="form-group flex-1">
            <span className="label-sm">Sao chép lộ trình từ lớp đã có</span>
            <div className="flex gap-2">
              <select className="input" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">-- Chọn lớp nguồn --</option>
                {sources.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sameCourse ? "★ " : ""}
                    {item.classCode} · {item.className} · {item.authoredCount}/{item.sessionCount} buổi đã soạn
                    {item.status !== "ACTIVE" ? " (đã kết thúc)" : ""}
                  </option>
                ))}
              </select>
              <button type="button" onClick={copyFromClass} disabled={!sourceId || copying} className="btn-ghost-sm whitespace-nowrap">
                {copying ? "Đang chép..." : "Sao chép"}
              </button>
            </div>
            <span className="text-[10px] leading-tight text-ink-muted48">★ = cùng khóa học. Chỉ ghi đè ô lớp nguồn có nội dung.</span>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadTemplate} className="btn-ghost-sm">
            Tải file Excel mẫu
          </button>
          <label className="inline-flex cursor-pointer items-center rounded-full border border-[#dbe7ff] bg-white px-4 py-2 text-sm font-semibold text-[#0f1729] transition hover:border-primary/40 hover:text-primary">
            Nạp file Excel
            <input
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4ed8]">{notice}</div> : null}
      {error ? <div className="alert-danger">{error}</div> : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#dbe7ff] bg-white px-4 py-8 text-center text-sm text-[#64748b]">
          Nhập tổng số buổi để tạo khung tài liệu học tập.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#64748b]">
            Đã soạn <strong className="text-[#0f1729]">{authoredCount}</strong>/{items.length} buổi. Buổi để trống vẫn lưu được, soạn tiếp sau.
          </p>
          {taughtCount > 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Buổi 1–{taughtCount} đã dạy nên bị khóa vị trí: đẩy nội dung của chúng đi là viết lại lịch sử buổi học đã diễn ra.
              Muốn thêm buổi ôn tập thì chèn vào sau buổi {taughtCount}.
            </p>
          ) : null}
          {visibleItems.map((item) => {
            const dateInfo = sessionDates?.[item.sessionNumber];
            const locked = item.sessionNumber <= taughtCount;
            const nextDate = sessionDates?.[item.sessionNumber + 1];
            return (
              <div key={item.sessionNumber} className="space-y-2">
                <div className={`rounded-[22px] border p-4 ${locked ? "border-slate-200 bg-slate-50" : "border-[#e5eaf7] bg-white"}`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#0f1729]">
                      Buổi {item.sessionNumber}
                      {dateInfo ? (
                        <span className="rounded-md bg-[#eef6ff] px-2 py-0.5 text-xs font-semibold text-[#2563eb]">
                          {formatSessionDate(dateInfo.date)}
                          {dateInfo.status === "PROJECTED" ? " · dự kiến" : ""}
                        </span>
                      ) : null}
                      {locked ? <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Đã dạy · khóa vị trí</span> : null}
                    </p>
                    {!locked ? (
                      <div className="flex items-center gap-1">
                        <button type="button" className="btn-ghost-sm px-2" title="Đưa lên 1 buổi" disabled={item.sessionNumber - 1 <= taughtCount} onClick={() => move(item.sessionNumber, -1)}>
                          ↑
                        </button>
                        <button type="button" className="btn-ghost-sm px-2" title="Đưa xuống 1 buổi" disabled={item.sessionNumber >= items.length} onClick={() => move(item.sessionNumber, 1)}>
                          ↓
                        </button>
                        {onTotalSessionsChange ? (
                          <button type="button" className="btn-ghost-sm px-2 text-rose-600" title="Xóa buổi này, tổng số buổi giảm 1" disabled={items.length <= 1} onClick={() => removeAt(item.sessionNumber)}>
                            Xóa buổi
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-group md:col-span-2">
                  <span className="label">Tên bài / tiêu đề buổi</span>
                  <input className="input" value={item.title} onChange={(event) => patch(item.sessionNumber, "title", event.target.value)} />
                </label>
                <label className="form-group">
                  <span className="label">Mục tiêu buổi học</span>
                  <textarea className="input min-h-[96px] resize-y" value={item.objective} onChange={(event) => patch(item.sessionNumber, "objective", event.target.value)} />
                </label>
                <label className="form-group">
                  <span className="label">Tài liệu / học cụ</span>
                  <textarea className="input min-h-[96px] resize-y" value={item.materials} onChange={(event) => patch(item.sessionNumber, "materials", event.target.value)} />
                </label>
                <label className="form-group">
                  <span className="label">Hướng dẫn giáo viên</span>
                  <textarea className="input min-h-[96px] resize-y" value={item.teacherGuide} onChange={(event) => patch(item.sessionNumber, "teacherGuide", event.target.value)} />
                </label>
                <label className="form-group">
                  <span className="label">Bài tập / dặn dò</span>
                  <textarea className="input min-h-[96px] resize-y" value={item.homeworkGuide} onChange={(event) => patch(item.sessionNumber, "homeworkGuide", event.target.value)} />
                </label>
                <label className="form-group md:col-span-2">
                  <span className="label">Yêu cầu giáo viên phải làm cho buổi này (để trống = không có yêu cầu)</span>
                  <textarea
                    className="input min-h-[72px] resize-y"
                    value={item.teacherRequirement}
                    onChange={(event) => patch(item.sessionNumber, "teacherRequirement", event.target.value)}
                    placeholder="Ví dụ: Phải giao bài tập Unit 3, chấm và trả kết quả trước buổi sau..."
                  />
                  <p className="form-hint">Sau khi điểm danh xong buổi này, hệ thống sẽ yêu cầu xác nhận Đã nộp/Chưa nộp cho đúng nội dung này.</p>
                </label>
              </div>
                </div>
                {onTotalSessionsChange && item.sessionNumber >= taughtCount ? (
                  <button
                    type="button"
                    onClick={() => insertAt(item.sessionNumber + 1)}
                    className="w-full rounded-xl border border-dashed border-[#bfdbfe] bg-white py-1.5 text-xs font-semibold text-[#2563eb] transition hover:bg-[#eff6ff]"
                  >
                    + Chèn 1 buổi vào sau buổi {item.sessionNumber}
                    {nextDate ? ` (sẽ học ${formatSessionDate(nextDate.date)})` : ""}
                  </button>
                ) : null}
              </div>
            );
          })}
          {visibleCount < items.length ? (
            <div className="flex justify-center">
              <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + 12, items.length))} className="btn-ghost-sm">
                Xem thêm {Math.min(12, items.length - visibleCount)} buổi nữa
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
