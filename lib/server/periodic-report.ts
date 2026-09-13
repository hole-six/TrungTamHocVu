// BÁO CÁO TUẦN / THÁNG của 1 cơ sở — dựng lại đúng bố cục file báo cáo trung tâm đang
// làm tay bằng Excel pivot ("BÁO CÁO TUẦN CS6 tuần 36", "Báo cáo tháng 8.2026"):
//   1. Học phí theo lớp   2. Biến động học sinh (danh sách test, đang học / nghỉ / nhập học)
//   3. Thu – chi          4. Dự kiến thu tháng sau (chỉ báo cáo tháng)
// Mọi con số lấy thẳng từ dữ liệu vận hành (phiếu học phí, phiếu thu, lead, ghi danh, sổ
// quỹ) — không còn copy-paste pivot, không còn dòng "#VALUE!" / "(blank)".
import { prisma } from "@/lib/prisma";
import { chargeOwnDueAmount, computeEffectiveUnitPrice, monthKey } from "@/lib/server/tuition-rules";
import { getVietnamToday } from "@/lib/server/class-rules";
import { resolveEnrollmentUnitPrice } from "@/lib/server/enrollment-learning";

export type ReportKind = "week" | "month";

const DAY_MS = 86_400_000;
const EXCLUDED_PAYMENT_STATUSES = ["VOIDED", "REFUNDED"];

