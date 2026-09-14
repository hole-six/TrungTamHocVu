import type { Prisma, PrismaClient } from "@prisma/client";
import { buildAssignmentPay } from "@/lib/server/class-default-assignments";
import { findStaffConflicts, formatDayVn, timeRangesOverlap } from "@/lib/server/staff-schedule";
import { canEditPayroll } from "@/lib/server/payroll-rules";
import { assignmentRoleType, isEmployeeWorkingOn } from "@/lib/assignment-roles";

// PHÂN CÔNG HÀNG LOẠT từ lịch tổng: gán MỘT DANH SÁCH giáo viên (1, 2 người...) và/hoặc
// MỘT DANH SÁCH trợ giảng cho nhiều buổi đã chọn cùng lúc. Dùng đúng các quy tắc của phân
// công từng buổi (vai trò, đơn giá chốt, trùng lịch, nghỉ việc) để trong lớp và ngoài lịch
// luôn khớp nhau.
//
// Luôn 2 bước: lập KẾ HOẠCH cho từng buổi × vai trò (gán thêm / thay người / giữ nguyên /
// bỏ qua kèm lý do) → người dùng xem → xác nhận thì lập lại kế hoạch trong giao dịch rồi ghi.
//
// Hai cách gán, áp riêng cho từng vai trò (GV, TG):
//   FILL_EMPTY — buổi CHƯA CÓ AI ở vai trò đó thì gán cả danh sách; đã có người thì giữ nguyên;
//   REPLACE    — vai trò đó của buổi thành ĐÚNG danh sách đã chọn: thêm người còn thiếu, gỡ
//                người không có trong danh sách.
// Không bao giờ đụng: buổi đã hủy/đã dời; vai trò có người đã check-in hoặc đang dính dạy
// thay mà không nằm trong danh sách; buổi đã dạy mà vai trò đó đã có người (lương đã tính
// theo người đó). Buổi đã dạy còn trống thì được bổ sung, trừ khi tháng lương đã chốt.
// Trong 1 buổi, người nào trùng lịch/đã nghỉ/đang giữ vai trò khác thì chỉ bỏ qua RIÊNG
// người đó, những người còn lại vẫn được gán.

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
  action: BulkAction;
  /** Người sẽ được thêm vào buổi. */
  addNames: string[];
  /** Người sẽ bị gỡ khỏi vai trò này. */
  removeNames: string[];
  /** Người đang có và vẫn giữ. */
  keepNames: string[];
  /** Người trong danh sách không gán được ở buổi này (hoặc cần lưu ý), kèm lý do. */
  skipped: { name: string; reason: string }[];
  reason: string | null;
};

export type BulkPlan = {
  items: BulkPlanItem[];
  counts: Record<BulkAction, number>;
};

type InternalItem = BulkPlanItem & {
  deleteIds: string[];
  creates: Array<{ employeeId: string; pay: ReturnType<typeof buildAssignmentPay> }>;
};

