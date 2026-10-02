"use client";

// CHỈNH NHANH NGAY TRÊN DANH SÁCH THỜI KHOÁ BIỂU.
//
// Xếp lịch là việc làm hàng loạt: nhìn danh sách cả tuần, thấy chỗ nào thiếu phòng/GV/TG
// thì điền luôn tại dòng đó. Trước đây phải mở từng buổi ra mới sửa được, nên một tuần
// thiếu chục chỗ là mười lần mở–đóng. Các ô dưới đây dùng đúng những API mà màn chi tiết
// buổi học đang dùng, nên mọi luật (trùng giờ 2 lớp thì hỏi, 3 lớp thì chặn; người đã
// nghỉ việc; buổi đã hủy) vẫn giữ nguyên — chỉ khác chỗ bấm.
//
// SỐ GV/TG MỖI BUỔI KHÔNG CỐ ĐỊNH (chốt 9/2026): có buổi 2 giáo viên, có buổi 3 trợ
// giảng. Vì vậy không có "ô GV / ô TG1 / ô TG2" cố định — mỗi nhóm là một danh sách,
// thêm bớt bao nhiêu người cũng được.

import { useRouter } from "next/navigation";
import { filterTeachingStaff } from "@/lib/assignment-roles";
import { useEffect, useRef, useState } from "react";

export type QuickEmployee = { id: string; fullName: string; shortName: string | null; position: string | null };

/** Chặn click lọt xuống dòng (dòng có hành vi mở buổi học). */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

function useRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

/* ------------------------------------------------------------------ PHÒNG */