function utcDay(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d));
}
function endOfUtcDay(date: Date) {
  return new Date(date.getTime() + DAY_MS - 1);
}
function monthStartOf(date: Date) {
  return utcDay(date.getUTCFullYear(), date.getUTCMonth(), 1);
}
function monthEndOf(date: Date) {
  return endOfUtcDay(utcDay(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}
// Tuần theo chuẩn ISO (thứ 2 → chủ nhật) — "Tuần 36" trong báo cáo trung tâm là số tuần ISO.
export function isoWeek(date: Date) {
  const d = utcDay(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = utcDay(d.getUTCFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export type ReportRange = {
  kind: ReportKind;
  start: Date;
  end: Date;
  weekNumber: number | null;
  // Tháng dùng cho khối học phí: tháng của báo cáo tháng, hoặc tháng chứa CHỦ NHẬT của tuần.
  tuitionMonthStart: Date;
  tuitionMonthEnd: Date;
  periodName: string;
  prevParam: string;
  nextParam: string;
  param: string;
};

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveReportRange(kind: ReportKind, param: string | undefined, today: Date = getVietnamToday()): ReportRange {
  if (kind === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(param ?? "");
    const base = match ? utcDay(Number(match[1]), Number(match[2]) - 1, 1) : utcDay(today.getUTCFullYear(), today.getUTCMonth(), 1);
    const start = monthStartOf(base);
    const end = monthEndOf(base);
    return {
      kind,
      start,
      end,
      weekNumber: null,
      tuitionMonthStart: start,
      tuitionMonthEnd: end,
      periodName: monthKey(start),
      prevParam: monthKey(utcDay(start.getUTCFullYear(), start.getUTCMonth() - 1, 1)),
      nextParam: monthKey(utcDay(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)),
      param: monthKey(start),
    };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(param ?? "");
  const anchor = match ? utcDay(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : today;
  const start = new Date(anchor.getTime() - ((anchor.getUTCDay() + 6) % 7) * DAY_MS);
  const sunday = new Date(start.getTime() + 6 * DAY_MS);
  return {
    kind,
    start,
    end: endOfUtcDay(sunday),
    weekNumber: isoWeek(start),
    tuitionMonthStart: monthStartOf(sunday),
    tuitionMonthEnd: monthEndOf(sunday),
    periodName: monthKey(sunday),
    prevParam: ymd(new Date(start.getTime() - 7 * DAY_MS)),
    nextParam: ymd(new Date(start.getTime() + 7 * DAY_MS)),
    param: ymd(start),
  };
}

export function paymentMethodLabel(method: string | null) {
  const value = (method ?? "").trim().toLowerCase();
  if (!value) return "Không ghi";
  if (["bank", "transfer", "ck", "chuyển khoản", "chuyen khoan", "banking"].includes(value)) return "Chuyển khoản";
  if (["cash", "tm", "tiền mặt", "tien mat"].includes(value)) return "Tiền mặt";
  return method!.trim();
}

function ageAt(dob: Date | null, at: Date) {
  if (!dob) return null;
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  if (at.getUTCMonth() < dob.getUTCMonth() || (at.getUTCMonth() === dob.getUTCMonth() && at.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

export async function buildPeriodicReport(params: { branchId: string | null; range: ReportRange }) {
  const { branchId, range } = params;
  const branchWhere = branchId ? { branchId } : {};
  const classBranchWhere = branchId ? { class: { branchId } } : {};
  const monthStart = range.tuitionMonthStart;
  const monthEnd = range.tuitionMonthEnd;
  // Tiền nộp tính LŨY KẾ từ đầu tháng tới hết kỳ báo cáo — báo cáo tuần giữa tháng vẫn trừ
  // đúng những gì phụ huynh đã đóng cho tháng đó từ ngày 1 (không chỉ riêng tuần này).
  const paidTo = range.end < monthEnd ? range.end : monthEnd;

  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : null;

  // ---------------------------------------------------------------- 1. HỌC PHÍ THEO LỚP
  const [classes, sessionCounts, monthCharges, priorCharges, paymentsBeforeMonth, paymentsInMonth, discountCredits, activeEnrollments] =
    await Promise.all([
      prisma.class.findMany({
        where: { ...branchWhere, isRemedial: false },
        select: { id: true, classCode: true, className: true, totalSessions: true, tuitionPerSession: true },
      }),
      prisma.classSession.groupBy({
        by: ["classId"],
        where: { ...classBranchWhere, status: { notIn: ["CANCELLED", "RESCHEDULED"] }, sessionDate: { gte: monthStart, lte: monthEnd } },
        _count: true,
      }),
      prisma.charge.findMany({
        where: { ...classBranchWhere, billingPeriod: { periodName: monthKey(monthStart) } },
        select: { studentId: true, classId: true, tuitionAmount: true, materialsAmount: true },
      }),
      prisma.charge.findMany({
        where: { ...classBranchWhere, billingPeriod: { startDate: { lt: monthStart } } },
        select: { studentId: true, tuitionAmount: true, materialsAmount: true },
      }),
      prisma.payment.findMany({
        where: { status: { notIn: EXCLUDED_PAYMENT_STATUSES }, paidDate: { lt: monthStart }, student: branchWhere },
        select: { studentId: true, amount: true },
      }),
      prisma.payment.findMany({
        where: { status: { notIn: EXCLUDED_PAYMENT_STATUSES }, paidDate: { gte: monthStart, lte: paidTo }, student: branchWhere },
        select: { studentId: true, amount: true },
      }),
      // Chiết khấu tiền mặt giảm nợ bằng CreditBalance (không phải tiền nộp) — phải trừ
      // vào tồn, nếu không học viên được giảm giá hiện như vẫn còn nợ.
      prisma.creditBalance.findMany({
        where: { paymentId: { not: null }, createdAt: { lt: monthStart }, student: branchWhere },
        select: { studentId: true, amount: true },
      }),
      prisma.enrollment.findMany({
        where: { ...classBranchWhere, status: { in: ["ACTIVE", "PAUSED"] }, class: { isRemedial: false, ...(branchId ? { branchId } : {}) } },
        select: { studentId: true, classId: true, enrollDate: true },
        orderBy: { enrollDate: "desc" },
      }),
    ]);

  const classById = new Map(classes.map((item) => [item.id, item]));
  // Mỗi học viên được tính về ĐÚNG 1 lớp: lớp có phiếu tháng lớn nhất, không có thì lớp đang
  // học gần nhất. Học viên học 2 lớp không bị cộng tồn/tiền nộp 2 lần.
  const primaryClassByStudent = new Map<string, string>();
  const monthChargeTop = new Map<string, number>();
  for (const charge of monthCharges) {
    const amount = charge.tuitionAmount + charge.materialsAmount;
    if (!primaryClassByStudent.has(charge.studentId) || amount > (monthChargeTop.get(charge.studentId) ?? -1)) {
      primaryClassByStudent.set(charge.studentId, charge.classId);
      monthChargeTop.set(charge.studentId, amount);
    }
  }
  for (const enrollment of activeEnrollments) {
    if (enrollment.classId && !primaryClassByStudent.has(enrollment.studentId)) primaryClassByStudent.set(enrollment.studentId, enrollment.classId);
  }

  type TuitionRow = {
    classId: string;
    classCode: string;
    className: string;
    sessionsInMonth: number;
    materials: number;
    carriedBalance: number;
    tuitionTotal: number;
    paid: number;
    remaining: number;
    cumulative: number;
    studentCount: number;
  };
  const tuitionRows = new Map<string, TuitionRow>();
  const ensureRow = (classId: string) => {
    let row = tuitionRows.get(classId);
    if (!row) {
      const cls = classById.get(classId);
      row = {
        classId,
        classCode: cls?.classCode ?? "—",
        className: cls?.className ?? "Lớp đã xóa",
        sessionsInMonth: 0,
        materials: 0,
        carriedBalance: 0,
        tuitionTotal: 0,
        paid: 0,
        remaining: 0,
        cumulative: 0,
        studentCount: 0,
      };
      tuitionRows.set(classId, row);
    }
    return row;
  };
  for (const item of sessionCounts) if (classById.has(item.classId)) ensureRow(item.classId).sessionsInMonth = item._count;
  const studentsPerClass = new Map<string, Set<string>>();
  for (const charge of monthCharges) {
    const row = ensureRow(charge.classId);
    row.materials += charge.materialsAmount;
    row.tuitionTotal += charge.tuitionAmount + charge.materialsAmount;
    if (!studentsPerClass.has(charge.classId)) studentsPerClass.set(charge.classId, new Set());
    studentsPerClass.get(charge.classId)!.add(charge.studentId);
  }
  const balanceBefore = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) ?? 0) + value);
  for (const charge of priorCharges) add(balanceBefore, charge.studentId, chargeOwnDueAmount(charge));
  for (const payment of paymentsBeforeMonth) add(balanceBefore, payment.studentId, -payment.amount);
  for (const credit of discountCredits) add(balanceBefore, credit.studentId, -credit.amount);
  for (const [studentId, balance] of balanceBefore) {
    const classId = primaryClassByStudent.get(studentId);
    if (classId && balance !== 0) ensureRow(classId).carriedBalance += balance;
  }
  for (const payment of paymentsInMonth) {
    const classId = primaryClassByStudent.get(payment.studentId);
    if (classId) ensureRow(classId).paid += payment.amount;
  }
  const tuitionByClass = [...tuitionRows.values()]
    .filter((row) => row.tuitionTotal !== 0 || row.paid !== 0 || row.carriedBalance !== 0 || studentsPerClass.has(row.classId))
    .map((row) => {
      const remaining = row.tuitionTotal - row.paid;
      return { ...row, remaining, cumulative: row.carriedBalance + remaining, studentCount: studentsPerClass.get(row.classId)?.size ?? 0 };
    })
    .sort((a, b) => a.className.localeCompare(b.className, "vi"));
  const tuitionTotals = tuitionByClass.reduce(
    (acc, row) => ({
      sessionsInMonth: Math.max(acc.sessionsInMonth, row.sessionsInMonth),
      materials: acc.materials + row.materials,
      carriedBalance: acc.carriedBalance + row.carriedBalance,
      tuitionTotal: acc.tuitionTotal + row.tuitionTotal,
      paid: acc.paid + row.paid,
      remaining: acc.remaining + row.remaining,
      cumulative: acc.cumulative + row.cumulative,
      studentCount: acc.studentCount + row.studentCount,
    }),
    { sessionsInMonth: 0, materials: 0, carriedBalance: 0, tuitionTotal: 0, paid: 0, remaining: 0, cumulative: 0, studentCount: 0 },
  );

  // ---------------------------------------------------------------- 2A. DANH SÁCH TEST
  const leads = await prisma.lead.findMany({
    where: {
      ...branchWhere,
      OR: [
        { meetDate: { gte: range.start, lte: range.end } },
        { meetDate: null, createdAt: { gte: range.start, lte: range.end } },
      ],
    },
    include: {
      guardian: { select: { fullName: true, phone: true } },
      interestedClass: { select: { classCode: true, className: true } },
      placementTests: { orderBy: { createdAt: "desc" }, take: 1 },
      student: { select: { studentCode: true } },
    },
    orderBy: [{ meetDate: "asc" }, { createdAt: "asc" }],
  });
  const testList = leads.map((lead) => {
    const test = lead.placementTests[0];
    const meet = lead.meetDate ?? lead.createdAt;
    return {
      id: lead.id,
      meetDate: meet.toISOString(),
      fullName: lead.fullName,
      dob: lead.dob?.toISOString() ?? null,
      age: ageAt(lead.dob, meet),
      schoolGrade: lead.currentSchoolGrade,
      guardianName: lead.guardian?.fullName ?? null,
      phone: lead.phone ?? lead.guardian?.phone ?? null,
      testDate: (test?.testDate ?? test?.scheduledDate)?.toISOString() ?? null,
      expectedClass: lead.interestedClass?.classCode ?? test?.suggestedClass ?? null,
      expectedStartDate: lead.expectedStartDate?.toISOString() ?? null,
      actualEnrollDate: lead.actualEnrollDate?.toISOString() ?? null,
      studentCode: lead.student?.studentCode ?? null,
      status: lead.status,
      notes: [lead.notes, lead.notes2].filter(Boolean).join(" · ") || null,
    };
  });

  // ---------------------------------------------------------------- 2B. BIẾN ĐỘNG HỌC SINH
  const [enrollmentsAtEnd, endedInRange, newInRange, transfersInRange] = await Promise.all([
    // Đang theo học TÍNH TỚI cuối kỳ (không phải hôm nay) — xem lại báo cáo tuần cũ vẫn ra đúng.
    prisma.enrollment.findMany({
      where: {
        ...classBranchWhere,
        class: { isRemedial: false, ...(branchId ? { branchId } : {}) },
        status: { notIn: ["PENDING", "CANCELLED"] },
        enrollDate: { lte: range.end },
        OR: [{ endDate: null }, { endDate: { gt: range.end } }],
      },
      select: { classId: true, studentId: true },
    }),
    prisma.enrollment.findMany({
      where: {
        class: { isRemedial: false, ...(branchId ? { branchId } : {}) },
        status: "WITHDRAWN",
        endDate: { gte: range.start, lte: range.end },
      },
      select: { classId: true, student: { select: { fullName: true, studentCode: true } }, endDate: true },
    }),
    prisma.enrollment.findMany({
      where: {
        class: { isRemedial: false, ...(branchId ? { branchId } : {}) },
        enrollDate: { gte: range.start, lte: range.end },
        pricingBasis: { not: "CONTINUATION_TRANSFER" },
        status: { notIn: ["CANCELLED"] },
      },
      select: { classId: true, enrollDate: true, billingModel: true, student: { select: { fullName: true, studentCode: true } } },
    }),
    prisma.enrollment.findMany({
      where: {
        class: { isRemedial: false, ...(branchId ? { branchId } : {}) },
        enrollDate: { gte: range.start, lte: range.end },
        pricingBasis: "CONTINUATION_TRANSFER",
      },
      select: {
        classId: true,
        enrollDate: true,
        student: { select: { fullName: true, studentCode: true } },
        transferredFrom: { select: { class: { select: { classCode: true } } } },
      },
    }),
  ]);
  const countByClass = (rows: Array<{ classId: string | null }>) => {
    const map = new Map<string, number>();
    for (const row of rows) if (row.classId) map.set(row.classId, (map.get(row.classId) ?? 0) + 1);
    return [...map.entries()]
      .map(([classId, count]) => ({ classId, classCode: classById.get(classId)?.classCode ?? "—", className: classById.get(classId)?.className ?? "—", count }))
      .sort((a, b) => a.classCode.localeCompare(b.classCode, "vi"));
  };
  const uniqueActive = new Map<string, { classId: string | null }>();
  for (const row of enrollmentsAtEnd) uniqueActive.set(`${row.studentId}:${row.classId}`, row);
  const movement = {
    activeByClass: countByClass([...uniqueActive.values()]),
    activeStudentTotal: new Set(enrollmentsAtEnd.map((row) => row.studentId)).size,
    leftByClass: countByClass(endedInRange),
    left: endedInRange.map((row) => ({
      fullName: row.student.fullName,
      studentCode: row.student.studentCode,
      classCode: row.classId ? classById.get(row.classId)?.classCode ?? "—" : "—",
      date: row.endDate?.toISOString() ?? null,
    })),
    newByClass: countByClass(newInRange),
    newEnrollments: newInRange.map((row) => ({
      fullName: row.student.fullName,
      studentCode: row.student.studentCode,
      classCode: row.classId ? classById.get(row.classId)?.classCode ?? "—" : "—",
      date: row.enrollDate.toISOString(),
      billingModel: row.billingModel,
    })),
    transfers: transfersInRange.map((row) => ({
      fullName: row.student.fullName,
      studentCode: row.student.studentCode,
      fromClass: row.transferredFrom?.class?.classCode ?? "—",
      toClass: row.classId ? classById.get(row.classId)?.classCode ?? "—" : "—",
      date: row.enrollDate.toISOString(),
    })),
  };

  // ---------------------------------------------------------------- 3. THU – CHI
  const [expenses, rangePayments, otherIncome] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: { ...branchWhere, type: "CHI", status: "CONFIRMED", txnDate: { gte: range.start, lte: range.end } },
      include: { category: { select: { name: true, detail: true } } },
      orderBy: { txnDate: "asc" },
    }),
    prisma.payment.findMany({
      where: { status: { notIn: EXCLUDED_PAYMENT_STATUSES }, paidDate: { gte: range.start, lte: range.end }, student: branchWhere },
      select: { amount: true, method: true, paidDate: true, receivedById: true, paymentNo: true, student: { select: { fullName: true, studentCode: true } } },
      orderBy: { paidDate: "asc" },
    }),
    // Thu KHÔNG phải học phí (bán sách lẻ, thu khác...) — phiếu thu học phí đã có ở trên.
    prisma.cashTransaction.findMany({
      where: { ...branchWhere, type: "THU", status: "CONFIRMED", txnDate: { gte: range.start, lte: range.end }, paymentPostings: { none: {} } },
      include: { category: { select: { name: true } } },
      orderBy: { txnDate: "asc" },
    }),
  ]);
  const userIds = [
    ...new Set(
      [...expenses.map((item) => item.handledById), ...rangePayments.map((item) => item.receivedById), ...otherIncome.map((item) => item.handledById)].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
  const userName = (id: string | null) => (id ? users.find((user) => user.id === id)?.fullName ?? "—" : "Không ghi");

  const expenseRows = expenses.map((item) => ({
    date: item.txnDate.toISOString(),
    week: isoWeek(item.txnDate),
    category: item.category?.name ?? "Chưa phân loại",
    categoryDetail: item.category?.detail ?? item.detail ?? "—",
    description: item.description ?? item.notes ?? "",
    amount: item.amount,
    handler: userName(item.handledById),
  }));
  const groupSum = <T,>(rows: T[], key: (row: T) => string, value: (row: T) => number) => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + value(row));
    return [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  };
  const expenseByWeek = [...new Set(expenseRows.map((row) => row.week))]
    .sort((a, b) => a - b)
    .map((week) => {
      const rows = expenseRows.filter((row) => row.week === week);
      return {
        week,
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        categories: groupSum(rows, (row) => row.category, (row) => row.amount).map((cat) => ({
          ...cat,
          details: groupSum(rows.filter((row) => row.category === cat.label), (row) => row.categoryDetail, (row) => row.amount),
        })),
      };
    });

  const incomeRows = rangePayments.map((item) => ({
    date: item.paidDate.toISOString(),
    week: isoWeek(item.paidDate),
    method: paymentMethodLabel(item.method),
    receiver: userName(item.receivedById),
    amount: item.amount,
    paymentNo: item.paymentNo,
    student: `${item.student.fullName} (${item.student.studentCode})`,
  }));
  const incomeMethods = [...new Set(incomeRows.map((row) => row.method))].sort();
  const incomeByWeek = [...new Set(incomeRows.map((row) => row.week))]
    .sort((a, b) => a - b)
    .map((week) => {
      const rows = incomeRows.filter((row) => row.week === week);
      const receivers = [...new Set(rows.map((row) => row.receiver))].map((receiver) => ({
        receiver,
        byMethod: Object.fromEntries(incomeMethods.map((method) => [method, rows.filter((r) => r.receiver === receiver && r.method === method).reduce((s, r) => s + r.amount, 0)])),
        total: rows.filter((r) => r.receiver === receiver).reduce((s, r) => s + r.amount, 0),
      }));
      return {
        week,
        byMethod: Object.fromEntries(incomeMethods.map((method) => [method, rows.filter((r) => r.method === method).reduce((s, r) => s + r.amount, 0)])),
        total: rows.reduce((s, r) => s + r.amount, 0),
        receivers,
      };
    });

  const cashFlow = {
    expenseRows,
    expenseTotal: expenseRows.reduce((sum, row) => sum + row.amount, 0),
    expenseByWeek,
    expenseByCategory: groupSum(expenseRows, (row) => row.category, (row) => row.amount),
    expenseByHandler: groupSum(expenseRows, (row) => row.handler, (row) => row.amount),
    incomeRows,
    incomeMethods,
    incomeByWeek,
    incomeTotal: incomeRows.reduce((sum, row) => sum + row.amount, 0),
    incomeByMethod: groupSum(incomeRows, (row) => row.method, (row) => row.amount),
    otherIncome: otherIncome.map((item) => ({
      date: item.txnDate.toISOString(),
      category: item.category?.name ?? "Thu khác",
      description: item.description ?? item.detail ?? "",
      amount: item.amount,
      handler: userName(item.handledById),
    })),
  };

  // ---------------------------------------------------------------- 4. DỰ KIẾN THU THÁNG SAU
  const forecast = range.kind === "month" ? await buildForecast({ branchId, monthStart, monthEnd }) : null;

  return {
    branchName: branch?.name ?? "Tất cả cơ sở",
    range: {
      kind: range.kind,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      weekNumber: range.weekNumber,
      periodName: range.periodName,
      tuitionMonthStart: monthStart.toISOString(),
      paidTo: paidTo.toISOString(),
      prevParam: range.prevParam,
      nextParam: range.nextParam,
      param: range.param,
    },
    tuition: { rows: tuitionByClass, totals: tuitionTotals },
    tests: testList,
    movement,
    cashFlow,
    forecast,
    generatedAt: new Date().toISOString(),
  };
}

async function buildForecast(params: { branchId: string | null; monthStart: Date; monthEnd: Date }) {
  const { branchId, monthStart, monthEnd } = params;
  const nextStart = utcDay(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1);
  const nextEnd = monthEndOf(nextStart);
  const nextPeriodName = monthKey(nextStart);
  const today = getVietnamToday();

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", class: { isRemedial: false, ...(branchId ? { branchId } : {}) } },
    include: {
      class: { include: { course: true } },
      student: { select: { id: true, fullName: true, studentCode: true } },
      wallet: { select: { balance: true } },
      scholarships: { where: { effectiveFrom: { lte: nextEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: nextStart } }] } },
    },
  });
  const studentIds = [...new Set(enrollments.map((item) => item.studentId))];
  const classIds = [...new Set(enrollments.map((item) => item.classId).filter((id): id is string => !!id))];
  const [nextSessions, remainingThisMonth, charges, payments, credits, unpaidBooks, nextCharges, billedPeriod] = await Promise.all([
    prisma.classSession.groupBy({
      by: ["classId"],
      where: { classId: { in: classIds }, status: { notIn: ["CANCELLED", "RESCHEDULED"] }, sessionDate: { gte: nextStart, lte: nextEnd } },
      _count: true,
    }),
    // Buổi CÒN LẠI của tháng báo cáo chưa dạy — sẽ còn trừ ví trước khi sang tháng sau.
    prisma.classSession.groupBy({
      by: ["classId"],
      where: {
        classId: { in: classIds },
        status: { notIn: ["CANCELLED", "RESCHEDULED", "COMPLETED"] },
        sessionDate: { gte: today > monthStart ? today : monthStart, lte: monthEnd },
      },
      _count: true,
    }),
    prisma.charge.findMany({
      where: { studentId: { in: studentIds }, billingPeriod: { startDate: { lte: monthEnd } } },
      select: { studentId: true, tuitionAmount: true, materialsAmount: true },
    }),
    prisma.payment.findMany({
      where: { studentId: { in: studentIds }, status: { notIn: EXCLUDED_PAYMENT_STATUSES }, paidDate: { lte: monthEnd } },
      select: { studentId: true, amount: true },
    }),
    prisma.creditBalance.findMany({ where: { studentId: { in: studentIds }, paymentId: { not: null }, createdAt: { lte: monthEnd } }, select: { studentId: true, amount: true } }),
    prisma.bookIssue.findMany({
      where: { studentId: { in: studentIds }, paymentStatus: { not: "PAID" }, chargeId: null },
      select: { studentId: true, classId: true, amount: true },
    }),
    prisma.charge.findMany({
      where: { studentId: { in: studentIds }, billingPeriod: { periodName: nextPeriodName } },
      select: { enrollmentId: true, studentId: true, classId: true, sessionCount: true, tuitionAmount: true, materialsAmount: true },
    }),
    prisma.charge.groupBy({
      by: ["enrollmentId"],
      where: { enrollmentId: { in: enrollments.map((item) => item.id) }, billingModel: "PERIOD", billingPeriod: { startDate: { lt: nextStart } } },
      _sum: { sessionCount: true },
    }),
  ]);
  const count = (rows: Array<{ classId: string; _count: number }>, id: string | null) => (id ? rows.find((row) => row.classId === id)?._count ?? 0 : 0);
  const balance = new Map<string, number>();
  const add = (key: string, value: number) => balance.set(key, (balance.get(key) ?? 0) + value);
  for (const charge of charges) add(charge.studentId, chargeOwnDueAmount(charge));
  for (const payment of payments) add(payment.studentId, -payment.amount);
  for (const credit of credits) add(credit.studentId, -credit.amount);

  const openingUsed = new Set<string>();
  const rows = enrollments
    .map((enrollment) => {
      const scholarshipPct = enrollment.scholarships.reduce((sum, item) => sum + item.percentage, 0);
      const unitPrice = computeEffectiveUnitPrice(resolveEnrollmentUnitPrice(enrollment), scholarshipPct, 0);
      const existing = nextCharges.find((charge) => charge.enrollmentId === enrollment.id || (charge.studentId === enrollment.studentId && charge.classId === enrollment.classId));
      let sessions = 0;
      let tuition = 0;
      let carried = 0;
      if (existing) {
        sessions = existing.sessionCount;
        tuition = existing.tuitionAmount;
      } else if (enrollment.billingModel === "PERIOD") {
        const walletAtMonthEnd = (enrollment.wallet?.balance ?? 0) - count(remainingThisMonth, enrollment.classId);
        carried = Math.max(0, walletAtMonthEnd);
        sessions = Math.max(0, count(nextSessions, enrollment.classId) - carried);
        if (enrollment.periodCourseSessionCount != null) {
          const billed = billedPeriod.find((row) => row.enrollmentId === enrollment.id)?._sum.sessionCount ?? 0;
          sessions = Math.min(sessions, Math.max(0, enrollment.periodCourseSessionCount - billed));
        }
        tuition = sessions * unitPrice;
      }
      // Nợ/dư đầu kỳ là của HỌC VIÊN, không phải từng lớp — chỉ gắn vào dòng đầu tiên.
      const opening = openingUsed.has(enrollment.studentId) ? 0 : balance.get(enrollment.studentId) ?? 0;
      openingUsed.add(enrollment.studentId);
      const materials =
        (existing?.materialsAmount ?? 0) +
        unpaidBooks.filter((book) => book.studentId === enrollment.studentId && book.classId === enrollment.classId).reduce((sum, book) => sum + book.amount, 0);
      return {
        classCode: enrollment.class?.classCode ?? "—",
        className: enrollment.class?.className ?? "—",
        studentName: enrollment.student.fullName,
        studentCode: enrollment.student.studentCode,
        billingModel: enrollment.billingModel,
        sessions,
        carried,
        unitPrice,
        scholarshipPct: Math.round(scholarshipPct * 100),
        opening,
        tuition,
        materials,
        total: opening + tuition + materials,
        fromCharge: Boolean(existing),
      };
    })
    .filter((row) => row.billingModel === "PERIOD" || row.opening !== 0 || row.materials !== 0)
    .sort((a, b) => a.classCode.localeCompare(b.classCode, "vi") || a.studentName.localeCompare(b.studentName, "vi"));

  return {
    periodName: nextPeriodName,
    rows,
    totals: rows.reduce(
      (acc, row) => ({
        students: acc.students + 1,
        opening: acc.opening + row.opening,
        tuition: acc.tuition + row.tuition,
        materials: acc.materials + row.materials,
        total: acc.total + row.total,
      }),
      { students: 0, opening: 0, tuition: 0, materials: 0, total: 0 },
    ),
  };
}

export type PeriodicReport = Awaited<ReturnType<typeof buildPeriodicReport>>;
