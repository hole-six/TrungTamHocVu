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

const ROLE_CONFIG = [
  { role: "TEACHER", label: "Giáo viên chính", helper: "Người dạy mặc định của lớp" },
  { role: "ASSISTANT", label: "Trợ giảng chính", helper: "Người hỗ trợ mặc định của lớp" },
  { role: "ASSISTANT2", label: "Trợ giảng bổ sung", helper: "Người hỗ trợ thêm khi lớp cần 2 TG" },
] as const;

type FormState = Record<string, { employeeId: string; notes: string }>;

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

  const initialState = useMemo<FormState>(
    () =>
      Object.fromEntries(
        ROLE_CONFIG.map((item) => {
          const current = assignments.find((assignment) => assignment.role === item.role);
          return [item.role, { employeeId: current?.employeeId ?? "", notes: current?.notes ?? "" }];
        }),
      ),
    [assignments],
  );

  const [form, setForm] = useState<FormState>(initialState);

  function patch(role: string, key: "employeeId" | "notes", value: string) {
    setForm((current) => ({ ...current, [role]: { ...current[role], [key]: value } }));
    setError(null);
    setMessage(null);
  }

  async function save() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const payload = ROLE_CONFIG.map((item) => ({
      role: item.role,
      employeeId: form[item.role]?.employeeId || null,
      notes: form[item.role]?.notes?.trim() || null,
    })).filter((item) => item.employeeId);

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

  const summary = ROLE_CONFIG.map((item) => {
    const current = assignments.find((assignment) => assignment.role === item.role);
    return {
      ...item,
      display: current ? current.employee.shortName || current.employee.fullName : "Chưa gắn",
    };
  });

  return (
    <>
      <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Nhân sự mặc định của lớp</p>
            <p className="mt-2 text-sm text-ink-muted80">Lớp nên có GV/TG chính cố định. Chỉ đổi riêng từng buổi khi bận, dạy thay hoặc học bù.</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost">
            Gắn GV/TG mặc định
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {summary.map((item) => (
            <div key={item.role} className="rounded-2xl bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted48">{item.label}</p>
              <p className="mt-2 text-sm font-semibold text-ink">{item.display}</p>
              <p className="mt-1 text-xs text-ink-muted48">{item.helper}</p>
            </div>
          ))}
        </div>
      </div>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Nhân sự mặc định của lớp"
        description="Gắn giáo viên và trợ giảng mặc định cho cả lớp. Các buổi sinh mới sẽ tự nhận theo cấu hình này, chỉ sửa riêng khi có đổi ca hoặc dạy bù."
        widthClassName="max-w-3xl"
      >
        <div className="space-y-5">
          <div className="grid gap-4">
            {ROLE_CONFIG.map((item) => (
              <div key={item.role} className="rounded-[24px] border border-[#dbe7ff] bg-[#f9fcff] p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted48">{item.helper}</p>
                  </div>
                  <div className="grid gap-3">
                    <label className="form-group">
                      <span className="label-sm">Nhân sự mặc định</span>
                      <select className="input" value={form[item.role]?.employeeId ?? ""} onChange={(event) => patch(item.role, "employeeId", event.target.value)}>
                        <option value="">Chưa gắn</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.fullName} {employee.shortName ? `(${employee.shortName})` : ""} {employee.position ? `· ${employee.position}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-group">
                      <span className="label-sm">Ghi chú vận hành</span>
                      <textarea
                        className="input min-h-[92px]"
                        placeholder="Ví dụ: GV chính của lớp này, chỉ đổi khi báo bận trước..."
                        value={form[item.role]?.notes ?? ""}
                        onChange={(event) => patch(item.role, "notes", event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {message ? <div className="alert-success">{message}</div> : null}
          {error ? <div className="alert-danger">{error}</div> : null}

          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Sau khi lưu, các buổi sinh mới sẽ tự gắn theo mặc định. Nếu lớp đã có buổi nhưng còn trống phân công, bấm nút áp dụng bên dưới để đổ nhanh xuống các buổi đó.
          </div>

          <div className="flex flex-wrap gap-3 border-t border-[#e6eefc] pt-4">
            <button type="button" onClick={save} disabled={loading} className="btn-primary">
              {loading ? "Đang lưu..." : "Lưu nhân sự mặc định"}
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
