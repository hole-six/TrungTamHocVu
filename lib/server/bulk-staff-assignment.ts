import type { Prisma, PrismaClient } from "@prisma/client";
import { buildAssignmentPay } from "@/lib/server/class-default-assignments";
import { findStaffConflicts, formatDayVn, timeRangesOverlap } from "@/lib/server/staff-schedule";
import { canEditPayroll } from "@/lib/server/payroll-rules";
import { isEmployeeWorkingOn } from "@/lib/assignment-roles";

// PHÂN CÔNG HÀNG LOẠT từ lịch tổng: gán 1 giáo viên và/hoặc 1 trợ giảng cho nhiều buổi đã
// chọn cùng lúc. Dùng đúng các quy tắc của phân công từng buổi (vai trò, đơn giá chốt, trùng
// lịch, nghỉ việc) để trong lớp và ngoài lịch luôn khớp nhau.
//
// Luôn 2 bước: lập KẾ HOẠCH cho từng buổi (gán mới / thay người / giữ nguyên / bỏ qua kèm
// lý do) → người dùng xem → xác nhận thì lập lại kế hoạch trong giao dịch rồi mới ghi.
//
// Hai cách gán:
//   FILL_EMPTY — chỉ điền buổi còn trống vai trò đó (an toàn, mặc định);
//   REPLACE    — thay người đang gán ở vai trò đó.
// Không bao giờ đụng: buổi đã hủy/đã dời; người đã check-in hoặc đang dính dạy thay; buổi đã
// dạy mà đã có người (lương đã tính theo người đó). Buổi đã dạy còn trống thì được bổ sung,
// trừ khi tháng lương đó đã chốt.

type Db = PrismaClient | Prisma.TransactionClient;

export type BulkMode = "FILL_EMPTY" | "REPLACE";
export type BulkRole = "TEACHER" | "ASSISTANT";
export type BulkAction = "ASSIGN" | "REPLACE" | "KEEP" | "SKIP";

export type BulkPlanItem = {
  sessionId: string;
  classId: string;
  classCode: string;
  className: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  role: BulkRole;
  employeeName: string;
  action: BulkAction;
  replacedNames: string[];
  reason: string | null;
};

export type BulkPlan = {
  items: BulkPlanItem[];
  counts: Record<BulkAction, number>;
};

type InternalItem = BulkPlanItem & {
  employeeId: string;
  deleteIds: string[];
  pay: ReturnType<typeof buildAssignmentPay> | null;
};

