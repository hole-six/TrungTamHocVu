import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/server/tuition-rules";
import { computeContractStatus, isCloseEnough, type EmployeeContractStatus } from "@/lib/server/payroll-rules";

export type PayrollEmployeeRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string | null;
  workStatus: string;
  payMode: string;
  contractStatus: EmployeeContractStatus;
  teachingHourlyRate: number | null;
  assistantHourlyRate: number | null;
  staffDailyRate: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  hasBankInfo: boolean;
  // Hồ sơ cá nhân — kèm sẵn để drawer sửa không cần fetch thêm khi mở.
  dob: Date | null;
  phone: string | null;
  email: string | null;
  hometown: string | null;
  permanentAddress: string | null;
  idNumber: string | null;
  idIssueDate: Date | null;
  idIssuePlace: string | null;
  resignDate: Date | null;
  // Số hiệu quả để hiển thị: nếu đã có PayrollLine thì lấy số đã đóng băng (nguồn thật),
  // nếu chưa thì lấy số sống tính trực tiếp từ SessionAssignment/TimesheetEntry (xem trước).
  teachingHours: number;
  teachingAmount: number;
  assistantHours: number;
  assistantAmount: number;
  staffDays: number;
  staffHours: number;
  baseSalaryAmount: number;
  otHours: number;
  otAmount: number;
  kpiBonus: number;
  assistantRatingBonus: number;
  parkingAllowance: number;
  supportAllowance: number;
  bonus: number;
  penalty: number;
  socialInsuranceDeduction: number;
  utilityDeduction: number;
  holidayBonus: number;
  otherDeduction: number;
  notes: string | null;
  totalAmount: number;
  sessionCount: number;
  timesheetEntryCount: number;
  // Trạng thái nguồn dữ liệu
  lineId: string | null; // null = đang xem trước, chưa có dòng lương chính thức
  hasMismatch: boolean; // chỉ có ý nghĩa khi lineId != null
  hasRateIssue: boolean;
  assistantBonusByBranch: Record<string, number | null>;
};