export function QuickRoomCell({
  sessionId,
  room,
  roomOptions,
  canEdit,
}: {
  sessionId: string;
  room: string | null;
  roomOptions: string[];
  canEdit: boolean;
}) {
  const refresh = useRefresh();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(room ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(room ?? "");
  }, [room]);
  useEffect(() => {
    if (!editing) return;
    // Bôi sẵn nội dung cũ: đổi phòng là gõ đè, không phải gõ thêm vào sau.
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  async function save() {
    const next = value.trim();
    if (next === (room ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);

    const send = (allowSharedRoom: boolean) =>
      fetch(`/api/sessions/${sessionId}/room`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: next, allowSharedRoom }),
      });

    let res = await send(false);
    let data = await res.json().catch(() => ({}));
    // Phòng đang có lớp khác cùng giờ: hỏi lại chứ không chặn (vẫn có lúc ghép lớp thật).
    if (!res.ok && data?.code === "ROOM_BUSY") {
      if (typeof window !== "undefined" && window.confirm(data.error)) {
        res = await send(true);
        data = await res.json().catch(() => ({}));
      } else {
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Không đổi được phòng.");
      return;
    }
    setEditing(false);
    refresh();
  }

  if (!canEdit) {
    return <span className={room ? "text-ink" : "font-semibold text-amber-600"}>{room || "Chưa gán phòng"}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(event) => {
          stop(event);
          setEditing(true);
        }}
        title="Bấm để gán phòng"
        className={`-mx-2 rounded-lg px-2 py-1 text-left transition hover:bg-[#eef4fb] ${
          room ? "text-ink" : "font-semibold text-amber-600 hover:text-amber-700"
        }`}
      >
        {room || "Chưa gán phòng"}
      </button>
    );
  }

  return (
    <div onClick={stop} className="space-y-1">
      <input
        ref={inputRef}
        list={`phong-${sessionId}`}
        value={value}
        disabled={saving}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          }
          if (event.key === "Escape") {
            setValue(room ?? "");
            setEditing(false);
          }
        }}
        placeholder="VD: 301"
        className="w-28 rounded-lg border border-[#c7d7ea] px-2 py-1 text-sm outline-none focus:border-[#1d4ed8]"
      />
      <datalist id={`phong-${sessionId}`}>
        {roomOptions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------- GIÁO VIÊN / TG */

export type QuickAssignment = { id: string; role: string; employeeId: string; name: string };

/**
 * Chỉ người đứng lớp (Giáo viên / Trợ giảng) mới hiện ra — kế toán, lễ tân, BGĐ không
 * xếp vào buổi học được. Trong số đó, người hợp đúng vai trò đang chọn đứng trước.
 */
function sortForRole(employees: QuickEmployee[], roleType: "TEACHER" | "ASSISTANT") {
  const pool = filterTeachingStaff(employees);
  const wanted = roleType === "TEACHER" ? "giáo viên" : "trợ giảng";
  const fits = (employee: QuickEmployee) => (employee.position ?? "").toLowerCase().includes(wanted);
  return [...pool.filter(fits), ...pool.filter((employee) => !fits(employee))];
}

/**
 * Một nhóm vai trò (GV hoặc TG) của một buổi — SỐ NGƯỜI KHÔNG CỐ ĐỊNH.
 *
 * Mỗi người một dòng: bấm tên để đổi người, bấm × để bỏ, bấm "+ Thêm" để xếp thêm người
 * nữa. Vai trò ghi trên buổi luôn là TEACHER hoặc ASSISTANT — nhiều người CÙNG vai trò
 * là hợp lệ vì khóa duy nhất của phân công là (buổi + người + vai trò).
 */
export function QuickStaffGroup({
  sessionId,
  roleType,
  label,
  assignments,
  employees,
  canEdit,
  locked,
}: {
  sessionId: string;
  roleType: "TEACHER" | "ASSISTANT";
  label: string;
  assignments: QuickAssignment[];
  employees: QuickEmployee[];
  canEdit: boolean;
  /** Buổi đã hủy/đã dời — API không cho phân công nữa, nên không mở ô chọn. */
  locked: boolean;
}) {
  const refresh = useRefresh();
  // null = không sửa gì; "add" = đang chọn người mới; còn lại = id phân công đang đổi.
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emptyLabel = roleType === "TEACHER" ? "Chưa có giáo viên" : "Chưa có trợ giảng";
  const fullLabel = roleType === "TEACHER" ? "giáo viên" : "trợ giảng";
  const taken = new Set(assignments.map((item) => item.employeeId));

  async function removeAssignment(assignmentId: string) {
    const res = await fetch(`/api/session-assignments/${assignmentId}`, { method: "DELETE" });
    if (res.ok) return true;
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Không bỏ được phân công.");
    return false;
  }

  async function submit(employeeId: string, replacingId: string | null) {
    if (!employeeId) return;
    setBusy(true);
    setError(null);

    // Đổi người = bỏ người cũ rồi gán người mới (API không có "đổi tại chỗ").
    if (replacingId && !(await removeAssignment(replacingId))) {
      setBusy(false);
      return;
    }

    const post = (allowOverlap: boolean) =>
      fetch(`/api/sessions/${sessionId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, role: roleType, allowOverlap }),
      });

    // Trùng khung giờ: lớp thứ 2 hỏi lại, lớp thứ 3 server chặn hẳn — đúng luật đang
    // dùng ở màn chi tiết buổi học (lib/server/staff-schedule.ts).
    let res = await post(false);
    let data = await res.json().catch(() => ({}));
    if (!res.ok && data?.code === "OVERLAP_CONFIRM") {
      if (typeof window !== "undefined" && window.confirm(data.error)) {
        res = await post(true);
        data = await res.json().catch(() => ({}));
      } else {
        setBusy(false);
        setEditing(null);
        refresh();
        return;
      }
    }
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Không phân công được.");
      return;
    }
    setEditing(null);
    refresh();
  }

  function picker(replacingId: string | null) {
    const replacingEmployeeId = assignments.find((item) => item.id === replacingId)?.employeeId ?? null;
    return (
      <select
        autoFocus
        disabled={busy}
        defaultValue=""
        onChange={(event) => void submit(event.target.value, replacingId)}
        onBlur={() => setEditing(null)}
        className="rounded-lg border border-[#c7d7ea] px-2 py-1 text-sm outline-none focus:border-[#1d4ed8]"
      >
        <option value="">{busy ? "Đang lưu…" : "— Chọn người —"}</option>
        {sortForRole(employees, roleType)
          // Người đã có trong nhóm này rồi thì không hiện lại (trừ chính người đang đổi).
          .filter((employee) => !taken.has(employee.id) || employee.id === replacingEmployeeId)
          .map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.shortName || employee.fullName}
              {employee.position ? ` · ${employee.position}` : ""}
            </option>
          ))}
      </select>
    );
  }

  // Chỉ xem: liệt kê đủ người, đánh số khi có từ 2 người trở lên.
  if (!canEdit || locked) {
    return (
      <div>
        {assignments.length > 0 ? (
          assignments.map((item, index) => (
            <p key={item.id}>
              <span className="font-semibold text-ink">
                {label}
                {assignments.length > 1 ? ` ${index + 1}` : ""}:
              </span>{" "}
              {item.name}
            </p>
          ))
        ) : (
          <p>
            <span className="font-semibold text-ink">{label}:</span>{" "}
            <span className="font-semibold text-amber-600">{emptyLabel}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div onClick={stop}>
      {assignments.map((item, index) => (
        <p key={item.id} className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-ink">
            {label}
            {assignments.length > 1 ? ` ${index + 1}` : ""}:
          </span>
          {editing === item.id ? (
            picker(item.id)
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(item.id)}
                title="Bấm để đổi người"
                className="-mx-1 rounded-lg px-1.5 py-0.5 text-ink-muted80 transition hover:bg-[#eef4fb] hover:text-[#1d4ed8]"
              >
                {item.name}
              </button>
              <button
                type="button"
                onClick={() => void removeAssignment(item.id).then((ok) => ok && refresh())}
                disabled={busy}
                title="Bỏ phân công"
                className="rounded-full px-1 text-xs font-bold text-[#b6c2d2] transition hover:bg-rose-50 hover:text-rose-600"
              >
                ×
              </button>
            </>
          )}
          {index === assignments.length - 1 && editing !== "add" ? (
            <button
              type="button"
              onClick={() => setEditing("add")}
              title={`Xếp thêm ${fullLabel} vào buổi này`}
              className="ml-1 rounded-lg px-1.5 py-0.5 text-xs font-bold text-[#7c8ca1] transition hover:bg-[#eef4fb] hover:text-[#1d4ed8]"
            >
              + Thêm {label}
            </button>
          ) : null}
        </p>
      ))}

      {/* Chưa có ai: giữ nguyên chữ cam cảnh báo, bấm vào là chọn người luôn.
          Đã có người: vẫn còn "+ Thêm" vì số GV/TG một buổi không cố định. */}
      {assignments.length === 0 ? (
        <p className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-ink">{label}:</span>
          {editing === "add" ? (
            picker(null)
          ) : (
            <button
              type="button"
              onClick={() => setEditing("add")}
              title={`Bấm để xếp ${fullLabel}`}
              className="-mx-1 rounded-lg px-1.5 py-0.5 font-semibold text-amber-600 transition hover:bg-[#eef4fb] hover:text-amber-700"
            >
              {emptyLabel}
            </button>
          )}
        </p>
      ) : editing === "add" ? (
        <p className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-ink">{label}:</span>
          {picker(null)}
        </p>
      ) : null}

      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}
