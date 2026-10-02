"use client";

// KHO CỦA MỘT KHÓA HỌC: tiến trình chuẩn + tài liệu dùng chung.
//
// Soạn một lần ở đây là mọi lớp cùng khóa có đủ, khỏi phải tải lên lại cho từng lớp.
// Lưu ý nghiệp vụ: sửa tiến trình ở đây làm ĐỔI THEO mọi lớp đang chạy khóa này (trừ
// những buổi lớp đã ghi đè riêng) — nên màn hình nói rõ số lớp bị ảnh hưởng trước khi lưu.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";

type RoadmapRow = {
  sessionNumber: number;
  title: string;
  objective: string;
  materials: string;
  teacherGuide: string;
  homeworkGuide: string;
  teacherRequirement: string;
  alertLevel: "NONE" | "YELLOW" | "RED";
};

type MaterialRow = {
  id: string;
  sessionNumber: number | null;
  kind: string;
  title: string;
  url: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  uploadedBy: { fullName: string | null } | null;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CourseLibraryDrawer({
  courseId,
  courseName,
  open,
  onClose,
}: {
  courseId: string;
  courseName: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"roadmap" | "materials">("roadmap");
  const [rows, setRows] = useState<RoadmapRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [affected, setAffected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkForm, setLinkForm] = useState({ title: "", url: "", sessionNumber: "" });
  const [uploadSession, setUploadSession] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [roadmapRes, materialRes] = await Promise.all([
      fetch(`/api/courses/${courseId}/roadmap`).then((res) => res.json()).catch(() => null),
      fetch(`/api/courses/${courseId}/materials`).then((res) => res.json()).catch(() => null),
    ]);
    setLoading(false);
    if (roadmapRes?.items) {
      setRows(roadmapRes.items);
      setAffected(roadmapRes.affectedClasses ?? 0);
    }
    if (materialRes?.items) setMaterials(materialRes.items);
  }, [courseId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function patchRow(sessionNumber: number, field: keyof RoadmapRow, value: string) {
    setRows((current) =>
      current.map((row) => (row.sessionNumber === sessionNumber ? { ...row, [field]: value } : row)),
    );
    setNotice(null);
  }

  function addSession() {
    setRows((current) => [
      ...current,
      {
        sessionNumber: current.length + 1,
        title: `Buổi ${current.length + 1}`,
        objective: "",
        materials: "",
        teacherGuide: "",
        homeworkGuide: "",
        teacherRequirement: "",
        alertLevel: "NONE",
      },
    ]);
  }

  async function saveRoadmap() {
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/courses/${courseId}/roadmap`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalSessions: rows.length, items: rows }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Không lưu được tiến trình khóa học.");
      return;
    }
    setNotice(
      data.affectedClasses > 0
        ? `Đã lưu ${data.saved} buổi. ${data.affectedClasses} lớp đang học khóa này cập nhật theo ngay (trừ buổi lớp đã sửa riêng).`
        : `Đã lưu ${data.saved} buổi.`,
    );
    router.refresh();
  }

  async function uploadFile(file: File) {
    setSaving(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    if (uploadSession) form.append("sessionNumber", uploadSession);
    const res = await fetch(`/api/courses/${courseId}/materials`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Không tải được tài liệu lên.");
      return;
    }
    setMaterials((current) => [...current, data.item]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function addLink(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/courses/${courseId}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(linkForm),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Không thêm được đường dẫn.");
      return;
    }
    setMaterials((current) => [...current, data.item]);
    setLinkForm({ title: "", url: "", sessionNumber: "" });
  }

  async function removeMaterial(id: string) {
    const res = await fetch(`/api/courses/${courseId}/materials?materialId=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không xóa được tài liệu.");
      return;
    }
    setMaterials((current) => current.filter((item) => item.id !== id));
  }

  return (
    <ResponsiveDrawer open={open} onClose={onClose} title={`Kho khóa học · ${courseName}`} widthClassName="max-w-5xl">
      <div className="space-y-4">
        <div className="flex items-center gap-1 rounded-xl bg-[#f1f5fb] p-1">
          {([
            ["roadmap", `Tiến trình (${rows.length} buổi)`],
            ["materials", `Tài liệu (${materials.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                tab === key ? "bg-white text-[#0f1729] shadow-sm" : "text-[#64748b] hover:text-[#0f1729]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
        {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{notice}</p> : null}
        {loading ? <p className="text-sm text-ink-muted48">Đang tải…</p> : null}

        {tab === "roadmap" ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Tiến trình này dùng chung cho mọi lớp của khóa.{" "}
              {affected > 0 ? (
                <strong>Sửa ở đây là {affected} lớp đang học cập nhật theo</strong>
              ) : (
                <strong>Chưa có lớp nào đang chạy khóa này</strong>
              )}
              , trừ những buổi lớp đã sửa riêng.
            </p>

            <div className="overflow-x-auto rounded-xl border border-[#e3ecf6]">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-[#f7f9fc] text-[11px] uppercase tracking-wide text-ink-muted48">
                  <tr>
                    <th className="px-3 py-2 w-16">Buổi</th>
                    <th className="px-3 py-2">Tên bài</th>
                    <th className="px-3 py-2">Mục tiêu</th>
                    <th className="px-3 py-2">Tài liệu / học cụ</th>
                    <th className="px-3 py-2">Yêu cầu với giáo viên</th>
                    <th className="px-3 py-2 w-40">Cảnh báo chuyên môn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3f9]">
                  {rows.map((row) => (
                    <tr key={row.sessionNumber} className="align-top">
                      <td className="px-3 py-2 font-bold tabular-nums text-ink">{row.sessionNumber}</td>
                      <td className="px-3 py-2">
                        <input className="input" value={row.title} onChange={(e) => patchRow(row.sessionNumber, "title", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="input" value={row.objective} onChange={(e) => patchRow(row.sessionNumber, "objective", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="input" value={row.materials} onChange={(e) => patchRow(row.sessionNumber, "materials", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="input"
                          value={row.teacherRequirement}
                          onChange={(e) => patchRow(row.sessionNumber, "teacherRequirement", e.target.value)}
                          placeholder="vd: thu bài tập, quay video"
                        />
                      </td>
                      {/* Bật cảnh báo được ngay cả khi CHƯA biết sẽ phải làm gì — nội
                          dung điền sau vào ô bên trái. Buổi vàng/đỏ hiện nổi bật ở thời
                          khoá biểu và còn kêu cho tới khi giáo viên xác nhận đã làm. */}
                      <td className="px-3 py-2">
                        <select
                          className={`input ${
                            row.alertLevel === "RED"
                              ? "border-rose-300 bg-rose-50 font-bold text-rose-700"
                              : row.alertLevel === "YELLOW"
                                ? "border-amber-300 bg-amber-50 font-bold text-amber-800"
                                : ""
                          }`}
                          value={row.alertLevel}
                          onChange={(e) => patchRow(row.sessionNumber, "alertLevel", e.target.value)}
                        >
                          <option value="NONE">Không</option>
                          <option value="YELLOW">Vàng · cần lưu ý</option>
                          <option value="RED">Đỏ · bắt buộc, có hạn</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-ink-muted48">
                        Khóa này chưa có tiến trình. Bấm “Thêm buổi” để soạn buổi đầu tiên.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addSession} className="btn-ghost-sm">
                + Thêm buổi
              </button>
              <button type="button" onClick={() => void saveRoadmap()} disabled={saving || rows.length === 0} className="btn-primary">
                {saving ? "Đang lưu…" : "Lưu tiến trình khóa"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-[#e3ecf6] p-3 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="label-sm">Tải file lên</span>
                <input
                  ref={fileRef}
                  type="file"
                  disabled={saving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadFile(file);
                  }}
                  className="block w-full text-sm"
                />
                <input
                  className="input"
                  placeholder="Gắn vào buổi số… (để trống = tài liệu chung)"
                  value={uploadSession}
                  onChange={(event) => setUploadSession(event.target.value)}
                />
                <p className="form-hint">PDF, Word, Excel, PowerPoint, ảnh, âm thanh, video, zip — tối đa 25MB mỗi file.</p>
              </div>

              <form onSubmit={addLink} className="space-y-1">
                <span className="label-sm">Hoặc dán đường dẫn</span>
                <input className="input" placeholder="Tên tài liệu" value={linkForm.title} onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))} />
                <input className="input" placeholder="https://drive.google.com/..." value={linkForm.url} onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))} />
                <input className="input" placeholder="Gắn vào buổi số… (để trống = chung)" value={linkForm.sessionNumber} onChange={(e) => setLinkForm((f) => ({ ...f, sessionNumber: e.target.value }))} />
                <button type="submit" disabled={saving || !linkForm.url.trim()} className="btn-ghost-sm">
                  Thêm đường dẫn
                </button>
              </form>
            </div>

            <div className="divide-y divide-[#eef3f9] rounded-xl border border-[#e3ecf6]">
              {materials.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      item.kind === "FILE" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {item.kind === "FILE" ? "FILE" : "LINK"}
                  </span>
                  <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-bold text-[#475569]">
                    {item.sessionNumber ? `Buổi ${item.sessionNumber}` : "Chung cả khóa"}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-ink">{item.title}</span>
                  {item.sizeBytes ? <span className="text-xs text-ink-muted48">{formatSize(item.sizeBytes)}</span> : null}
                  {item.uploadedBy?.fullName ? (
                    <span className="text-xs text-ink-muted48">· {item.uploadedBy.fullName}</span>
                  ) : null}
                  {item.kind === "FILE" ? (
                    <a href={`/api/courses/${courseId}/materials/${item.id}/download`} className="btn-ghost-sm">
                      Tải về
                    </a>
                  ) : (
                    <a href={item.url ?? "#"} target="_blank" rel="noreferrer" className="btn-ghost-sm">
                      Mở link
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeMaterial(item.id)}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-[#b6c2d2] transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    Xóa
                  </button>
                </div>
              ))}
              {materials.length === 0 && !loading ? (
                <p className="px-3 py-8 text-center text-sm text-ink-muted48">
                  Khóa này chưa có tài liệu nào. Tải file lên hoặc dán đường dẫn ở trên.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </ResponsiveDrawer>
  );
}
