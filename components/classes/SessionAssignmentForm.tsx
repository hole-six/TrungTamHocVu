"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormGuide from "@/components/ui/FormGuide";
import ConfirmActionButton from "@/components/ui/ConfirmActionButton";

type Employee = { id: string; fullName: string; shortName: string };
type Assignment = {
  id: string;
  employeeId: string;
  role: string;
  hours: number | null;
  amount: number | null;
  deductedHours: number;
  addedHours: number;
  adjustmentNote: string | null;
  isSubstituteShift: boolean;
  checkInAt: string | Date | null;
  checkOutAt: string | Date | null;
  employee: { fullName: string };
  substituteFor: { id: string; employee: { fullName: string } } | null;
  substitutedBy: { id: string; employee: { fullName: string } } | null;
};

function formatTime(value: string | Date | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

const ROLE_LABEL: Record<string, string> = {
  TEACHER: "Giáo viên",
  ASSISTANT: "Trợ giảng",
  ASSISTANT2: "Trợ giảng 2",
};

const ROLE_HINT: Record<string, string> = {
  TEACHER: "Dạy chính",
  ASSISTANT: "Hỗ trợ lớp",
  ASSISTANT2: "Hỗ trợ thêm",
};

function AssignmentRow({ assignment, isSelf, employees }: { assignment: Assignment; isSelf: boolean; employees: Employee[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deductedHours, setDeductedHours] = useState(String(assignment.deductedHours ?? 0));
  const [addedHours, setAddedHours] = useState(String(assignment.addedHours ?? 0));
  const [note, setNote] = useState(assignment.adjustmentNote ?? "");
  const [isSubstituteShift, setIsSubstituteShift] = useState(assignment.isSubstituteShift);
  const [loading, setLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [subEmployeeId, setSubEmployeeId] = useState("");
  const [subReason, setSubReason] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  async function remove() {
    await fetch(`/api/session-assignments/${assignment.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function arrangeSubstitute(event: React.FormEvent) {
    event.preventDefault();
    if (!subEmployeeId) return;
    setSubLoading(true);
    setSubError(null);

    const res = await fetch(`/api/session-assignments/${assignment.id}/substitute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: subEmployeeId, reason: subReason }),
    });
    const data = await res.json().catch(() => ({}));
    setSubLoading(false);

    if (!res.ok) {
      setSubError(data.error ?? "Không thể sắp xếp người dạy thay.");
      return;
    }

    setSubOpen(false);
    setSubEmployeeId("");
    setSubReason("");
    router.refresh();
  }

  async function cancelSubstitute(substituteAssignmentId: string) {
    await fetch(`/api/session-assignments/${substituteAssignmentId}`, { method: "DELETE" });
    router.refresh();
  }

  async function checkIn() {
    setCheckLoading(true);
    setCheckError(null);
    const res = await fetch(`/api/session-assignments/${assignment.id}/check-in`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setCheckLoading(false);
    if (!res.ok) {
      setCheckError(data.error ?? "Không thể check-in.");
      return;
    }
    router.refresh();
  }

  async function checkOut() {
    setCheckLoading(true);
    setCheckError(null);
    const res = await fetch(`/api/session-assignments/${assignment.id}/check-out`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setCheckLoading(false);
    if (!res.ok) {
      setCheckError(data.error ?? "Không thể check-out.");
      return;
    }
    router.refresh();
  }

  async function saveAdjustment(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    await fetch(`/api/session-assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deductedHours: Number(deductedHours),
        addedHours: Number(addedHours),
        adjustmentNote: note,
        isSubstituteShift,
      }),
    });

    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-[26px] border border-hairline bg-white/90 p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-ink">{assignment.employee.fullName}</p>
            <p className="mt-1 text-sm text-ink-muted80">
              {ROLE_LABEL[assignment.role] ?? assignment.role} · {ROLE_HINT[assignment.role] ?? "Nhân sự tham gia buổi học"}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {!assignment.substitutedBy ? (
              <button type="button" onClick={() => setSubOpen((current) => !current)} className="status-action text-amber-700 hover:text-amber-700">
                {subOpen ? "Đóng" : "Nhờ dạy thay"}
              </button>
            ) : null}
            <button type="button" onClick={() => setEditing((current) => !current)} className="status-action">
              {editing ? "Đóng" : "Chỉnh công"}
            </button>
            <ConfirmActionButton
              title={`Xóa phân công của ${assignment.employee.fullName}?`}
              description="Thao tác này sẽ gỡ nhân sự khỏi buổi học và ảnh hưởng tới công của buổi này."
              confirmLabel="Xác nhận xóa"
              cancelLabel="Quay lại"
              tone="danger"
              onConfirm={remove}
              className="status-action text-red-600 hover:text-red-600"
            >
              Xóa
            </ConfirmActionButton>
          </div>
        </div>

        {assignment.substituteFor ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Dạy thay cho <strong>{assignment.substituteFor.employee.fullName}</strong>.
          </div>
        ) : null}

        {assignment.substitutedBy ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>
              Đã có người dạy thay: <strong>{assignment.substitutedBy.employee.fullName}</strong>.
            </span>
            <ConfirmActionButton
              title="Hủy sắp xếp dạy thay?"
              description="Hệ thống sẽ trả giờ công buổi này về lại cho người phụ trách gốc."
              confirmLabel="Hủy dạy thay"
              cancelLabel="Quay lại"
              tone="default"
              onConfirm={() => cancelSubstitute(assignment.substitutedBy!.id)}
              className="font-semibold text-amber-800 hover:underline"
            >
              Hủy dạy thay
            </ConfirmActionButton>
          </div>
        ) : null}

        {subOpen ? (
          <form onSubmit={arrangeSubstitute} className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-xs text-amber-800">
              Chọn người dạy thay cho <strong>{assignment.employee.fullName}</strong>. Công của người dạy thay sẽ được tính riêng.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-group">
                <span className="label-sm">Người dạy thay</span>
                <select className="input" value={subEmployeeId} onChange={(event) => setSubEmployeeId(event.target.value)}>
                  <option value="">Chọn nhân sự</option>
                  {employees
                    .filter((employee) => employee.id !== assignment.employeeId)
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} ({employee.shortName})
                      </option>
                    ))}
                </select>
              </label>
              <label className="form-group">
                <span className="label-sm">Lý do</span>
                <input className="input" placeholder="VD: GV nghỉ đột xuất..." value={subReason} onChange={(event) => setSubReason(event.target.value)} />
              </label>
            </div>
            {subError ? <p className="text-xs text-red-600">{subError}</p> : null}
            <div className="flex justify-end">
              <button type="submit" disabled={subLoading || !subEmployeeId} className="btn-primary">
                {subLoading ? "Đang lưu..." : "Xác nhận dạy thay"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#f8fbff] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Giờ công</p>
            <p className="mt-1 text-sm font-semibold text-ink">{assignment.hours ?? 0}h</p>
          </div>
          <div className="rounded-2xl bg-[#f8fbff] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Tiền công</p>
            <p className="mt-1 text-sm font-semibold text-ink">{(assignment.amount ?? 0).toLocaleString("vi-VN")}đ</p>
          </div>
          <div className="rounded-2xl bg-[#f8fbff] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">Loại ca</p>
            <p className="mt-1 text-sm font-semibold text-ink">{assignment.isSubstituteShift ? "Dạy thay" : "Ca chuẩn"}</p>
          </div>
        </div>

        {!assignment.substitutedBy ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e8eef6] bg-[#fbfdff] px-3 py-2.5">
              <div className="text-sm text-ink-muted80">
                {assignment.checkInAt ? (
                  <span className="font-medium text-emerald-700">Check-in lúc {formatTime(assignment.checkInAt)}</span>
                ) : (
                  <span className="text-ink-muted48">Chưa check-in</span>
                )}
                {assignment.checkOutAt ? (
                  <span className="ml-2 font-medium text-sky-700">· Check-out lúc {formatTime(assignment.checkOutAt)}</span>
                ) : assignment.checkInAt ? (
                  <span className="ml-2 text-ink-muted48">· Chưa check-out</span>
                ) : null}
              </div>
              {isSelf ? (
                <div className="flex items-center gap-2">
                  {!assignment.checkInAt ? (
                    <button type="button" onClick={checkIn} disabled={checkLoading} className="btn-primary px-3 py-1.5 text-xs">
                      {checkLoading ? "..." : "Check in"}
                    </button>
                  ) : !assignment.checkOutAt ? (
                    <button type="button" onClick={checkOut} disabled={checkLoading} className="btn-ghost px-3 py-1.5 text-xs">
                      {checkLoading ? "..." : "Check out"}
                    </button>
                  ) : (
                    <span className="text-xs text-ink-muted48">Đã hoàn tất buổi này</span>
                  )}
                </div>
              ) : null}
            </div>
            {checkError ? <p className="text-xs text-red-600">{checkError}</p> : null}
          </>
        ) : null}

        {(assignment.deductedHours > 0 || assignment.addedHours > 0 || assignment.adjustmentNote) && !editing ? (
          <div className="rounded-2xl border border-[#e8eef6] bg-[#fbfdff] px-3 py-2 text-sm text-ink-muted80">
            {assignment.deductedHours > 0 ? <>Trừ {assignment.deductedHours}h. </> : null}
            {assignment.addedHours > 0 ? <>Cộng {assignment.addedHours}h. </> : null}
            {assignment.adjustmentNote ? <>Lý do: {assignment.adjustmentNote}</> : null}
          </div>
        ) : null}

        {editing ? (
          <form onSubmit={saveAdjustment} className="grid gap-3 border-t border-hairline pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-group">
                <span className="label-sm">Trừ giờ</span>
                <input type="number" step="0.25" min="0" className="input" value={deductedHours} onChange={(event) => setDeductedHours(event.target.value)} />
              </label>
              <label className="form-group">
                <span className="label-sm">Cộng giờ</span>
                <input type="number" step="0.25" min="0" className="input" value={addedHours} onChange={(event) => setAddedHours(event.target.value)} />
              </label>
            </div>

            <label className="form-group">
              <span className="label-sm">Lý do điều chỉnh</span>
              <input className="input" placeholder="VD: đến muộn, dạy bù, hỗ trợ thêm..." value={note} onChange={(event) => setNote(event.target.value)} />
            </label>

            <label className="flex items-center gap-2 text-sm text-ink-muted80">
              <input type="checkbox" checked={isSubstituteShift} onChange={(event) => setIsSubstituteShift(event.target.checked)} />
              Đánh dấu là ca bổ trợ
            </label>

            <div className="flex justify-end">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Đang lưu..." : "Lưu điều chỉnh"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

const SESSION_ASSIGNMENT_GUIDE_SECTIONS = [
  {
    title: "Form này để làm gì",
    items: [
      "Quản lý giáo viên, trợ giảng và người dạy thay của buổi học.",
      "Đối chiếu ai thực sự tham gia và công giờ của từng người.",
      "Dữ liệu này đi sang bảng công và lương.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách làm nhanh",
    items: [
      "Phân công bình thường thì chọn đúng người và đúng vai trò.",
      "Có dạy thay thì dùng nút Nhờ dạy thay.",
      "Cần chỉnh công riêng buổi này thì dùng Chỉnh công.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý",
    items: [
      "Xóa phân công sẽ ảnh hưởng tới công của nhân sự.",
      "Dạy thay sẽ đổi người được tính công.",
      "Check-in và check-out nên bấm đúng thực tế.",
    ],
    tone: "warning" as const,
  },
];

export default function SessionAssignmentForm({
  sessionId,
  employees,
  assignments,
  currentEmployeeId,
}: {
  sessionId: string;
  employees: Employee[];
  assignments: Assignment[];
  currentEmployeeId?: string | null;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!employeeId) return;

    setLoading(true);
    setError(null);

    const response = await fetch(`/api/sessions/${sessionId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, role }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Không thể phân công.");
      return;
    }

    setEmployeeId("");
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <FormGuide
        title="Hướng dẫn phân công"
        summary="Cách gán GV/TG, xử lý dạy thay và chỉnh công của buổi này."
        sections={SESSION_ASSIGNMENT_GUIDE_SECTIONS}
        position="inline"
        buttonLabel="Guide"
      />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Bước 2</p>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">Phân công buổi học</h2>
        <p className="mt-1 text-sm text-ink-muted48">Chọn giáo viên, trợ giảng, người dạy thay và công giờ.</p>
      </div>

      <div className="space-y-3">
        {assignments.map((assignment) => (
          <AssignmentRow
            key={assignment.id}
            assignment={assignment}
            isSelf={Boolean(currentEmployeeId) && assignment.employeeId === currentEmployeeId}
            employees={employees}
          />
        ))}
        {assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8e5f4] px-4 py-5 text-sm text-ink-muted48">
            Chưa có nhân sự được gán cho buổi này.
          </div>
        ) : null}
      </div>

      <form onSubmit={assign} className="grid gap-3 border-t border-hairline pt-4">
        <div className="grid gap-3">
          <label className="form-group">
            <span className="label-sm">Chọn nhân sự</span>
            <select className="input min-w-0" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Chọn nhân sự</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} ({employee.shortName})
                </option>
              ))}
            </select>
          </label>

          <label className="form-group">
            <span className="label-sm">Vai trò trong buổi này</span>
            <select className="input" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="TEACHER">Giáo viên chính</option>
              <option value="ASSISTANT">Trợ giảng</option>
              <option value="ASSISTANT2">Trợ giảng 2</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-muted48">Sau khi phân công, nhân sự sẽ được tính vào bảng công.</p>
          <button type="submit" disabled={loading || !employeeId} className="btn-primary">
            {loading ? "Đang thêm..." : "Phân công"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
