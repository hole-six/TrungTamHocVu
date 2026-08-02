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
  TEACHER: "Người dạy chính của buổi học",
  ASSISTANT: "Hỗ trợ lớp và học viên",
  ASSISTANT2: "Nhân sự hỗ trợ bổ sung",
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
              {editing ? "Đóng chỉnh giờ" : "Trừ/cộng giờ"}
            </button>
            <ConfirmActionButton
              title={`Xóa phân công của ${assignment.employee.fullName}?`}
              description="Thao tác này sẽ gỡ nhân sự khỏi buổi học và ảnh hưởng trực tiếp tới dữ liệu công của buổi này."
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
            Dạy thay cho <strong>{assignment.substituteFor.employee.fullName}</strong> — buổi này người đó không được tính công.
          </div>
        ) : null}

        {assignment.substitutedBy ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>
              Đã có người dạy thay: <strong>{assignment.substitutedBy.employee.fullName}</strong> — giờ công buổi này đã trừ về 0 cho{" "}
              {assignment.employee.fullName}.
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
              Chọn người dạy thay cho <strong>{assignment.employee.fullName}</strong> ở đúng buổi này. Giờ công của{" "}
              {assignment.employee.fullName} sẽ tự động trừ về 0, người dạy thay được tính công riêng.
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
            <p className="mt-1 text-sm font-semibold text-ink">{assignment.isSubstituteShift ? "Ca bổ trợ" : "Ca chuẩn"}</p>
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
    title: "Mục tiêu form này",
    items: [
      "Đây là nơi quản lý giáo viên, trợ giảng và ca dạy thay của một buổi học cụ thể.",
      "Form này giúp đối chiếu ai thực sự tham gia buổi học và công giờ của từng người.",
      "Mỗi assignment ở đây gắn trực tiếp với dữ liệu chấm công và payroll theo session.",
    ],
    tone: "info" as const,
  },
  {
    title: "Cách thao tác nhanh",
    items: [
      "Nếu chỉ phân công bình thường, thêm đúng giáo viên hoặc trợ giảng theo vai trò của họ.",
      "Nếu có người dạy thay, dùng nút nhờ dạy thay để hệ thống chuyển công đúng cho người thay thế.",
      "Nếu cần chỉnh công của riêng buổi này, dùng khu trừ hoặc cộng giờ thay vì sửa tay ở payroll.",
    ],
    tone: "success" as const,
  },
  {
    title: "Lưu ý vận hành",
    items: [
      "Xóa assignment sẽ ảnh hưởng đến lịch sử tham gia buổi và số công của nhân sự đó.",
      "Dạy thay không chỉ là ghi chú, mà là thay đổi người được tính công cho buổi học.",
      "Check-in và check-out nên được bấm theo thực tế để dữ liệu nhân sự và vận hành khớp nhau.",
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
        title="Guide phân công buổi học"
        summary="Giải thích cách gán GV/TG, xử lý dạy thay và chỉnh công giờ của riêng buổi học này."
        sections={SESSION_ASSIGNMENT_GUIDE_SECTIONS}
        position="inline"
        buttonLabel="Guide phân công"
      />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Bước 2</p>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">Ai phụ trách buổi học này?</h2>
        <p className="mt-1 text-sm text-ink-muted48">Khối này dùng để xác nhận giáo viên/trợ giảng thực tế và điều chỉnh giờ công nếu cần.</p>
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
            Chưa có nhân sự nào được gán cho buổi học này.
          </div>
        ) : null}
      </div>

      <form onSubmit={assign} className="grid gap-3 border-t border-hairline pt-4">
        <div className="grid gap-3">
          <label className="form-group">
            <span className="label-sm">Chọn nhân sự</span>
            <select className="input min-w-0" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Chọn nhân viên đứng lớp</option>
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
              <option value="ASSISTANT2">Trợ giảng bổ sung</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-muted48">Sau khi phân công, nhân sự sẽ được tính vào buổi học và bảng công.</p>
          <button type="submit" disabled={loading || !employeeId} className="btn-primary">
            {loading ? "Đang thêm..." : "Phân công"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
