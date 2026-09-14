"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";

type Employee = {
  id: string;
  fullName: string;
  shortName: string;
  position: string | null;
};

// employee/notes để optional CÓ CHỦ Ý: dữ liệu vào đây tới từ 2 nguồn khác nhau —
// trang /classes/[id] truyền thẳng bản ghi Prisma, còn drawer lấy qua API summary.
// Một nguồn thiếu trường là đủ làm trắng nguyên trang; khai báo optional buộc mọi chỗ
// đọc phải có đường lui thay vì đổ vỡ.
type DefaultAssignment = {
  id: string;
  role: string;
  notes?: string | null;
  employeeId: string;
  employeeName?: string;
  employee?: {
    fullName: string;
    shortName: string | null;
  } | null;
};

function assignmentDisplayName(item: DefaultAssignment): string {
  return item.employee?.shortName || item.employee?.fullName || item.employeeName || "Nhân sự không còn trong hệ thống";
}

type StaffChange = {
  role: string;
  fromName: string | null;
  toName: string | null;
  sessionCount: number;
  keptLocked: number;
};
type StaffPlan = { changes: StaffChange[]; affectedSessions: number };

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
  onSuccess,
  bare = false,
}: {
  classId: string;
  employees: Employee[];
  assignments: DefaultAssignment[];
  onSuccess?: () => void;
  /** Truyền true khi nơi gọi (drawer) đã tự có khung viền riêng — bỏ khung/nền của
   *  hàng tiêu đề (vẫn giữ 2 khối GV/TG bên dưới vì đó là 2 danh sách khác nhau). */
  bare?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kế hoạch đổi người ở các buổi chưa dạy — hiện cho xem trước, bấm xác nhận mới lưu.
  const [pendingPlan, setPendingPlan] = useState<StaffPlan | null>(null);

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
    setPendingPlan(null);
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

  function buildPayload() {
    const teachers = drafts.filter((item) => item.roleType === "TEACHER" && item.employeeId);
    const assistants = drafts.filter((item) => item.roleType === "ASSISTANT" && item.employeeId);
    return [
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
  }

  // Lưu 2 bước: lần đầu chỉ xin kế hoạch; nếu có buổi chưa dạy bị đổi người thì hiện ra
  // cho xem trước, bấm "Xác nhận đổi" mới gửi confirm và lưu thật.
  async function save(confirm = false) {
    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/classes/${classId}/default-assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultAssignments: buildPayload(), confirm }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setPendingPlan(null);
      setError(result.error ?? "Không lưu được nhân sự mặc định.");
      return;
    }
    if (result.needsConfirm) {
      setPendingPlan(result.plan);
      return;
    }

    setPendingPlan(null);
    const affected = result.plan?.affectedSessions ?? 0;
    setMessage(
      affected > 0
        ? `Đã lưu nhân sự mặc định và cập nhật ${affected} buổi chưa dạy.`
        : "Đã lưu nhân sự mặc định cho lớp. Không có buổi chưa dạy nào cần đổi.",
    );
    router.refresh();
    onSuccess?.();
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

    const skipped: string[] = result.skippedConflicts ?? [];
    setMessage(
      `Đã bổ sung ${result.created ?? 0} phân công vào các buổi chưa dạy còn trống (đã xét ${result.sessionsChecked ?? 0} buổi).` +
        (skipped.length ? ` Bỏ qua ${skipped.length} chỗ vì trùng lịch: ${skipped.slice(0, 3).join(" ")}` : ""),
    );
    router.refresh();
    onSuccess?.();
  }

  return (
    <>
      <div className="space-y-4">
        <div
          className={
            bare
              ? "flex flex-wrap items-start justify-between gap-3"
              : "flex flex-wrap items-start justify-between gap-3 rounded-[28px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)] px-5 py-4"
          }
        >
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
                    <p className="text-sm font-medium text-ink">{assignmentDisplayName(item)}</p>
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
                    <p className="text-sm font-medium text-ink">{assignmentDisplayName(item)}</p>
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

      <ResponsiveDrawer 
        open={open}
        onClose={() => setOpen(false)}
        title="Nhân sự mặc định của lớp"
        description="Đổi người ở đây thì các buổi CHƯA DẠY (từ hôm nay) đổi theo; buổi đã dạy giữ nguyên để lương không đổi."
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

          {pendingPlan ? (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Thay đổi này sẽ cập nhật {pendingPlan.affectedSessions} buổi chưa dạy (từ hôm nay):</p>
              <ul className="space-y-1">
                {pendingPlan.changes.map((change, index) => (
                  <li key={index}>
                    • {getRoleLabel(change.role)}:{" "}
                    {change.fromName && change.toName ? (
                      <>
                        <strong>{change.fromName}</strong> → <strong>{change.toName}</strong>
                      </>
                    ) : change.toName ? (
                      <>thêm <strong>{change.toName}</strong></>
                    ) : (
                      <>bỏ <strong>{change.fromName}</strong></>
                    )}{" "}
                    — {change.sessionCount} buổi
                    {change.keptLocked > 0 ? ` (giữ nguyên ${change.keptLocked} buổi đã check-in hoặc đang có người dạy thay)` : ""}
                  </li>
                ))}
              </ul>
              <p className="text-xs">
                Buổi đã dạy, buổi của ngày đã qua và buổi đang phân công riêng người khác không bị đổi — lương các buổi đó giữ nguyên.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => save(true)} disabled={loading} className="btn-primary">
                  {loading ? "Đang lưu..." : "Xác nhận đổi"}
                </button>
                <button type="button" onClick={() => setPendingPlan(null)} disabled={loading} className="btn-ghost">
                  Quay lại sửa
                </button>
              </div>
            </div>
          ) : null}
          {message ? <div className="alert-success">{message}</div> : null}
          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="flex flex-wrap gap-3 border-t border-hairline pt-4">
            <button type="button" onClick={() => save(false)} disabled={loading || Boolean(pendingPlan)} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu nhân sự"}
            </button>
            <button type="button" onClick={applyToPlannedSessions} disabled={applyLoading} className="btn-ghost">
              {applyLoading ? "Đang bổ sung..." : "Bổ sung vào buổi còn trống"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveDrawer>
    </>
  );
}