export async function planBulkAssignment(
  db: Db,
  input: { sessionIds: string[]; teacherId?: string | null; assistantId?: string | null; mode: BulkMode },
): Promise<BulkPlan & { internal: InternalItem[] }> {
  const requests: Array<{ role: BulkRole; employeeId: string }> = [];
  if (input.teacherId) requests.push({ role: "TEACHER", employeeId: input.teacherId });
  if (input.assistantId) requests.push({ role: "ASSISTANT", employeeId: input.assistantId });

  const [sessions, employees] = await Promise.all([
    db.classSession.findMany({
      where: { id: { in: input.sessionIds } },
      include: {
        class: { select: { id: true, classCode: true, className: true, branchId: true } },
        assignments: { include: { employee: { select: { fullName: true } }, substitutedBy: { select: { id: true } } } },
      },
      // Thứ tự cố định (ngày, giờ, mã lớp): 2 buổi cùng chọn trùng giờ thì buổi đứng trước
      // được gán, buổi sau bị bỏ qua — xem trước và lúc xác nhận luôn ra cùng một kết quả.
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }, { class: { classCode: "asc" } }],
    }),
    db.employee.findMany({ where: { id: { in: requests.map((r) => r.employeeId) } } }),
  ]);
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  // Tháng lương đã chốt của từng cơ sở — không bổ sung người vào buổi đã dạy của tháng đó.
  const periodKeys = [...new Set(sessions.map((s) => `${s.class.branchId}|${s.sessionDate.toISOString().slice(0, 7)}`))];
  const runs = periodKeys.length
    ? await db.payrollRun.findMany({
        where: { OR: periodKeys.map((key) => ({ branchId: key.split("|")[0], periodName: key.split("|")[1] })) },
        select: { branchId: true, periodName: true, status: true },
      })
    : [];
  const lockedPeriods = new Set(runs.filter((r) => !canEditPayroll(r.status)).map((r) => `${r.branchId}|${r.periodName}`));

  const internal: InternalItem[] = [];
  for (const request of requests) {
    const employee = employeeById.get(request.employeeId);
    if (!employee) continue;
    // Buổi đã xếp người này trong CHÍNH lần gán này — để bắt trùng giữa các buổi cùng chọn.
    const takenInBatch: Array<{ sessionDate: Date; startTime: string | null; endTime: string | null; classCode: string }> = [];

    for (const session of sessions) {
      const base: InternalItem = {
        sessionId: session.id,
        classId: session.class.id,
        classCode: session.class.classCode,
        className: session.class.className,
        sessionDate: session.sessionDate.toISOString(),
        startTime: session.startTime,
        endTime: session.endTime,
        role: request.role,
        employeeName: employee.fullName,
        employeeId: employee.id,
        action: "SKIP",
        replacedNames: [],
        reason: null,
        deleteIds: [],
        pay: null,
      };
      const skip = (reason: string) => internal.push({ ...base, action: "SKIP", reason });
      const keep = (reason: string) => internal.push({ ...base, action: "KEEP", reason });

      if (session.status === "CANCELLED" || session.status === "RESCHEDULED") {
        skip(session.status === "CANCELLED" ? "Buổi đã hủy." : "Buổi đã dời sang ngày khác.");
        continue;
      }
      if (!isEmployeeWorkingOn(employee, session.sessionDate)) {
        skip(`${employee.fullName} đã nghỉ việc vào ngày này.`);
        continue;
      }

      const sameRole = session.assignments.filter((a) => a.role === request.role);
      const otherRole = session.assignments.find((a) => a.employeeId === employee.id && a.role !== request.role);
      if (otherRole) {
        skip(`${employee.fullName} đang giữ vai trò khác trong buổi này.`);
        continue;
      }
      const already = sameRole.find((a) => a.employeeId === employee.id);
      const others = sameRole.filter((a) => a.employeeId !== employee.id);

      if (already && (input.mode === "FILL_EMPTY" || others.length === 0)) {
        keep("Đã đúng người.");
        continue;
      }

      const isTaught = session.status === "COMPLETED";
      if (isTaught && sameRole.length > 0) {
        keep(`Buổi đã dạy — giữ ${sameRole.map((a) => a.employee.fullName).join(", ")} (lương đã tính theo người dạy).`);
        continue;
      }
      if (isTaught && lockedPeriods.has(`${session.class.branchId}|${session.sessionDate.toISOString().slice(0, 7)}`)) {
        skip("Buổi đã dạy thuộc tháng lương đã chốt.");
        continue;
      }
      if (input.mode === "FILL_EMPTY" && sameRole.length > 0) {
        keep(`Đã có ${sameRole.map((a) => a.employee.fullName).join(", ")}.`);
        continue;
      }
      const locked = others.filter((a) => a.checkInAt || a.substituteForId || a.substitutedBy);
      if (locked.length > 0) {
        keep(`${locked.map((a) => a.employee.fullName).join(", ")} đã check-in hoặc đang có dạy thay — giữ nguyên.`);
        continue;
      }

      // Trùng lịch: với buổi khác đã có trong hệ thống và với các buổi cùng chọn lần này.
      if (session.startTime && session.endTime) {
        const inBatch = takenInBatch.find(
          (t) =>
            t.sessionDate.getTime() === session.sessionDate.getTime() &&
            t.startTime && t.endTime &&
            timeRangesOverlap(session.startTime!, session.endTime!, t.startTime, t.endTime),
        );
        if (inBatch) {
          skip(`Trùng giờ với buổi lớp ${inBatch.classCode} cũng đang chọn (${inBatch.startTime}–${inBatch.endTime}).`);
          continue;
        }
        const conflicts = await findStaffConflicts(db, employee.id, [session]);
        if (conflicts.length) {
          const c = conflicts[0];
          skip(`Trùng lịch: ${employee.fullName} đã dạy lớp ${c.classCode} ${formatDayVn(c.sessionDate)} ${c.startTime}–${c.endTime}.`);
          continue;
        }
      }

      takenInBatch.push({ sessionDate: session.sessionDate, startTime: session.startTime, endTime: session.endTime, classCode: session.class.classCode });
      const pay = already ? null : buildAssignmentPay(request.role, employee, session);
      const notes = [
        isTaught ? "Buổi đã dạy còn trống — bổ sung để tính lương." : null,
        // Chưa khai đơn giá thì vẫn gán được, nhưng phải nói rõ lương buổi đó đang là 0đ.
        pay && pay.hourlyRate === 0
          ? `${employee.fullName} chưa khai đơn giá ${request.role === "TEACHER" ? "dạy" : "trợ giảng"} — lương buổi này đang là 0đ.`
          : null,
      ].filter(Boolean);
      internal.push({
        ...base,
        action: others.length > 0 ? "REPLACE" : "ASSIGN",
        replacedNames: others.map((a) => a.employee.fullName),
        reason: notes.length ? notes.join(" ") : null,
        deleteIds: others.map((a) => a.id),
        pay,
      });
    }
  }

  const counts: Record<BulkAction, number> = { ASSIGN: 0, REPLACE: 0, KEEP: 0, SKIP: 0 };
  for (const item of internal) counts[item.action] += 1;
  const items = internal.map(({ employeeId: _e, deleteIds: _d, pay: _p, ...item }) => item);
  return { items, counts, internal };
}

export async function applyBulkAssignment(tx: Prisma.TransactionClient, plan: { internal: InternalItem[] }) {
  let written = 0;
  for (const item of plan.internal) {
    if (item.action !== "ASSIGN" && item.action !== "REPLACE") continue;
    if (item.deleteIds.length) await tx.sessionAssignment.deleteMany({ where: { id: { in: item.deleteIds } } });
    if (item.pay) {
      await tx.sessionAssignment.create({
        data: { sessionId: item.sessionId, employeeId: item.employeeId, role: item.role, ...item.pay },
      });
    }
    written += 1;
  }
  return { written };
}
