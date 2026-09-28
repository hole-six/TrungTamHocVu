import { prisma } from "@/lib/prisma";
import { employeeBranchFilter, timesheetBranchFilter } from "@/lib/server/employee-branches";
import { monthRange } from "@/lib/server/tuition-rules";
import { computeContractStatus, type EmployeeContractStatus } from "@/lib/server/payroll-rules";

/** Phần lương của MỘT cơ sở trong dòng tổng hợp "Tất cả cơ sở". */
export type PayrollBranchPart = {
  branchId: string;
  branchName: string;
  teachingHours: number;
  teachingAmount: number;
  assistantHours: number;
  assistantAmount: number;
  staffDays: number;
  baseSalaryAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
};

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
  lineId: string | null; // != null = tháng này có khoản cộng/trừ nhập tay cho người này
  /** @deprecated Không còn ý nghĩa từ khi công/tiền luôn tính theo dữ liệu thật. */
  hasMismatch: boolean;
  hasRateIssue: boolean;
  ratingBonusPercent: number | null;
  /** Cơ sở chính (nơi giữ hồ sơ) + toàn bộ cơ sở người này được gắn. */
  primaryBranchId: string;
  branchIds: string[];
  /**
   * Chỉ có khi đang xem "Tất cả cơ sở": lương tính RIÊNG từng cơ sở rồi mới tổng hợp,
   * nên dòng tổng luôn tách ra được tiền của từng nơi. Xem 1 cơ sở cụ thể thì để null
   * (cả dòng đã là số của đúng cơ sở đó).
   */
  branchBreakdown: PayrollBranchPart[] | null;
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
  // Không chọn cơ sở = màn TỔNG HỢP: vẫn tính riêng từng cơ sở rồi cộng lại, kèm phần
  // tách theo cơ sở để biết tiền ở đâu ra (xem PayrollBranchPart).
  const aggregate = !branchId;
  const branchWhere = employeeBranchFilter(branchId);

  // LƯƠNG THEO TỪNG CƠ SỞ: màn lương của một cơ sở phải hiện đúng những gì cơ sở đó trả
  // — buổi dạy/trợ giảng TẠI cơ sở này (lọc theo cơ sở của LỚP, không phải theo cơ sở
  // ghi trong hồ sơ nhân sự), và gồm cả người cơ sở khác sang dạy. Phải khớp đúng cách
  // tính ở lib/server/payroll-generation.ts, nếu không màn hình và dòng lương đã tính ra
  // hai con số khác nhau.
  const sessionScope = {
    sessionDate: { gte: start, lte: end },
    status: "COMPLETED",
    ...(branchId ? { class: { branchId } } : {}),
  };
  // Ở màn tổng hợp cần biết mỗi buổi thuộc cơ sở nào mới tách được tiền theo cơ sở.
  const assignmentInclude = aggregate
    ? ({ session: { select: { class: { select: { branchId: true } } } } } as const)
    : undefined;

  const [homeEmployees, visitingEmployees, teachingAssignments, assistantAssignments, timesheetEntries, lines, monthlyBonuses] =
    await Promise.all([
    prisma.employee.findMany({
      where: branchWhere,
      orderBy: { fullName: "asc" },
      include: { contracts: { orderBy: { signDate: "desc" }, take: 1 }, branchLinks: { select: { branchId: true } } },
    }),
    prisma.employee.findMany({
      // Không lọc cơ sở (xem tất cả) thì homeEmployees đã gồm mọi người rồi — điều kiện
      // dưới đây tự trả về rỗng, khỏi phải rẽ nhánh kiểu dữ liệu.
      where: branchId
        ? { NOT: branchWhere, sessionAssignments: { some: { session: sessionScope } } }
        : { id: "__KHONG_CO_AI__" },
      orderBy: { fullName: "asc" },
      include: { contracts: { orderBy: { signDate: "desc" }, take: 1 }, branchLinks: { select: { branchId: true } } },
    }),
    prisma.sessionAssignment.findMany({
      where: {
        role: "TEACHER",
        session: sessionScope,
      },
      ...(assignmentInclude ? { include: assignmentInclude } : {}),
    }),
    prisma.sessionAssignment.findMany({
      where: {
        role: { in: ["ASSISTANT", "ASSISTANT2"] },
        session: sessionScope,
      },
      ...(assignmentInclude ? { include: assignmentInclude } : {}),
    }),
    // Ngày công thuộc về cơ sở đã chấm ngày đó — một người gắn nhiều cơ sở mà lọc theo
    // hồ sơ thì cơ sở nào cũng cộng cùng một ngày công (trả lương trùng).
    prisma.timesheetEntry.findMany({
      where: {
        ...timesheetBranchFilter(branchId),
        workDate: { gte: start, lte: end },
      },
    }),
    // Khoản nhập tay: xem 1 cơ sở thì lấy đúng tháng lương của cơ sở đó; xem tổng hợp
    // thì gom khoản nhập tay của MỌI cơ sở trong tháng rồi cộng lại.
    runId
      ? prisma.payrollLine.findMany({ where: { payrollRunId: runId }, include: { payrollRun: { select: { branchId: true } } } })
      : aggregate
        ? prisma.payrollLine.findMany({
            where: { payrollRun: { periodName: period } },
            include: { payrollRun: { select: { branchId: true } } },
          })
        : Promise.resolve([]),
    prisma.employeeMonthlyRating.findMany({ where: { month: period } }),
  ]);

  // Tên cơ sở cho phần tách theo cơ sở (chỉ cần ở màn tổng hợp).
  const branchNameById = new Map<string, string>();
  if (aggregate) {
    for (const branch of await prisma.branch.findMany({ select: { id: true, name: true } })) {
      branchNameById.set(branch.id, branch.name);
    }
  }

  const teachingByEmployee = new Map<string, { hours: number; amount: number; sessions: number }>();
  const assistantByEmployee = new Map<string, { hours: number; amount: number; sessions: number }>();
  const timesheetByEmployee = new Map<string, { days: number; hours: number; entries: number }>();
  // employeeId → branchId → phần lương của riêng cơ sở đó (chỉ dùng ở màn tổng hợp).
  const partsByEmployee = new Map<string, Map<string, PayrollBranchPart>>();

  const emptyPart = (branchId: string): PayrollBranchPart => ({
    branchId,
    branchName: branchNameById.get(branchId) ?? "Cơ sở khác",
    teachingHours: 0,
    teachingAmount: 0,
    assistantHours: 0,
    assistantAmount: 0,
    staffDays: 0,
    baseSalaryAmount: 0,
    adjustmentAmount: 0,
    totalAmount: 0,
  });
  const partOf = (employeeId: string, branchId: string | null | undefined) => {
    if (!aggregate || !branchId) return null;
    const byBranch = partsByEmployee.get(employeeId) ?? new Map<string, PayrollBranchPart>();
    partsByEmployee.set(employeeId, byBranch);
    const part = byBranch.get(branchId) ?? emptyPart(branchId);
    byBranch.set(branchId, part);
    return part;
  };

  for (const item of teachingAssignments) {
    const current = teachingByEmployee.get(item.employeeId) ?? { hours: 0, amount: 0, sessions: 0 };
    current.hours += item.hours ?? 0;
    current.amount += item.amount ?? 0;
    current.sessions += 1;
    teachingByEmployee.set(item.employeeId, current);
    const part = partOf(item.employeeId, (item as { session?: { class: { branchId: string } } }).session?.class.branchId);
    if (part) {
      part.teachingHours += item.hours ?? 0;
      part.teachingAmount += item.amount ?? 0;
    }
  }
  for (const item of assistantAssignments) {
    const current = assistantByEmployee.get(item.employeeId) ?? { hours: 0, amount: 0, sessions: 0 };
    current.hours += item.hours ?? 0;
    current.amount += item.amount ?? 0;
    current.sessions += 1;
    assistantByEmployee.set(item.employeeId, current);
    const part = partOf(item.employeeId, (item as { session?: { class: { branchId: string } } }).session?.class.branchId);
    if (part) {
      part.assistantHours += item.hours ?? 0;
      part.assistantAmount += item.amount ?? 0;
    }
  }
  // Ngày công theo cơ sở. Bản ghi cũ chưa ghi cơ sở (branchId = null) sẽ được quy về cơ
  // sở chính của người đó ở vòng lặp dựng dòng bên dưới, nơi đã biết hồ sơ từng người.
  const daysByEmployeeBranch = new Map<string, Map<string | null, number>>();
  for (const item of timesheetEntries) {
    const current = timesheetByEmployee.get(item.employeeId) ?? { days: 0, hours: 0, entries: 0 };
    current.days += item.days ?? 0;
    current.hours += item.hours ?? 0;
    current.entries += 1;
    timesheetByEmployee.set(item.employeeId, current);

    if (aggregate) {
      const byBranch = daysByEmployeeBranch.get(item.employeeId) ?? new Map<string | null, number>();
      daysByEmployeeBranch.set(item.employeeId, byBranch);
      byBranch.set(item.branchId, (byBranch.get(item.branchId) ?? 0) + (item.days ?? 0));
    }
  }

  // Gộp người của cơ sở + người cơ sở khác sang dạy, không để trùng ai.
  const employeesRaw = [...homeEmployees, ...visitingEmployees.filter((item) => !homeEmployees.some((home) => home.id === item.id))];

  // Một người có thể có dòng lương ở NHIỀU cơ sở trong cùng tháng (màn tổng hợp): các
  // khoản nhập tay phải cộng dồn, không được lấy mỗi dòng đầu tiên.
  const linesByEmployee = new Map<string, typeof lines>();
  for (const line of lines) {
    const bucket = linesByEmployee.get(line.employeeId) ?? [];
    bucket.push(line);
    linesByEmployee.set(line.employeeId, bucket);
  }
  const sumLines = (items: typeof lines, pick: (line: (typeof lines)[number]) => number) =>
    items.reduce((total, line) => total + pick(line), 0);
  // Mức thưởng/phạt gộp toàn hệ thống: mỗi người mỗi tháng đúng 1 mức.
  const bonusByEmployee = new Map<string, number>();
  for (const rating of monthlyBonuses) bonusByEmployee.set(rating.employeeId, rating.bonusPercent);

  const rows: PayrollEmployeeRow[] = employeesRaw.map(({ contracts, ...employee }) => {
    const teaching = teachingByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const assistant = assistantByEmployee.get(employee.id) ?? { hours: 0, amount: 0, sessions: 0 };
    const timesheet = timesheetByEmployee.get(employee.id) ?? { days: 0, hours: 0, entries: 0 };
    const liveBaseSalaryAmount = Math.round(timesheet.days * (employee.staffDailyRate ?? 0));
    const employeeLines = linesByEmployee.get(employee.id) ?? [];
    // Dòng dùng để MỞ form sửa: ưu tiên dòng của cơ sở chính (xem tổng hợp mà bấm sửa
    // thì sửa đúng nơi giữ hồ sơ), không có thì lấy dòng đầu tiên.
    const line =
      employeeLines.find((item) => item.payrollRun?.branchId === employee.branchId) ?? employeeLines[0] ?? null;
    const adj = {
      otHours: sumLines(employeeLines, (item) => item.otHours),
      otAmount: sumLines(employeeLines, (item) => item.otAmount),
      kpiBonus: sumLines(employeeLines, (item) => item.kpiBonus),
      assistantRatingBonus: sumLines(employeeLines, (item) => item.assistantRatingBonus),
      parkingAllowance: sumLines(employeeLines, (item) => item.parkingAllowance),
      supportAllowance: sumLines(employeeLines, (item) => item.supportAllowance),
      bonus: sumLines(employeeLines, (item) => item.bonus),
      penalty: sumLines(employeeLines, (item) => item.penalty),
      socialInsuranceDeduction: sumLines(employeeLines, (item) => item.socialInsuranceDeduction),
      utilityDeduction: sumLines(employeeLines, (item) => item.utilityDeduction),
      holidayBonus: sumLines(employeeLines, (item) => item.holidayBonus),
      otherDeduction: sumLines(employeeLines, (item) => item.otherDeduction),
    };
    const adjustmentNet =
      adj.otAmount +
      adj.kpiBonus +
      adj.assistantRatingBonus +
      adj.parkingAllowance +
      adj.supportAllowance +
      adj.bonus +
      adj.holidayBonus -
      adj.penalty -
      adj.socialInsuranceDeduction -
      adj.utilityDeduction -
      adj.otherDeduction;

    const branchIds = [employee.branchId, ...employee.branchLinks.map((link) => link.branchId)].filter(
      (value, index, list) => list.indexOf(value) === index,
    );

    // Phần tách theo cơ sở (chỉ ở màn tổng hợp): ngày công quy về đúng cơ sở đã chấm,
    // khoản nhập tay quy về cơ sở của chính tháng lương đã ghi khoản đó.
    let branchBreakdown: PayrollBranchPart[] | null = null;
    if (aggregate) {
      const byBranch = partsByEmployee.get(employee.id) ?? new Map<string, PayrollBranchPart>();
      const ensure = (id: string) => {
        const current =
          byBranch.get(id) ??
          ({
            branchId: id,
            branchName: branchNameById.get(id) ?? "Cơ sở khác",
            teachingHours: 0,
            teachingAmount: 0,
            assistantHours: 0,
            assistantAmount: 0,
            staffDays: 0,
            baseSalaryAmount: 0,
            adjustmentAmount: 0,
            totalAmount: 0,
          } satisfies PayrollBranchPart);
        byBranch.set(id, current);
        return current;
      };
      for (const [entryBranchId, days] of daysByEmployeeBranch.get(employee.id) ?? []) {
        const part = ensure(entryBranchId ?? employee.branchId);
        part.staffDays += days;
        part.baseSalaryAmount = Math.round(part.staffDays * (employee.staffDailyRate ?? 0));
      }
      for (const item of employeeLines) {
        const part = ensure(item.payrollRun?.branchId ?? employee.branchId);
        part.adjustmentAmount +=
          item.otAmount +
          item.kpiBonus +
          item.assistantRatingBonus +
          item.parkingAllowance +
          item.supportAllowance +
          item.bonus +
          item.holidayBonus -
          item.penalty -
          item.socialInsuranceDeduction -
          item.utilityDeduction -
          item.otherDeduction;
      }
      branchBreakdown = [...byBranch.values()]
        .map((part) => ({
          ...part,
          totalAmount: part.teachingAmount + part.assistantAmount + part.baseSalaryAmount + part.adjustmentAmount,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);
    }


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
      // Công và tiền công LUÔN tính từ dữ liệu thật của tháng (buổi dạy/trợ giảng đã
      // dạy + ngày chấm công), không bao giờ lấy số đóng băng trên dòng lương: tháng
      // nào mở ra cũng thấy đúng số hiện tại, không phải bấm "tính lại lương" mới đúng.
      teachingHours: teaching.hours,
      teachingAmount: teaching.amount,
      assistantHours: assistant.hours,
      assistantAmount: assistant.amount,
      staffDays: timesheet.days,
      staffHours: timesheet.hours,
      baseSalaryAmount: liveBaseSalaryAmount,
      otHours: adj.otHours,
      otAmount: adj.otAmount,
      kpiBonus: adj.kpiBonus,
      assistantRatingBonus: adj.assistantRatingBonus,
      parkingAllowance: adj.parkingAllowance,
      supportAllowance: adj.supportAllowance,
      bonus: adj.bonus,
      penalty: adj.penalty,
      socialInsuranceDeduction: adj.socialInsuranceDeduction,
      utilityDeduction: adj.utilityDeduction,
      holidayBonus: adj.holidayBonus,
      otherDeduction: adj.otherDeduction,
      notes: line?.notes ?? null,
      // Tổng = tiền công thực tế + các khoản nhập tay của tháng (nếu có). Ở màn tổng
      // hợp, đây đúng bằng tổng các phần trong branchBreakdown.
      totalAmount: teaching.amount + assistant.amount + liveBaseSalaryAmount + adjustmentNet,
      sessionCount: teaching.sessions + assistant.sessions,
      timesheetEntryCount: timesheet.entries,
      lineId: line ? line.id : null,
      hasMismatch: false,
      hasRateIssue,
      ratingBonusPercent: bonusByEmployee.get(employee.id) ?? null,
      primaryBranchId: employee.branchId,
      branchIds,
      branchBreakdown,
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
