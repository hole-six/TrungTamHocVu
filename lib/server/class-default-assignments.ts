import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeSessionBaseHours } from "@/lib/server/payroll-rules";
import { getVietnamToday } from "@/lib/server/class-rules";
import { findStaffConflicts, describeStaffConflicts } from "@/lib/server/staff-schedule";
import { assignmentRoleType, hourlyRateForRole, isEmployeeWorkingOn, toSessionRole } from "@/lib/assignment-roles";

type Db = PrismaClient | Prisma.TransactionClient;

export const CLASS_ASSIGNMENT_ROLES = ["TEACHER", "ASSISTANT", "ASSISTANT2"] as const;

export function isValidClassAssignmentRole(role: string) {
  return assignmentRoleType(role) !== null;
}

export function getClassAssignmentRoleType(role: string): "TEACHER" | "ASSISTANT" | null {
  return assignmentRoleType(role);
}

export function getClassAssignmentRoleLabel(role: string) {
  const type = assignmentRoleType(role);
  if (!type) return role;
  return type === "TEACHER" ? "Giáo viên" : "Trợ giảng";
}

type EmployeePay = {
  payMode: string;
  teachingHourlyRate: number | null;
  assistantHourlyRate: number | null;
};

/** Giờ công + đơn giá chốt cho 1 phân công. role là vai trò TRÊN BUỔI (TEACHER/ASSISTANT/ASSISTANT2). */
export function buildAssignmentPay(
  role: string,
  employee: EmployeePay,
  session: { startTime: string | null; endTime: string | null },
) {
  const hours = computeSessionBaseHours(employee.payMode, session.startTime, session.endTime);
  const hourlyRate = hourlyRateForRole(role, employee);
  return { hours, hourlyRate, amount: Math.round(hours * hourlyRate) };
}

// "Buổi chưa dạy" = còn trong kế hoạch (PLANNED/CONFIRMED) và từ HÔM NAY trở đi. Buổi của
// ngày đã qua mà chưa ai bấm hoàn thành vẫn coi là người cũ đã đứng lớp — không đổi.
function upcomingSessionWhere(classId: string): Prisma.ClassSessionWhereInput {
  return { classId, status: { in: ["PLANNED", "CONFIRMED"] }, sessionDate: { gte: getVietnamToday() } };
}

/**
 * Bổ sung nhân sự mặc định vào các buổi chưa dạy còn TRỐNG vai trò đó (vd lớp đã sinh
 * lịch trước khi gán giáo viên). Không đụng buổi đã có người — kể cả người khác người
 * mặc định (đó là phân công riêng của buổi). Người trùng lịch thì bỏ qua và báo lại.
 */
