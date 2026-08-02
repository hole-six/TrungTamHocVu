"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SlideOver from "@/components/ui/SlideOver";

type Employee = {
  id: string;
  fullName: string;
  shortName: string;
  position: string | null;
};

type DefaultAssignment = {
  id: string;
  role: string;
  notes: string | null;
  employeeId: string;
  employee: {
    fullName: string;
    shortName: string;
  };
};

type AssignmentDraft = {
  key: string;
  roleType: "TEACHER" | "ASSISTANT";
  employeeId: string;
  notes: string;
};

function getRoleType(role: string): "TEACHER" | "ASSISTANT" | null {
  const normalized = role.trim().toUpperCase();
  if (normalized === "TEACHER" || /^TEACHER_\d+$/.test(normalized)) return "TEACHER";
  if (normalized === "ASSISTANT" || normalized === "ASSISTANT2" || /^ASSISTANT_\d+$/.test(normalized)) return "ASSISTANT";
  return null;
}

function getRoleLabel(role: string) {
  const type = getRoleType(role);
  if (!type) return role;
  return type === "TEACHER" ? "Giáo viên" : "Trợ giảng";
}

function createDraft(roleType: "TEACHER" | "ASSISTANT", seed = Math.random().toString(36).slice(2)): AssignmentDraft {
  return {
    key: `${roleType}-${seed}`,
    roleType,
    employeeId: "",
    notes: "",
  };
}

function normalizeRole(roleType: "TEACHER" | "ASSISTANT", index: number) {
  return roleType === "TEACHER" ? `TEACHER_${index + 1}` : `ASSISTANT_${index + 1}`;
}