// Gộp giờ dạy/trợ giảng/công hành chính của TẤT CẢ nhân sự trong chi nhánh cho 1 tháng,
// theo lối 1 câu query cho cả danh sách rồi group trong JS (không loop từng người như
// payroll-generation.ts) — đúng dạng cần cho 1 bảng, tránh N+1 khi có vài chục nhân sự.
export async function buildPayrollEmployeeRows(params: {
  branchId: string | null;
  period: string; // "YYYY-MM"
  runId?: string | null;
  forceIncludeEmployeeId?: string | null;
}): Promise<PayrollEmployeeRow[]> {
  const { branchId, period, runId, forceIncludeEmployeeId } = params;
  const { start, end } = monthRange(period);
  const branchWhere = branchId ? { branchId } : {};

  const [employeesRaw, teachingAssignments, assistantAssignments, timesheetEntries, lines, monthlyBonuses] = await Promise.all([
    prisma.employee.findMany({
      where: branchWhere,
      orderBy: { fullName: "asc" },
      include: { contracts: { orderBy: { signDate: "desc" }, take: 1 } },
    }),
    prisma.sessionAssignment.findMany({
      where: {
        ...(branchId ? { employee: { branchId } } : {}),
        role: "TEACHER",
        session: { sessionDate: { gte: start, lte: end }, status: "COMPLETED" },
      },
    }),
    prisma.sessionAssignment.findMany({
      where: {
        ...(branchId ? { employee: { branchId } } : {}),
        role: { in: ["ASSISTANT", "ASSISTANT2"] },
        session: { sessionDate: { gte: start, lte: end }, status: "COMPLETED" },
      },
    }),
    prisma.timesheetEntry.findMany({
      where: {
        ...(branchId ? { employee: { branchId } } : {}),
        workDate: { gte: start, lte: end },
      },
    }),
    runId ? prisma.payrollLine.findMany({ where: { payrollRunId: runId } }) : Promise.resolve([]),
    prisma.assistantMonthlyBonus.findMany({ where: { month: period, ...(branchId ? { branchId } : {}) } }),
  ]);

  const teachingByEmployee = new Map<string, { hours: number; amount: number; sessions: number }>();
  const assistantByEmployee = new Map<string, { hours: number; amount: number; sessions: number }>();
  const timesheetByEmployee = new Map<string, { days: number; hours: number; entries: number }>();

  for (const item of teachingAssignments) {
    const current = teachingByEmployee.get(item.employeeId) ?? { hours: 0, amount: 0, sessions: 0 };
    current.hours += item.hours ?? 0;
    current.amount += item.amount ?? 0;
    current.sessions += 1;
    teachingByEmployee.set(item.employeeId, current);
  }
  for (const item of assistantAssignments) {
    const current = assistantByEmployee.get(item.employeeId) ?? { hours: 0, amount: 0, sessions: 0 };
    current.hours += item.hours ?? 0;
    current.amount += item.amount ?? 0;
    current.sessions += 1;
    assistantByEmployee.set(item.employeeId, current);
  }
  for (const item of timesheetEntries) {
    const current = timesheetByEmployee.get(item.employeeId) ?? { days: 0, hours: 0, entries: 0 };
    current.days += item.days ?? 0;
    current.hours += item.hours ?? 0;
    current.entries += 1;
    timesheetByEmployee.set(item.employeeId, current);
  }

  const lineByEmployee = new Map(lines.map((line) => [line.employeeId, line]));
  const bonusByEmployee = new Map<string, Record<string, number | null>>();
  for (const bonus of monthlyBonuses) {
    const current = bonusByEmployee.get(bonus.employeeId) ?? {};
    current[bonus.branchId] = bonus.bonusPercent;
    bonusByEmployee.set(bonus.employeeId, current);
  }

  const rows: PayrollEmployeeRow[] = employeesRaw.map(({ contracts, ...employee }) => {
    const teaching = teachingByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const assistant = assistantByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const timesheet = timesheetByEmployee.get(employee.id) ?? { days: 0, hours: 0, entries: 0 };
    const liveBaseSalaryAmount = Math.round(timesheet.days * (employee.staffDailyRate ?? 0));
    const line = lineByEmployee.get(employee.id) ?? null;

    const hasMismatch = line
      ? !isCloseEnough(teaching.hours, line.teachingHours) ||
        !isCloseEnough(assistant.hours, line.assistantHours) ||
        !isCloseEnough(timesheet.days, line.staffDays)
      : false;

    const hasRateIssue =
      (teaching.hours > 0 && employee.teachingHourlyRate == null) ||
      (assistant.hours > 0 && employee.assistantHourlyRate == null) ||
      (timesheet.days > 0 && employee.staffDailyRate == null);

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      position: employee.position,
      workStatus: employee.workStatus,
      payMode: employee.payMode,
      contractStatus: computeContractStatus(employee.resignDate, contracts[0]?.expiryDate ?? null),
      teachingHourlyRate: employee.teachingHourlyRate,
      assistantHourlyRate: employee.assistantHourlyRate,
      staffDailyRate: employee.staffDailyRate,
      bankName: employee.bankName,
      bankAccountNumber: employee.bankAccountNumber,
      bankAccountHolder: employee.bankAccountHolder,
      hasBankInfo: Boolean(employee.bankName && employee.bankAccountNumber && employee.bankAccountHolder),
      dob: employee.dob,
      phone: employee.phone,
      email: employee.email,
      hometown: employee.hometown,
      permanentAddress: employee.permanentAddress,
      idNumber: employee.idNumber,
      idIssueDate: employee.idIssueDate,
      idIssuePlace: employee.idIssuePlace,
      resignDate: employee.resignDate,
      teachingHours: line ? line.teachingHours : teaching.hours,
      teachingAmount: line ? line.teachingAmount : teaching.amount,
      assistantHours: line ? line.assistantHours : assistant.hours,
      assistantAmount: line ? line.assistantAmount : assistant.amount,
      staffDays: line ? line.staffDays : timesheet.days,
      staffHours: timesheet.hours,
      baseSalaryAmount: line ? line.baseSalaryAmount : liveBaseSalaryAmount,
      otHours: line?.otHours ?? 0,
      otAmount: line?.otAmount ?? 0,
      kpiBonus: line?.kpiBonus ?? 0,
      assistantRatingBonus: line?.assistantRatingBonus ?? 0,
      parkingAllowance: line?.parkingAllowance ?? 0,
      supportAllowance: line?.supportAllowance ?? 0,
      bonus: line ? line.bonus : 0,
      penalty: line ? line.penalty : 0,
      socialInsuranceDeduction: line?.socialInsuranceDeduction ?? 0,
      utilityDeduction: line?.utilityDeduction ?? 0,
      holidayBonus: line?.holidayBonus ?? 0,
      otherDeduction: line?.otherDeduction ?? 0,
      notes: line ? line.notes : null,
      totalAmount: line
        ? line.totalAmount
        : teaching.amount + assistant.amount + liveBaseSalaryAmount,
      sessionCount: teaching.sessions + assistant.sessions,
      timesheetEntryCount: timesheet.entries,
      lineId: line ? line.id : null,
      hasMismatch,
      hasRateIssue,
      assistantBonusByBranch: bonusByEmployee.get(employee.id) ?? {},
    };
  });

  return rows
    .filter(
      (row) =>
        row.teachingHours > 0 ||
        row.assistantHours > 0 ||
        row.staffDays > 0 ||
        row.staffHours > 0 ||
        row.lineId != null ||
        row.id === forceIncludeEmployeeId,
    )
    .sort((a, b) => b.totalAmount - a.totalAmount);
}