export async function applyClassDefaultAssignmentsToExistingSessions(classId: string) {
  const [defaults, sessions] = await Promise.all([
    prisma.classDefaultAssignment.findMany({
      where: { classId, isActive: true },
      include: { employee: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.classSession.findMany({ where: upcomingSessionWhere(classId), include: { assignments: true }, orderBy: { sessionDate: "asc" } }),
  ]);

  let created = 0;
  const skippedConflicts: string[] = [];
  for (const session of sessions) {
    const filledTypes = new Set(session.assignments.map((a) => assignmentRoleType(a.role)));
    const toCreate = [];
    for (const item of defaults) {
      const role = toSessionRole(item.role);
      if (!role || filledTypes.has(assignmentRoleType(role))) continue;
      if (!isEmployeeWorkingOn(item.employee, session.sessionDate)) continue;
      const conflicts = await findStaffConflicts(prisma, item.employeeId, [session]);
      if (conflicts.length) {
        skippedConflicts.push(describeStaffConflicts(item.employee.fullName, conflicts, 1));
        continue;
      }
      toCreate.push({ sessionId: session.id, employeeId: item.employeeId, role, ...buildAssignmentPay(role, item.employee, session) });
    }
    if (toCreate.length) {
      await prisma.sessionAssignment.createMany({ data: toCreate });
      created += toCreate.length;
    }
  }
  return { created, sessionsChecked: sessions.length, skippedConflicts };
}

// ---------------------------------------------------------------------------------
// ĐỔI NHÂN SỰ MẶC ĐỊNH CỦA LỚP → ĐỔI LUÔN Ở CÁC BUỔI CHƯA DẠY
//
// Lỗi cũ: lưu GV mới chỉ ảnh hưởng buổi SINH SAU; các buổi đã sinh sẵn (thường ~1 tháng)
// vẫn là GV cũ, nút "áp dụng" chỉ thêm vào chỗ trống → GV B dạy mà lương tính cho GV A.
//
// Quy tắc (so danh sách cũ và mới theo từng vai trò trên buổi):
//   - THAY người (A ra, B vào cùng vai trò): buổi chưa dạy nào đang có A thì đổi thành B.
//     Buổi không có A (đã phân công riêng người khác cho buổi đó) thì GIỮ NGUYÊN, không
//     nhét thêm B vào.
//   - THÊM người (vai trò có thêm người): thêm vào mọi buổi chưa dạy chưa có người đó.
//   - BỚT người: gỡ khỏi các buổi chưa dạy đang có người đó.
//   - Không bao giờ đụng: buổi đã dạy/đã hủy/đã dời, buổi của ngày đã qua, phân công đã
//     check-in hoặc đang dính dạy thay (người thay/người được thay).
//   - Người được đưa vào mà trùng lịch lớp khác hoặc đã nghỉ việc → chặn cả lần lưu,
//     báo rõ buổi nào, để không lưu nửa vời.
// ---------------------------------------------------------------------------------

export type DefaultStaffInput = { role: string; employeeId: string; notes?: string | null };

export type StaffChange = {
  role: "TEACHER" | "ASSISTANT" | "ASSISTANT2";
  fromEmployeeId: string | null;
  fromName: string | null;
  toEmployeeId: string | null;
  toName: string | null;
  sessionCount: number;
  keptLocked: number;
};

export type StaffSyncPlan = {
  changes: StaffChange[];
  affectedSessions: number;
  errors: string[];
};

type PlannedOp =
  | { kind: "delete"; assignmentId: string }
  | { kind: "create"; sessionId: string; employeeId: string; role: string; pay: ReturnType<typeof buildAssignmentPay> };

export async function planDefaultStaffSync(
  db: Db,
  classId: string,
  nextDefaults: DefaultStaffInput[],
): Promise<StaffSyncPlan & { ops: PlannedOp[] }> {
  const current = await db.classDefaultAssignment.findMany({ where: { classId, isActive: true } });
  const pairKey = (role: string, employeeId: string) => `${role}|${employeeId}`;
  const oldPairs = new Map<string, { role: string; employeeId: string }>();
  for (const item of current) {
    const role = toSessionRole(item.role);
    if (role) oldPairs.set(pairKey(role, item.employeeId), { role, employeeId: item.employeeId });
  }
  const newPairs = new Map<string, { role: string; employeeId: string }>();
  for (const item of nextDefaults) {
    const role = toSessionRole(item.role);
    if (role && item.employeeId) newPairs.set(pairKey(role, item.employeeId), { role, employeeId: item.employeeId });
  }

  const removedByRole = new Map<string, string[]>();
  const addedByRole = new Map<string, string[]>();
  for (const [key, pair] of oldPairs) if (!newPairs.has(key)) removedByRole.set(pair.role, [...(removedByRole.get(pair.role) ?? []), pair.employeeId]);
  for (const [key, pair] of newPairs) if (!oldPairs.has(key)) addedByRole.set(pair.role, [...(addedByRole.get(pair.role) ?? []), pair.employeeId]);

  const roles = new Set([...removedByRole.keys(), ...addedByRole.keys()]);
  const pending: Array<{ role: string; from: string | null; to: string | null }> = [];
  for (const role of roles) {
    const removed = removedByRole.get(role) ?? [];
    const added = addedByRole.get(role) ?? [];
    for (let i = 0; i < Math.max(removed.length, added.length); i += 1) {
      pending.push({ role, from: removed[i] ?? null, to: added[i] ?? null });
    }
  }
  if (pending.length === 0) return { changes: [], affectedSessions: 0, errors: [], ops: [] };
  const removedPairs = new Set(pending.filter((p) => p.from).map((p) => `${p.from}|${assignmentRoleType(p.role)}`));

  const employeeIds = [...new Set(pending.flatMap((p) => [p.from, p.to]).filter((id): id is string => Boolean(id)))];
  const [employees, sessions] = await Promise.all([
    db.employee.findMany({ where: { id: { in: employeeIds } } }),
    db.classSession.findMany({
      where: upcomingSessionWhere(classId),
      include: { assignments: { include: { substitutedBy: { select: { id: true } } } } },
      orderBy: { sessionDate: "asc" },
    }),
  ]);
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const ops: PlannedOp[] = [];
  const errors: string[] = [];
  const changes: StaffChange[] = [];
  const affected = new Set<string>();

  for (const change of pending) {
    const toEmployee = change.to ? employeeById.get(change.to) ?? null : null;
    const fromEmployee = change.from ? employeeById.get(change.from) ?? null : null;
    let sessionCount = 0;
    let keptLocked = 0;
    const targetSessions: typeof sessions = [];

    for (const session of sessions) {
      // So theo LOẠI vai trò (TG gồm cả ASSISTANT2 thêm tay ở từng buổi), không so chuỗi.
      const changeType = assignmentRoleType(change.role);
      const fromAssignment = change.from
        ? session.assignments.find((a) => a.employeeId === change.from && assignmentRoleType(a.role) === changeType)
        : null;
      const alreadyHasTo = change.to
        ? session.assignments.some((a) => a.employeeId === change.to && assignmentRoleType(a.role) === changeType)
        : false;
      // Người mới đang giữ vai trò KHÁC ở buổi này (vd đang là TG, nay thành GV mặc định):
      // không xếp 1 người 2 vai trò — coi như buổi cần xử lý tay, giữ nguyên.
      // (Bỏ qua vai trò cũ đang được gỡ trong CÙNG lần lưu — vd chuyển TG lên làm GV.)
      const toInOtherRole = change.to
        ? session.assignments.some(
            (a) =>
              a.employeeId === change.to &&
              assignmentRoleType(a.role) !== changeType &&
              !removedPairs.has(`${a.employeeId}|${assignmentRoleType(a.role)}`),
          )
        : false;
      const locked =
        Boolean(fromAssignment && (fromAssignment.checkInAt || fromAssignment.substituteForId || fromAssignment.substitutedBy)) ||
        (toInOtherRole && Boolean(fromAssignment));

      if (change.from && !change.to) {
        if (!fromAssignment) continue;
        if (locked) { keptLocked += 1; continue; }
        ops.push({ kind: "delete", assignmentId: fromAssignment.id });
      } else if (change.from && change.to) {
        if (!fromAssignment) continue; // buổi đã phân công riêng người khác — giữ nguyên
        if (locked) { keptLocked += 1; continue; }
        ops.push({ kind: "delete", assignmentId: fromAssignment.id });
        if (!alreadyHasTo) targetSessions.push(session);
      } else if (!change.from && change.to) {
        if (alreadyHasTo || toInOtherRole) continue;
        targetSessions.push(session);
      }
      sessionCount += 1;
      affected.add(session.id);
    }

    if (toEmployee && targetSessions.length) {
      const offDays = targetSessions.filter((s) => !isEmployeeWorkingOn(toEmployee, s.sessionDate));
      if (offDays.length) {
        errors.push(`${toEmployee.fullName} đã nghỉ việc, không xếp được vào ${offDays.length} buổi chưa dạy của lớp.`);
      }
      const conflicts = await findStaffConflicts(db, toEmployee.id, targetSessions);
      if (conflicts.length) errors.push(describeStaffConflicts(toEmployee.fullName, conflicts));
      for (const session of targetSessions) {
        ops.push({ kind: "create", sessionId: session.id, employeeId: toEmployee.id, role: change.role, pay: buildAssignmentPay(change.role, toEmployee, session) });
      }
    }

    changes.push({
      role: change.role as StaffChange["role"],
      fromEmployeeId: change.from,
      fromName: fromEmployee?.fullName ?? null,
      toEmployeeId: change.to,
      toName: toEmployee?.fullName ?? null,
      sessionCount,
      keptLocked,
    });
  }

  return { changes, affectedSessions: affected.size, errors, ops };
}

/** Lưu nhân sự mặc định + đổi theo ở các buổi chưa dạy, trong CÙNG một giao dịch. */
export async function saveDefaultStaff(tx: Prisma.TransactionClient, classId: string, nextDefaults: DefaultStaffInput[]) {
  const plan = await planDefaultStaffSync(tx, classId, nextDefaults);
  if (plan.errors.length) return { ok: false as const, plan };

  const roles = nextDefaults.map((item) => item.role);
  await tx.classDefaultAssignment.updateMany({ where: { classId, role: { notIn: roles } }, data: { isActive: false } });
  for (const item of nextDefaults) {
    await tx.classDefaultAssignment.upsert({
      where: { classId_role: { classId, role: item.role } },
      create: { classId, employeeId: item.employeeId, role: item.role, notes: item.notes ?? null, isActive: true },
      update: { employeeId: item.employeeId, notes: item.notes ?? null, isActive: true },
    });
  }

  for (const op of plan.ops) {
    if (op.kind === "delete") await tx.sessionAssignment.delete({ where: { id: op.assignmentId } });
  }
  for (const op of plan.ops) {
    if (op.kind === "create") {
      await tx.sessionAssignment.create({ data: { sessionId: op.sessionId, employeeId: op.employeeId, role: op.role, ...op.pay } });
    }
  }
  return { ok: true as const, plan };
}

/** Chuẩn hóa + kiểm tra danh sách nhân sự mặc định gửi lên từ form lớp. */
export function normalizeDefaultStaffInput(raw: unknown): { items: DefaultStaffInput[]; error: string | null } {
  const items: DefaultStaffInput[] = (Array.isArray(raw) ? raw : [])
    .map((item: { role?: string; employeeId?: string | null; notes?: string | null }) => ({
      role: String(item?.role ?? "").trim().toUpperCase(),
      employeeId: item?.employeeId ? String(item.employeeId).trim() : "",
      notes: String(item?.notes ?? "").trim() || null,
    }))
    .filter((item) => item.employeeId && isValidClassAssignmentRole(item.role));

  const seenRoles = new Set<string>();
  const seenEmployees = new Set<string>();
  for (const item of items) {
    if (seenRoles.has(item.role)) return { items, error: `Vai trò ${item.role} đang bị gửi trùng.` };
    seenRoles.add(item.role);
    if (seenEmployees.has(item.employeeId)) {
      return { items, error: "Một người không thể giữ 2 vị trí trong cùng lớp (vừa giáo viên vừa trợ giảng, hoặc lặp tên)." };
    }
    seenEmployees.add(item.employeeId);
  }
  return { items, error: null };
}