export default function ClassDefaultAssignmentManager({
  classId,
  employees,
  assignments,
}: {
  classId: string;
  employees: Employee[];
  assignments: DefaultAssignment[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialDrafts = useMemo<AssignmentDraft[]>(() => {
    const teacherDrafts = assignments
      .filter((assignment) => getRoleType(assignment.role) === "TEACHER")
      .map((assignment, index) => ({
        key: assignment.id,
        roleType: "TEACHER" as const,
        employeeId: assignment.employeeId,
        notes: assignment.notes ?? "",
        sort: index,
      }));

    const assistantDrafts = assignments
      .filter((assignment) => getRoleType(assignment.role) === "ASSISTANT")
      .map((assignment, index) => ({
        key: assignment.id,
        roleType: "ASSISTANT" as const,
        employeeId: assignment.employeeId,
        notes: assignment.notes ?? "",
        sort: index,
      }));

    return [...teacherDrafts, ...assistantDrafts].map(({ sort: _sort, ...draft }) => draft);
  }, [assignments]);

  const [drafts, setDrafts] = useState<AssignmentDraft[]>(
    initialDrafts.length > 0 ? initialDrafts : [createDraft("TEACHER"), createDraft("ASSISTANT")],
  );

  const summary = useMemo(() => {
    const teachers = assignments.filter((item) => getRoleType(item.role) === "TEACHER");
    const assistants = assignments.filter((item) => getRoleType(item.role) === "ASSISTANT");
    return { teachers, assistants };
  }, [assignments]);

  function patch(key: string, field: "employeeId" | "notes", value: string) {
    setDrafts((current) => current.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
    setError(null);
    setMessage(null);
  }

  function addDraft(roleType: "TEACHER" | "ASSISTANT") {
    setDrafts((current) => [...current, createDraft(roleType)]);
    setError(null);
    setMessage(null);
  }

  function removeDraft(key: string) {
    setDrafts((current) => {
      const next = current.filter((item) => item.key !== key);
      return next.length > 0 ? next : [createDraft("TEACHER"), createDraft("ASSISTANT")];
    });
    setError(null);
    setMessage(null);
  }

  async function save() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const teachers = drafts.filter((item) => item.roleType === "TEACHER" && item.employeeId);
    const assistants = drafts.filter((item) => item.roleType === "ASSISTANT" && item.employeeId);

    const payload = [
      ...teachers.map((item, index) => ({
        role: normalizeRole("TEACHER", index),
        employeeId: item.employeeId,
        notes: item.notes.trim() || null,
      })),
      ...assistants.map((item, index) => ({
        role: normalizeRole("ASSISTANT", index),
        employeeId: item.employeeId,
        notes: item.notes.trim() || null,
      })),
    ];

    const response = await fetch(`/api/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultAssignments: payload }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không lưu được nhân sự mặc định.");
      return;
    }

    setMessage("Đã lưu nhân sự mặc định cho lớp.");
    router.refresh();
  }

  async function applyToPlannedSessions() {
    setApplyLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/classes/${classId}/default-assignments/apply`, {
      method: "POST",
    });
    const result = await response.json().catch(() => ({}));
    setApplyLoading(false);

    if (!response.ok) {
      setError(result.error ?? "Không áp dụng được xuống các buổi đã sinh.");
      return;
    }

    setMessage(`Đã bổ sung ${result.created ?? 0} phân công mặc định vào ${result.sessionsChecked ?? 0} buổi đã sinh.`);
    router.refresh();
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-[28px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Nhân sự mặc định</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">Giáo viên & trợ giảng của lớp</h3>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost">
            Chỉnh nhân sự
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border border-hairline px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Giáo viên</p>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">{summary.teachers.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {summary.teachers.length > 0 ? (
                summary.teachers.map((item) => (
                  <div key={item.id} className="border-b border-hairline py-2 last:border-0">
                    <p className="text-sm font-medium text-ink">{item.employee.shortName || item.employee.fullName}</p>
                    {item.notes ? <p className="mt-1 text-xs text-ink-muted48">{item.notes}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-muted48">Chưa gắn giáo viên.</p>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-hairline px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Trợ giảng</p>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{summary.assistants.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {summary.assistants.length > 0 ? (
                summary.assistants.map((item) => (
                  <div key={item.id} className="border-b border-hairline py-2 last:border-0">
                    <p className="text-sm font-medium text-ink">{item.employee.shortName || item.employee.fullName}</p>
                    {item.notes ? <p className="mt-1 text-xs text-ink-muted48">{item.notes}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-muted48">Chưa gắn trợ giảng.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Nhân sự mặc định của lớp"
        description="Thêm bao nhiêu giáo viên hoặc trợ giảng tùy nhu cầu. Buổi học sinh mới sẽ tự nhận theo cấu hình này."
        widthClassName="max-w-4xl"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            {(["TEACHER", "ASSISTANT"] as const).map((roleType) => {
              const rows = drafts.filter((item) => item.roleType === roleType);
              const label = getRoleLabel(roleType);
              return (
                <div key={roleType} className="space-y-3 rounded-[24px] border border-hairline px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{label}</p>
                      <p className="mt-1 text-xs text-ink-muted48">Có thể thêm nhiều người cùng lúc.</p>
                    </div>
                    <button type="button" onClick={() => addDraft(roleType)} className="btn-ghost-sm">
                      + Thêm {label.toLowerCase()}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {rows.map((item, index) => (
                      <div key={item.key} className="grid gap-3 rounded-[20px] border border-hairline px-3 py-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                        <label className="form-group">
                          <span className="label-sm">{label} {index + 1}</span>
                          <select className="input" value={item.employeeId} onChange={(event) => patch(item.key, "employeeId", event.target.value)}>
                            <option value="">Chưa gắn</option>
                            {employees.map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.fullName} {employee.shortName ? `(${employee.shortName})` : ""} {employee.position ? `· ${employee.position}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="form-group">
                          <span className="label-sm">Ghi chú</span>
                          <input
                            className="input"
                            placeholder="Ghi chú ngắn nếu cần"
                            value={item.notes}
                            onChange={(event) => patch(item.key, "notes", event.target.value)}
                          />
                        </label>

                        <div className="flex items-end">
                          <button type="button" onClick={() => removeDraft(item.key)} className="btn-ghost-sm text-rose-600 hover:text-rose-700">
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {message ? <div className="alert-success">{message}</div> : null}
          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-hairline pt-4">
            <button type="button" onClick={save} disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu nhân sự"}
            </button>
            <button type="button" onClick={applyToPlannedSessions} disabled={applyLoading} className="btn-ghost">
              {applyLoading ? "Đang áp dụng..." : "Áp dụng cho buổi đã sinh"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}
