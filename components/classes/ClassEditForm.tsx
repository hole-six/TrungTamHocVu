"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd as formatVndBase } from "@/lib/export-utils";

type Course = { id: string; code: string; name: string };
type ClassOption = { id: string; classCode: string; className: string };

type RoadmapDraft = {
  sessionNumber: number;
  title: string;
  objective: string;
  materials: string;
  teacherGuide: string;
  homeworkGuide: string;
  teacherRequirement: string;
};

type ClassProfile = {
  id: string;
  classCode: string;
  className: string;
  classGroup: string | null;
  courseId: string | null;
  tuitionPerSession: number | null;
  sessionsPerWeek: number | null;
  totalSessions: number | null;
  startDate: string | null;
  expectedEndDate: string | null;
  nextClassId?: string | null;
  notes: string | null;
  roadmapItems: RoadmapDraft[];
};

function toDateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatVnd(amount: number | null) {
  return amount == null || Number.isNaN(amount) ? "—" : formatVndBase(amount);
}

function buildRoadmapDraft(sessionNumber: number): RoadmapDraft {
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

const CLASS_EDIT_GUIDE_SECTIONS = [
  {
    title: "Khi nào dùng form sửa lớp?",
    items: [
      "Dùng khi cần chỉnh thông tin lõi của lớp đã tạo: khóa học, học phí, tổng số buổi, ngày khai giảng hoặc lộ trình từng buổi.",
      "Đây là form sửa cấu trúc lớp, không phải nơi xử lý một buổi lẻ bị dời lịch hay học bù.",
      "Nếu lớp đang chạy, nên hiểu rõ tác động trước khi sửa học phí hoặc tổng số buổi.",
    ],
    tone: "info" as const,
  },
  {
    title: "Những phần quan trọng nhất",
    items: [
      "Học phí / buổi và tổng số buổi quyết định ước tính quy mô học phí toàn khóa.",
      "Lộ trình từng buổi là thứ giáo viên nhìn về sau để biết hôm nay dạy gì, dùng gì, dặn gì.",
      "Ngày kết thúc dự kiến là mốc vận hành, còn thực tế có thể thay đổi nếu có nghỉ lễ, buổi bù hoặc dời lịch.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lỗi dễ gặp",
    items: [
      "Sửa tổng số buổi nhưng quên rà lại khối roadmap theo buổi.",
      "Dùng form này để xử lý vấn đề attendance/buổi lẻ sẽ làm lệch khung lớp gốc.",
      "Đổi học phí mà không thống nhất lại với đội vận hành học phí sẽ dễ gây hiểu nhầm về sau.",
    ],
    tone: "warning" as const,
  },
];

export default function ClassEditForm({
  cls,
  courses,
  triggerClassName,
  triggerLabel = "Sửa thông tin lớp",
  renderSummary = true,
  classOptions = [],
}: {
  cls: ClassProfile;
  courses: Course[];
  classOptions?: ClassOption[];
  triggerClassName?: string;
  triggerLabel?: string;
  renderSummary?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [visibleRoadmapCount, setVisibleRoadmapCount] = useState(12);
  // Gợi ý autocomplete cho "Nhóm lớp" — chọn lại đúng ngăn cũ hoặc gõ tên ngăn mới nếu
  // chưa có, tránh gõ lệch chính tả sinh ra ngăn trùng nghĩa.
  const [classGroupOptions, setClassGroupOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/classes/class-groups")
      .then((res) => res.json())
      .then((data) => setClassGroupOptions(data.items ?? []))
      .catch(() => {});
  }, [open]);
  const [form, setForm] = useState({
    className: cls.className,
    classGroup: cls.classGroup ?? "",
    courseId: cls.courseId ?? "",
    tuitionPerSession: cls.tuitionPerSession?.toString() ?? "",
    sessionsPerWeek: cls.sessionsPerWeek?.toString() ?? "",
    totalSessions: cls.totalSessions?.toString() ?? "",
    startDate: toDateInput(cls.startDate),
    expectedEndDate: toDateInput(cls.expectedEndDate),
    nextClassId: cls.nextClassId ?? "",
    notes: cls.notes ?? "",
  });
  const [roadmapItems, setRoadmapItems] = useState<RoadmapDraft[]>(cls.roadmapItems ?? []);

  const totalSessions = form.totalSessions === "" ? 0 : Number(form.totalSessions);
  // Chỉ hiện/lưu các buổi trong phạm vi totalSessions hiện tại — KHÔNG xóa các buổi
  // vượt quá khỏi state khi người dùng giảm số buổi (khác hành vi cũ). Nếu họ tăng số
  // buổi trở lại, nội dung đã soạn cho các buổi đó vẫn còn nguyên thay vì mất trắng.
  const roadmapItemsInRange = roadmapItems.filter((item) => item.sessionNumber <= totalSessions);
  const visibleRoadmapItems = roadmapItemsInRange.slice(0, visibleRoadmapCount);
  const hiddenAuthoredRoadmapCount = roadmapItems.filter(
    (item) =>
      item.sessionNumber > totalSessions &&
      (item.title.trim() || item.objective.trim() || item.materials.trim() || item.teacherGuide.trim() || item.homeworkGuide.trim()),
  ).length;

  useEffect(() => {
    const normalizedTotal = Number.isFinite(totalSessions) && totalSessions > 0 ? totalSessions : 0;
    setRoadmapItems((prev) => {
      if (normalizedTotal <= 0) return prev;
      const next = [...prev];
      for (let sessionNumber = 1; sessionNumber <= normalizedTotal; sessionNumber += 1) {
        if (!next.some((item) => item.sessionNumber === sessionNumber)) {
          next.push(buildRoadmapDraft(sessionNumber));
        }
      }
      next.sort((a, b) => a.sessionNumber - b.sessionNumber);
      return next;
    });
    setVisibleRoadmapCount((current) => {
      if (normalizedTotal <= 0) return 12;
      return Math.max(12, Math.min(normalizedTotal, current));
    });
  }, [totalSessions]);

  function patchRoadmap(sessionNumber: number, key: keyof Omit<RoadmapDraft, "sessionNumber">, value: string) {
    setRoadmapItems((prev) => prev.map((item) => (item.sessionNumber === sessionNumber ? { ...item, [key]: value } : item)));
    setError(null);
    setImportSummary(null);
  }

  async function downloadRoadmapTemplate() {
    if (!roadmapItemsInRange.length) {
      setError("Cần nhập tổng số buổi trước rồi mới tải được file mẫu lộ trình.");
      return;
    }

    setError(null);
    setImportSummary(null);

    const query = new URLSearchParams({
      totalSessions: String(roadmapItemsInRange.length),
      classCode: cls.classCode.trim() || "lop-hoc",
    });

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
    link.download = `mau-lo-trinh-${cls.classCode.trim() || "lop-hoc"}-${roadmapItemsInRange.length}-buoi.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setImportSummary("Đã tải file mẫu .xlsx để điền giáo án/tài liệu theo từng buổi.");
  }

  async function importRoadmapFile(file: File) {
    if (!roadmapItemsInRange.length) {
      setError("Cần nhập tổng số buổi trước rồi mới nhập file lộ trình.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/classes/roadmap-import", {
      method: "POST",
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Không thể đọc file lộ trình đã tải lên.");
      return;
    }

    const importedRows: RoadmapDraft[] = Array.isArray(result.items) ? result.items : [];

    let mergedCount = 0;
    setRoadmapItems((prev) =>
      prev.map((item) => {
        const imported = importedRows.find((row) => row.sessionNumber === item.sessionNumber);
        if (!imported) return item;
        mergedCount += 1;
        return {
          ...item,
          title: imported.title || item.title,
          objective: imported.objective || item.objective,
          materials: imported.materials || item.materials,
          teacherGuide: imported.teacherGuide || item.teacherGuide,
          homeworkGuide: imported.homeworkGuide || item.homeworkGuide,
          teacherRequirement: imported.teacherRequirement || item.teacherRequirement,
        };
      }),
    );

    setError(null);
    setImportSummary(`Đã merge ${mergedCount} buổi từ file "${file.name}" vào lộ trình lớp.`);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/classes/${cls.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        roadmapItems: roadmapItemsInRange.map((item) => ({
          sessionNumber: item.sessionNumber,
          title: item.title,
          objective: item.objective,
          materials: item.materials,
          teacherGuide: item.teacherGuide,
          homeworkGuide: item.homeworkGuide,
          teacherRequirement: item.teacherRequirement,
        })),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không lưu được thông tin lớp.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  const course = courses.find((item) => item.id === cls.courseId);

  return (
    <>
      {renderSummary ? (
      <div className="rounded-2xl border border-[#e5eaf7] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0f1729]">Thông tin lớp học</h2>
            <p className="mt-1 text-sm text-[#64748b]">Tóm tắt khóa học, học phí, tiến độ và ghi chú vận hành của lớp.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[#e5eaf7] bg-white px-4 py-2 text-sm font-semibold text-[#0f1729] shadow-sm transition-all hover:border-[#3b82f6] hover:text-[#3b82f6]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Sửa thông tin lớp
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Nhóm lớp</p>
            <p className="font-semibold text-[#0f1729]">{cls.classGroup ?? "Chưa khai báo"}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Khóa học</p>
            <p className="font-semibold text-[#0f1729]">{course ? `[${course.code}] ${course.name}` : "Chưa gắn"}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Học phí / buổi</p>
            <p className="font-semibold text-[#0f1729]">{formatVnd(cls.tuitionPerSession)}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Số buổi / tuần</p>
            <p className="font-semibold text-[#0f1729]">{cls.sessionsPerWeek ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Tổng số buổi</p>
            <p className="font-semibold text-[#0f1729]">{cls.totalSessions ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-[#e5eaf7] bg-[#f8faff] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">Ghi chú</p>
            <p className="font-semibold text-[#0f1729]">{cls.notes ?? "Chưa có ghi chú"}</p>
          </div>
        </div>
      </div>
      ) : null}

      {!renderSummary ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={triggerClassName ?? "inline-flex items-center gap-2 rounded-xl border-2 border-[#e5eaf7] bg-white px-4 py-2 text-sm font-semibold text-[#0f1729] shadow-sm transition-all hover:border-[#3b82f6] hover:text-[#3b82f6]"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {triggerLabel}
        </button>
      ) : null}

      <ResponsiveDrawer 
        widthClassName="max-w-5xl"
        open={open}
        onClose={() => setOpen(false)}
        title="Sửa thông tin lớp học"
        description="Cập nhật khóa học, học phí, số buổi, lộ trình từng buổi và ghi chú vận hành của lớp."
        guide={<FormGuide title="Hướng dẫn sửa lớp học" summary="Đây là form chỉnh cấu trúc lõi của lớp. Người vận hành nên rà kỹ học phí, số buổi và lộ trình từng buổi trước khi lưu để tránh ảnh hưởng dây chuyền." sections={CLASS_EDIT_GUIDE_SECTIONS} position="inline" />}
      >
        <form onSubmit={save} className="space-y-6">
          <label className="form-group">
            <span className="label">Tên lớp</span>
            <input required className="input" value={form.className} onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))} />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-group">
              <span className="label">Nhóm lớp</span>
              <input
                className="input"
                list="class-group-options"
                placeholder="Chọn ngăn có sẵn hoặc gõ tên ngăn mới..."
                value={form.classGroup}
                onChange={(event) => setForm((current) => ({ ...current, classGroup: event.target.value }))}
              />
              <datalist id="class-group-options">
                {classGroupOptions.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            </label>

            <label className="form-group">
              <span className="label">Khóa học chuẩn</span>
              <select className="input" value={form.courseId} onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value }))}>
                <option value="">Nhập tay / chưa gắn khóa</option>
                {courses.map((courseOption) => (
                  <option key={courseOption.id} value={courseOption.id}>
                    [{courseOption.code}] {courseOption.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group">
              <span className="label">Học phí / buổi</span>
              <CurrencyInput value={form.tuitionPerSession} onChange={(next) => setForm((current) => ({ ...current, tuitionPerSession: String(next) }))} />
              <p className="form-hint">{form.tuitionPerSession ? formatVnd(Number(form.tuitionPerSession) || 0) : ""}</p>
            </label>

            <label className="form-group">
              <span className="label">Số buổi / tuần</span>
              <input type="number" min={1} max={7} className="input" value={form.sessionsPerWeek} onChange={(event) => setForm((current) => ({ ...current, sessionsPerWeek: event.target.value }))} />
            </label>

            <label className="form-group">
              <span className="label">Tổng số buổi</span>
              <input type="number" min={1} className="input" value={form.totalSessions} onChange={(event) => setForm((current) => ({ ...current, totalSessions: event.target.value }))} />
              {hiddenAuthoredRoadmapCount > 0 ? (
                <p className="form-hint text-amber-700">
                  Đang giảm số buổi: nội dung lộ trình đã soạn cho {hiddenAuthoredRoadmapCount} buổi cuối sẽ tạm ẩn và không được lưu — tăng số buổi trở lại để khôi phục.
                </p>
              ) : null}
            </label>

            <label className="form-group">
              <span className="label">Ngày khai giảng</span>
              <input type="date" className="input" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>

            <label className="form-group md:col-span-2">
              <span className="label">Ngày dự kiến kết thúc</span>
              <input type="date" className="input" value={form.expectedEndDate} onChange={(event) => setForm((current) => ({ ...current, expectedEndDate: event.target.value }))} />
            </label>

            <label className="form-group md:col-span-2">
              <span className="label">Lớp tiếp theo (không bắt buộc)</span>
              <select className="input" value={form.nextClassId} onChange={(event) => setForm((current) => ({ ...current, nextClassId: event.target.value }))}>
                <option value="">Chưa cấu hình</option>
                {classOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.classCode} - {item.className}
                  </option>
                ))}
              </select>
              <p className="form-hint">Học viên học hết lớp này mà chưa đủ số buổi sẽ được đề xuất chuyển sang lớp đã chọn ở đây.</p>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[#e5eaf7] bg-[#fbfdff] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#64748b]">Mã lớp</p>
              <p className="mt-2 text-base font-semibold text-[#0f1729]">{cls.classCode}</p>
            </div>
            <div className="rounded-2xl border border-[#e5eaf7] bg-[#fbfdff] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#64748b]">Số buổi lộ trình đang lưu</p>
              <p className="mt-2 text-base font-semibold text-[#0f1729]">{roadmapItemsInRange.length}</p>
            </div>
          </div>

          <div className="space-y-4 rounded-[24px] border border-[#dbe7ff] bg-[#f8fbff] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0f1729]">Tài liệu học tập theo từng buổi</p>
                <p className="mt-1 text-xs text-[#64748b]">Sửa trực tiếp từng buổi hoặc tải file Excel mẫu để điền rồi merge lại.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadRoadmapTemplate} className="btn-ghost-sm">
                  Tải file Excel mẫu
                </button>
                <label className="inline-flex cursor-pointer items-center rounded-full border border-[#dbe7ff] bg-white px-4 py-2 text-sm font-semibold text-[#0f1729] transition hover:border-primary/40 hover:text-primary">
                  Merge file Excel
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importRoadmapFile(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            {importSummary ? <div className="rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4ed8]">{importSummary}</div> : null}

            {roadmapItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dbe7ff] bg-white px-4 py-8 text-center text-sm text-[#64748b]">
                Cần nhập tổng số buổi để tạo khung tài liệu học tập.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleRoadmapItems.map((item) => (
                  <div key={item.sessionNumber} className="rounded-[22px] border border-[#e5eaf7] bg-white p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#0f1729]">Buổi {item.sessionNumber}</p>
                        <p className="mt-1 text-xs text-[#64748b]">Tên bài, mục tiêu, tài liệu và ghi chú cho giáo viên.</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="form-group md:col-span-2">
                        <span className="label">Tên bài / tiêu đề buổi</span>
                        <input className="input" value={item.title} onChange={(event) => patchRoadmap(item.sessionNumber, "title", event.target.value)} />
                      </label>

                      <label className="form-group">
                        <span className="label">Mục tiêu buổi học</span>
                        <textarea className="input min-h-[96px] resize-y" value={item.objective} onChange={(event) => patchRoadmap(item.sessionNumber, "objective", event.target.value)} />
                      </label>

                      <label className="form-group">
                        <span className="label">Tài liệu / học cụ</span>
                        <textarea className="input min-h-[96px] resize-y" value={item.materials} onChange={(event) => patchRoadmap(item.sessionNumber, "materials", event.target.value)} />
                      </label>

                      <label className="form-group">
                        <span className="label">Hướng dẫn giáo viên</span>
                        <textarea className="input min-h-[96px] resize-y" value={item.teacherGuide} onChange={(event) => patchRoadmap(item.sessionNumber, "teacherGuide", event.target.value)} />
                      </label>

                      <label className="form-group">
                        <span className="label">Bài tập / dặn dò</span>
                        <textarea className="input min-h-[96px] resize-y" value={item.homeworkGuide} onChange={(event) => patchRoadmap(item.sessionNumber, "homeworkGuide", event.target.value)} />
                      </label>

                      <label className="form-group md:col-span-2">
                        <span className="label">Yêu cầu giáo viên phải làm cho buổi này (để trống = không có yêu cầu)</span>
                        <textarea
                          className="input min-h-[72px] resize-y"
                          value={item.teacherRequirement}
                          onChange={(event) => patchRoadmap(item.sessionNumber, "teacherRequirement", event.target.value)}
                          placeholder="Ví dụ: Phải giao bài tập Unit 3, chấm và trả kết quả trước buổi sau..."
                        />
                        <p className="form-hint">Sau khi điểm danh xong buổi này, hệ thống sẽ yêu cầu xác nhận Đã nộp/Chưa nộp cho đúng nội dung này.</p>
                      </label>
                    </div>
                  </div>
                ))}

                {visibleRoadmapCount < roadmapItems.length ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleRoadmapCount((current) => Math.min(current + 12, roadmapItems.length))}
                      className="btn-ghost-sm"
                    >
                      Xem thêm {Math.min(12, roadmapItems.length - visibleRoadmapCount)} buổi nữa
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <label className="form-group">
            <span className="label">Ghi chú nội bộ</span>
            <textarea className="input resize-none" rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>

          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex gap-3 border-t border-[#e6eefc] pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Hủy
            </button>
          </div>
        </form>
      </ResponsiveDrawer>
    </>
  );
}