export async function planBulkAssignment(
  db: Db,
  input: { sessionIds: string[]; teacherIds?: string[]; assistantIds?: string[]; mode: BulkMode },
): Promise<BulkPlan & { internal: InternalItem[] }> {
  const teacherIds = [...new Set(input.teacherIds ?? [])];
  const assistantIds = [...new Set(input.assistantIds ?? [])];
  const requests: Array<{ role: BulkRole; employeeIds: string[] }> = [];
  if (teacherIds.length) requests.push({ role: "TEACHER", employeeIds: teacherIds });
  if (assistantIds.length) requests.push({ role: "ASSISTANT", employeeIds: assistantIds });

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
    db.employee.findMany({ where: { id: { in: [...teacherIds, ...assistantIds] } } }),
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

  // Khung giờ đã xếp cho từng người trong CHÍNH lần gán này — bắt trùng giữa các buổi cùng chọn.
  const takenInBatch = new Map<string, Array<{ sessionDate: Date; startTime: string; endTime: string; classCode: string }>>();

  const internal: InternalItem[] = [];
  for (const session of sessions) {
    for (const request of requests) {
      const item: InternalItem = {
        sessionId: session.id,
        classId: session.class.id,
        classCode: session.class.classCode,
        className: session.class.className,
        sessionDate: session.sessionDate.toISOString(),
        startTime: session.startTime,
        endTime: session.endTime,
        role: request.role,
        action: "KEEP",
        addNames: [],
        removeNames: [],
        keepNames: [],
        skipped: [],
        reason: null,
        deleteIds: [],
        creates: [],
      };
      const finish = (action: BulkAction, reason: string | null = null) => {
        item.action = action;
        item.reason = reason;
        internal.push(item);
      };

      if (session.status === "CANCELLED" || session.status === "RESCHEDULED") {
        finish("SKIP", session.status === "CANCELLED" ? "Buổi đã hủy." : "Buổi đã dời sang ngày khác.");
        continue;
      }

      // Vai trò GV gồm TEACHER; vai trò TG gồm ASSISTANT và ASSISTANT2.
      const current = session.assignments.filter((a) => assignmentRoleType(a.role) === request.role);
      const currentNames = current.map((a) => a.employee.fullName);
      const isTaught = session.status === "COMPLETED";

      if (isTaught && current.length > 0) {
        item.keepNames = currentNames;
        finish("KEEP", "Buổi đã dạy — giữ người đã dạy (lương đã tính theo người đó).");
        continue;
      }
      if (isTaught && lockedPeriods.has(`${session.class.branchId}|${session.sessionDate.toISOString().slice(0, 7)}`)) {
        finish("SKIP", "Buổi đã dạy thuộc tháng lương đã chốt.");
        continue;
      }
      if (input.mode === "FILL_EMPTY" && current.length > 0) {
        item.keepNames = currentNames;
        finish("KEEP", "Đã có người — chế độ chỉ điền buổi còn trống.");
        continue;
      }

      const wanted = new Set(request.employeeIds);
      const toRemove = current.filter((a) => !wanted.has(a.employeeId));
      const lockedRemovals = toRemove.filter((a) => a.checkInAt || a.substituteForId || a.substitutedBy);
      if (lockedRemovals.length > 0) {
        item.keepNames = currentNames;
        finish(
          "KEEP",
          `${lockedRemovals.map((a) => a.employee.fullName).join(", ")} đã check-in hoặc đang có dạy thay — giữ nguyên vai trò này.`,
        );
        continue;
      }
      item.keepNames = current.filter((a) => wanted.has(a.employeeId)).map((a) => a.employee.fullName);

      for (const employeeId of request.employeeIds) {
        const employee = employeeById.get(employeeId);
        if (!employee) continue;
        if (current.some((a) => a.employeeId === employeeId)) continue; // đã có, giữ
        const skip = (reason: string) => item.skipped.push({ name: employee.fullName, reason });

        if (!isEmployeeWorkingOn(employee, session.sessionDate)) {
          skip("đã nghỉ việc vào ngày này");
          continue;
        }
        if (session.assignments.some((a) => a.employeeId === employeeId)) {
          skip(`đang là ${request.role === "TEACHER" ? "trợ giảng" : "giáo viên"} của buổi này`);
          continue;
        }
        if (session.startTime && session.endTime) {
          const taken = takenInBatch.get(employeeId) ?? [];
          const inBatch = taken.find(
            (t) =>
              t.sessionDate.getTime() === session.sessionDate.getTime() &&
              timeRangesOverlap(session.startTime!, session.endTime!, t.startTime, t.endTime),
          );
          if (inBatch) {
            skip(`trùng giờ với buổi lớp ${inBatch.classCode} cũng đang chọn (${inBatch.startTime}–${inBatch.endTime})`);
            continue;
          }
          const conflicts = await findStaffConflicts(db, employeeId, [session]);
          if (conflicts.length) {
            const c = conflicts[0];
            skip(`trùng lịch lớp ${c.classCode} ${formatDayVn(c.sessionDate)} ${c.startTime}–${c.endTime}`);
            continue;
          }
          taken.push({ sessionDate: session.sessionDate, startTime: session.startTime, endTime: session.endTime, classCode: session.class.classCode });
          takenInBatch.set(employeeId, taken);
        }
        const pay = buildAssignmentPay(request.role, employee, session);
        item.creates.push({ employeeId, pay });
        item.addNames.push(employee.fullName);
        if (pay.hourlyRate === 0) {
          item.skipped.push({
            name: employee.fullName,
            reason: `vẫn gán, nhưng chưa khai đơn giá ${request.role === "TEACHER" ? "dạy" : "trợ giảng"} — lương buổi này đang là 0đ`,
          });
        }
      }

      // Gỡ người không có trong danh sách CHỈ KHI vai trò này vẫn còn người sau khi đổi —
      // không để buổi trống trơn vì mọi người trong danh sách đều bị bỏ qua.
      const willHaveSomeone = item.creates.length > 0 || item.keepNames.length > 0;
      if (toRemove.length > 0 && willHaveSomeone) {
        item.deleteIds = toRemove.map((a) => a.id);
        item.removeNames = toRemove.map((a) => a.employee.fullName);
      } else if (toRemove.length > 0) {
        item.keepNames = currentNames;
      }

      const notes = [
        isTaught && item.creates.length ? "Buổi đã dạy còn trống — bổ sung để tính lương." : null,
        toRemove.length > 0 && !willHaveSomeone ? "Không ai trong danh sách gán được — giữ người cũ để buổi không bị trống." : null,
      ].filter(Boolean) as string[];
      const note = notes.length ? notes.join(" ") : null;

      if (item.deleteIds.length) finish("REPLACE", note);
      else if (item.creates.length) finish("ASSIGN", note);
      else if (item.skipped.length && item.keepNames.length === 0) finish("SKIP", note);
      else finish("KEEP", note ?? (item.keepNames.length ? "Đã đúng người." : null));
    }
  }

  const counts: Record<BulkAction, number> = { ASSIGN: 0, REPLACE: 0, KEEP: 0, SKIP: 0 };
  for (const item of internal) counts[item.action] += 1;
  const items = internal.map(({ deleteIds: _d, creates: _c, ...item }) => item);
  return { items, counts, internal };
}

export async function applyBulkAssignment(tx: Prisma.TransactionClient, plan: { internal: InternalItem[] }) {
  let written = 0;
  for (const item of plan.internal) {
    if (item.action !== "ASSIGN" && item.action !== "REPLACE") continue;
    if (item.deleteIds.length) await tx.sessionAssignment.deleteMany({ where: { id: { in: item.deleteIds } } });
    for (const create of item.creates) {
      await tx.sessionAssignment.create({
        data: { sessionId: item.sessionId, employeeId: create.employeeId, role: item.role, ...create.pay },
      });
    }
    written += 1;
  }
  return { written };
}
