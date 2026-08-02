import { PrismaClient } from "@prisma/client";
import { ensureBillingPeriod, generateChargesForPeriod, generateCourseCharge } from "../lib/server/billing-generation";

const prisma = new PrismaClient();

const TAG = "[STRESS-TUITION-Q3-2026]";
const BRANCH_CODE = "CS1";
const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"] as const;

type Scenario = {
  studentCode: string;
  fullName: string;
  guardianName: string;
  phone: string;
  classCode: string;
  billingModel: "PERIOD" | "COURSE" | "INSTALLMENT";
  enrollDate: string;
  scholarshipPct?: number;
  adjustmentPct?: number;
};

function ymd(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function periodRange(periodName: string) {
  const [year, month] = periodName.split("-").map(Number);
  return {
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

function invoiceNo(periodName: string, studentCode: string, classCode: string) {
  return `INV-ST-${periodName.replace("-", "")}-${studentCode.slice(-3)}-${classCode.slice(-2)}`;
}

function paymentNo(periodName: string, studentCode: string, suffix: string) {
  return `PAY-ST-${periodName.replace("-", "")}-${studentCode.slice(-3)}-${suffix}`;
}

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

async function ensureBranch() {
  let branch = await prisma.branch.findUnique({ where: { code: BRANCH_CODE } });
  if (!branch) {
    const organization =
      (await prisma.organization.findFirst({ where: { name: "Stress Tuition Org" } })) ??
      (await prisma.organization.create({ data: { name: "Stress Tuition Org", phone: "0900000000" } }));

    branch = await prisma.branch.create({
      data: {
        organizationId: organization.id,
        code: BRANCH_CODE,
        name: "Cơ sở 1",
        address: "Stress dataset branch",
        phone: "0900000000",
      },
    });
  }

  return branch;
}

async function ensureOperator(branchId: string) {
  const existing = await prisma.employee.findFirst({
    where: { branchId, workStatus: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.employee.create({
    data: {
      branchId,
      employeeCode: "EMP-STRESS-OPS",
      fullName: "Stress Ops",
      shortName: "S.Ops",
      position: "Kế toán",
      payMode: "MONTHLY",
      workStatus: "ACTIVE",
      email: "stress.ops@local.test",
    },
  });
}

async function ensurePaymentProfile(branchId: string) {
  await prisma.branchPaymentProfile.upsert({
    where: { branchId },
    update: {
      bankName: "Vietcombank",
      accountNumber: "1063597462",
      accountHolder: "Cong ty CP TM va PT giao duc Bao Hung",
      paymentInstruction: "Phụ huynh chuyển khoản xong vui lòng gửi xác nhận cho giáo vụ để đối soát nhanh.",
    },
    create: {
      branchId,
      bankName: "Vietcombank",
      accountNumber: "1063597462",
      accountHolder: "Cong ty CP TM va PT giao duc Bao Hung",
      paymentInstruction: "Phụ huynh chuyển khoản xong vui lòng gửi xác nhận cho giáo vụ để đối soát nhanh.",
    },
  });
}

async function ensureCourse(branchId: string, data: { code: string; name: string; tuitionPerSession: number; sessionsPerWeek: number }) {
  return prisma.course.upsert({
    where: { branchId_code: { branchId, code: data.code } },
    update: {
      name: data.name,
      tuitionPerSession: data.tuitionPerSession,
      sessionsPerWeek: data.sessionsPerWeek,
      isActive: true,
    },
    create: {
      branchId,
      code: data.code,
      name: data.name,
      tuitionPerSession: data.tuitionPerSession,
      sessionsPerWeek: data.sessionsPerWeek,
      isActive: true,
    },
  });
}

async function ensureClass(data: {
  branchId: string;
  courseId?: string | null;
  classCode: string;
  classGroup?: string;
  className: string;
  totalSessions?: number | null;
  startDate?: string | null;
  expectedEndDate?: string | null;
  sessionsPerWeek?: number | null;
  tuitionPerSession?: number | null;
  status?: string;
  isRemedial?: boolean;
}) {
  return prisma.class.upsert({
    where: { classCode: data.classCode },
    update: {
      branchId: data.branchId,
      courseId: data.courseId ?? null,
      classGroup: data.classGroup ?? null,
      className: data.className,
      totalSessions: data.totalSessions ?? null,
      startDate: data.startDate ? ymd(data.startDate) : null,
      expectedEndDate: data.expectedEndDate ? ymd(data.expectedEndDate) : null,
      sessionsPerWeek: data.sessionsPerWeek ?? null,
      tuitionPerSession: data.tuitionPerSession ?? null,
      status: data.status ?? "ACTIVE",
      isRemedial: data.isRemedial ?? false,
      notes: TAG,
    },
    create: {
      branchId: data.branchId,
      courseId: data.courseId ?? null,
      classCode: data.classCode,
      classGroup: data.classGroup ?? null,
      className: data.className,
      totalSessions: data.totalSessions ?? null,
      startDate: data.startDate ? ymd(data.startDate) : null,
      expectedEndDate: data.expectedEndDate ? ymd(data.expectedEndDate) : null,
      sessionsPerWeek: data.sessionsPerWeek ?? null,
      tuitionPerSession: data.tuitionPerSession ?? null,
      status: data.status ?? "ACTIVE",
      isRemedial: data.isRemedial ?? false,
      notes: TAG,
    },
  });
}

async function ensureScheduleRule(classId: string, weekday: number, startTime: string, endTime: string, room: string) {
  const existing = await prisma.scheduleRule.findFirst({ where: { classId, weekday, startTime, endTime } });
  if (existing) return existing;
  return prisma.scheduleRule.create({ data: { classId, weekday, startTime, endTime, room } });
}

async function ensureBook(branchId: string, bookCode: string, name: string, category: string, unitPrice: number, quantityOnHand = 120) {
  const existing = await prisma.book.findFirst({ where: { branchId, bookCode } });
  if (existing) {
    return prisma.book.update({
      where: { id: existing.id },
      data: { name, category, unitPrice, quantityOnHand: Math.max(existing.quantityOnHand, quantityOnHand), notes: TAG },
    });
  }

  return prisma.book.create({
    data: {
      branchId,
      bookCode,
      name,
      category,
      unitPrice,
      quantityOnHand,
      notes: TAG,
    },
  });
}

async function ensureStockLocation(branchId: string) {
  const existing = await prisma.stockLocation.findFirst({ where: { branchId, name: "Kho stress tuition" } });
  if (existing) return existing;
  return prisma.stockLocation.create({ data: { branchId, name: "Kho stress tuition" } });
}

function listSessionDates(start: string, end: string, weekdays: number[]) {
  const result: Date[] = [];
  const cursor = ymd(start);
  const endDate = ymd(end);

  while (cursor <= endDate) {
    if (weekdays.includes(cursor.getUTCDay())) {
      result.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

async function ensureSessionsForClass(classId: string, start: string, end: string, weekdays: number[], startTime: string, endTime: string, room: string) {
  const dates = listSessionDates(start, end, weekdays);
  const sessions: Awaited<ReturnType<typeof prisma.classSession.create>>[] = [];

  for (const sessionDate of dates) {
    const existing = await prisma.classSession.findFirst({ where: { classId, sessionDate, startTime } });
    const session =
      existing ??
      (await prisma.classSession.create({
        data: {
          classId,
          sessionDate,
          startTime,
          endTime,
          room,
          status: "COMPLETED",
          completedAt: new Date(sessionDate.getTime() + 90 * 60 * 1000),
          notes: TAG,
        },
      }));
    sessions.push(session);
  }

  return sessions;
}

async function ensureGuardianStudentLead(branchId: string, scenario: Scenario, classId: string) {
  const guardian =
    (await prisma.guardian.findFirst({ where: { fullName: scenario.guardianName, phone: scenario.phone } })) ??
    (await prisma.guardian.create({
      data: {
        fullName: scenario.guardianName,
        phone: scenario.phone,
        address: "TP.HCM",
        notes: TAG,
      },
    }));

  const lead = await prisma.lead.upsert({
    where: { leadCode: `LEAD-${scenario.studentCode}` },
    update: {
      fullName: scenario.fullName,
      guardianId: guardian.id,
      phone: scenario.phone,
      interestedClassId: classId,
      status: "ENROLLED",
      expectedStartDate: ymd(scenario.enrollDate),
      actualEnrollDate: ymd(scenario.enrollDate),
      meetDate: ymd("2026-06-20"),
      notes: TAG,
    },
    create: {
      branchId,
      leadCode: `LEAD-${scenario.studentCode}`,
      fullName: scenario.fullName,
      gender: "FEMALE",
      dob: ymd(`201${Number(scenario.studentCode.slice(-1)) % 5 + 3}-0${(Number(scenario.studentCode.slice(-2)) % 8) + 1}-1${Number(scenario.studentCode.slice(-1)) % 9}`),
      guardianId: guardian.id,
      phone: scenario.phone,
      address: "TP.HCM",
      meetDate: ymd("2026-06-20"),
      interestedClassId: classId,
      status: "ENROLLED",
      expectedStartDate: ymd(scenario.enrollDate),
      actualEnrollDate: ymd(scenario.enrollDate),
      source: "Stress tuition seed",
      notes: TAG,
    },
  });

  const student = await prisma.student.upsert({
    where: { studentCode: scenario.studentCode },
    update: {
      branchId,
      fullName: scenario.fullName,
      leadId: lead.id,
      phone: scenario.phone,
      status: "ACTIVE",
      enrollDate: ymd(scenario.enrollDate),
      notes: TAG,
    },
    create: {
      branchId,
      studentCode: scenario.studentCode,
      fullName: scenario.fullName,
      leadId: lead.id,
      gender: "FEMALE",
      dob: ymd(`201${Number(scenario.studentCode.slice(-1)) % 5 + 3}-0${(Number(scenario.studentCode.slice(-2)) % 8) + 1}-1${Number(scenario.studentCode.slice(-1)) % 9}`),
      phone: scenario.phone,
      address: "TP.HCM",
      enrollDate: ymd(scenario.enrollDate),
      status: "ACTIVE",
      notes: TAG,
    },
  });

  await prisma.studentGuardian.upsert({
    where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
    update: { relation: "Mẹ", isPrimary: true },
    create: { studentId: student.id, guardianId: guardian.id, relation: "Mẹ", isPrimary: true },
  });

  const placement = await prisma.placementTest.findFirst({ where: { leadId: lead.id } });
  if (!placement) {
    await prisma.placementTest.create({
      data: {
        leadId: lead.id,
        scheduledDate: ymd("2026-06-25"),
        testDate: ymd("2026-06-28"),
        status: "PASSED",
        suggestedClass: scenario.classCode,
        result: TAG,
      },
    });
  }

  return { guardian, lead, student };
}

async function ensureEnrollment(studentId: string, classId: string, enrollDate: string, billingModel: Scenario["billingModel"]) {
  const existing = await prisma.enrollment.findFirst({ where: { studentId, classId, status: { in: ["ACTIVE", "PENDING", "PAUSED"] } } });
  if (existing) {
    return prisma.enrollment.update({
      where: { id: existing.id },
      data: { billingModel, status: "ACTIVE", enrollDate: ymd(enrollDate), notes: TAG },
    });
  }

  const created = await prisma.enrollment.create({
    data: {
      studentId,
      classId,
      status: "ACTIVE",
      billingModel,
      enrollDate: ymd(enrollDate),
      notes: TAG,
    },
  });

  await prisma.enrollmentStatusHistory.create({
    data: { studentId, enrollmentId: created.id, toStatus: "ACTIVE", reason: TAG },
  });

  return created;
}

async function ensureScholarship(studentId: string, enrollmentId: string, percentage: number, effectiveFrom: string) {
  const existing = await prisma.scholarship.findFirst({ where: { studentId, enrollmentId, percentage, effectiveFrom: ymd(effectiveFrom) } });
  if (existing) return existing;
  return prisma.scholarship.create({
    data: {
      studentId,
      enrollmentId,
      percentage,
      reason: TAG,
      effectiveFrom: ymd(effectiveFrom),
    },
  });
}

async function ensureAdjustment(studentId: string, percentage: number, effectiveFrom: string) {
  const existing = await prisma.adjustment.findFirst({ where: { studentId, percentage, effectiveFrom: ymd(effectiveFrom) } });
  if (existing) return existing;
  return prisma.adjustment.create({
    data: {
      studentId,
      percentage,
      reason: TAG,
      effectiveFrom: ymd(effectiveFrom),
    },
  });
}

async function ensureCourseBookRequirement(courseId: string, bookId: string, quantity: number, sortOrder: number) {
  return prisma.courseBookRequirement.upsert({
    where: { courseId_bookId: { courseId, bookId } },
    update: { quantity, sortOrder, isRequired: true },
    create: { courseId, bookId, quantity, sortOrder, isRequired: true },
  });
}

async function ensureStudentBookRequirement(
  enrollmentId: string,
  studentId: string,
  classId: string,
  courseBookRequirementId: string,
  bookId: string,
  quantity: number,
  unitPriceSnapshot: number,
) {
  return prisma.studentBookRequirement.upsert({
    where: { enrollmentId_bookId: { enrollmentId, bookId } },
    update: { quantity, unitPriceSnapshot, totalAmount: quantity * unitPriceSnapshot },
    create: {
      enrollmentId,
      studentId,
      classId,
      courseBookRequirementId,
      bookId,
      quantity,
      unitPriceSnapshot,
      totalAmount: quantity * unitPriceSnapshot,
      notes: TAG,
    },
  });
}

async function ensureAttendance(sessionId: string, studentId: string, status: "PRESENT" | "ABSENT" | "MAKEUP") {
  return prisma.studentAttendance.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    update: { status },
    create: { sessionId, studentId, status },
  });
}

async function ensureInvoice(chargeId: string, periodName: string, studentCode: string, classCode: string) {
  const existing = await prisma.invoice.findUnique({ where: { chargeId } });
  if (existing) return existing;
  return prisma.invoice.create({ data: { chargeId, invoiceNo: invoiceNo(periodName, studentCode, classCode), notes: TAG } });
}

async function ensurePaymentForCharge(args: {
  chargeId: string;
  studentId: string;
  branchId: string;
  receivedById?: string | null;
  paymentNo: string;
  paidDate: string;
  amount: number;
}) {
  const payment = await prisma.payment.upsert({
    where: { paymentNo: args.paymentNo },
    update: {
      studentId: args.studentId,
      paidDate: ymd(args.paidDate),
      amount: args.amount,
      method: "BANK",
      receivedById: args.receivedById ?? null,
      status: "CONFIRMED",
      notes: TAG,
    },
    create: {
      studentId: args.studentId,
      paymentNo: args.paymentNo,
      paidDate: ymd(args.paidDate),
      amount: args.amount,
      method: "BANK",
      receivedById: args.receivedById ?? null,
      status: "CONFIRMED",
      notes: TAG,
    },
  });

  await prisma.paymentAllocation.upsert({
    where: { paymentId_chargeId: { paymentId: payment.id, chargeId: args.chargeId } },
    update: { amount: args.amount },
    create: { paymentId: payment.id, chargeId: args.chargeId, amount: args.amount },
  });

  const category =
    (await prisma.transactionCategory.findFirst({ where: { type: "THU", name: "Học phí stress test" } })) ??
    (await prisma.transactionCategory.create({ data: { type: "THU", name: "Học phí stress test", detail: TAG } }));

  const cashTx =
    (await prisma.cashTransaction.findFirst({ where: { branchId: args.branchId, description: args.paymentNo } })) ??
    (await prisma.cashTransaction.create({
      data: {
        branchId: args.branchId,
        categoryId: category.id,
        type: "THU",
        txnDate: ymd(args.paidDate),
        amount: args.amount,
        detail: TAG,
        description: args.paymentNo,
        handledById: args.receivedById ?? null,
      },
    }));

  await prisma.paymentCashPosting.upsert({
    where: { paymentId: payment.id },
    update: { cashTransactionId: cashTx.id, amount: args.amount },
    create: { paymentId: payment.id, cashTransactionId: cashTx.id, amount: args.amount },
  });

  return payment;
}

async function main() {
  const branch = await ensureBranch();
  const operator = await ensureOperator(branch.id);
  await ensurePaymentProfile(branch.id);

  const periods = Object.fromEntries(
    await Promise.all(
      MONTHS.map(async (month) => [month, await ensureBillingPeriod(branch.id, month)] as const),
    ),
  ) as Record<(typeof MONTHS)[number], Awaited<ReturnType<typeof ensureBillingPeriod>>>;

  const stockLocation = await ensureStockLocation(branch.id);

  const books = {
    euSb: await ensureBook(branch.id, "ST-EU-SB", "Everybody Up 5 - Student Book", "Everybody Up 5", 180000),
    euWb: await ensureBook(branch.id, "ST-EU-WB", "Everybody Up 5 - Workbook", "Everybody Up 5", 120000),
    camSb: await ensureBook(branch.id, "ST-CAM-SB", "Cambridge A2 Key - Student Book", "Cambridge", 210000),
    camWb: await ensureBook(branch.id, "ST-CAM-WB", "Cambridge A2 Key - Workbook", "Cambridge", 160000),
    ieltsSb: await ensureBook(branch.id, "ST-IELTS-SB", "IELTS Foundation Skills", "IELTS", 230000),
    ieltsWb: await ensureBook(branch.id, "ST-IELTS-WB", "IELTS Practice Workbook", "IELTS", 170000),
  };

  const stockBooks = Object.values(books);
  for (const [index, book] of stockBooks.entries()) {
    const description = `STOCK-STRESS-${book.bookCode}`;
    const existingTxn = await prisma.stockTransaction.findFirst({ where: { bookId: book.id, notes: description } });
    if (!existingTxn) {
      const txn = await prisma.stockTransaction.create({
        data: {
          bookId: book.id,
          locationId: stockLocation.id,
          type: "RECEIPT",
          quantity: 150,
          unitPrice: book.unitPrice,
          totalAmount: 150 * book.unitPrice,
          receivedById: operator.id,
          handedById: operator.id,
          status: "POSTED",
          txnDate: ymd(`2026-06-${String(10 + index).padStart(2, "0")}`),
          notes: description,
        },
      });

      const category =
        (await prisma.transactionCategory.findFirst({ where: { type: "CHI", name: "Nhập kho stress test" } })) ??
        (await prisma.transactionCategory.create({ data: { type: "CHI", name: "Nhập kho stress test", detail: TAG } }));

      const cashTx = await prisma.cashTransaction.create({
        data: {
          branchId: branch.id,
          categoryId: category.id,
          type: "CHI",
          txnDate: ymd(`2026-06-${String(10 + index).padStart(2, "0")}`),
          amount: 150 * book.unitPrice,
          detail: TAG,
          description,
          handledById: operator.id,
        },
      });

      await prisma.stockCashPosting.create({
        data: {
          stockTransactionId: txn.id,
          cashTransactionId: cashTx.id,
          amount: 150 * book.unitPrice,
        },
      });
    }
  }

  const courses = {
    eu: await ensureCourse(branch.id, { code: "ST-EU5", name: "Everybody Up 5", tuitionPerSession: 160000, sessionsPerWeek: 2 }),
    cam: await ensureCourse(branch.id, { code: "ST-CAM-A2", name: "Cambridge A2 Key", tuitionPerSession: 200000, sessionsPerWeek: 2 }),
    ielts: await ensureCourse(branch.id, { code: "ST-IELTS-FD", name: "IELTS Foundation", tuitionPerSession: 220000, sessionsPerWeek: 2 }),
  };

  await ensureCourseBookRequirement(courses.eu.id, books.euSb.id, 1, 1);
  await ensureCourseBookRequirement(courses.eu.id, books.euWb.id, 1, 2);
  await ensureCourseBookRequirement(courses.cam.id, books.camSb.id, 1, 1);
  await ensureCourseBookRequirement(courses.cam.id, books.camWb.id, 1, 2);
  await ensureCourseBookRequirement(courses.ielts.id, books.ieltsSb.id, 1, 1);
  await ensureCourseBookRequirement(courses.ielts.id, books.ieltsWb.id, 1, 2);

  const classes = {
    eu1: await ensureClass({
      branchId: branch.id,
      courseId: courses.eu.id,
      classCode: "ST-EU5-1",
      classGroup: "E1",
      className: "Everybody Up 5 - E1",
      totalSessions: 34,
      startDate: "2026-07-07",
      expectedEndDate: "2026-10-29",
      sessionsPerWeek: 2,
      tuitionPerSession: 160000,
    }),
    eu2: await ensureClass({
      branchId: branch.id,
      courseId: courses.eu.id,
      classCode: "ST-EU5-2",
      classGroup: "E2",
      className: "Everybody Up 5 - E2",
      totalSessions: 26,
      startDate: "2026-08-03",
      expectedEndDate: "2026-10-28",
      sessionsPerWeek: 2,
      tuitionPerSession: 165000,
    }),
    cam1: await ensureClass({
      branchId: branch.id,
      courseId: courses.cam.id,
      classCode: "ST-CAM-1",
      classGroup: "C1",
      className: "Cambridge A2 Key - C1",
      totalSessions: 18,
      startDate: "2026-08-08",
      expectedEndDate: "2026-09-26",
      sessionsPerWeek: 2,
      tuitionPerSession: 200000,
      status: "COMPLETED",
    }),
    ielts1: await ensureClass({
      branchId: branch.id,
      courseId: courses.ielts.id,
      classCode: "ST-IELTS-1",
      classGroup: "I1",
      className: "IELTS Foundation - I1",
      totalSessions: 24,
      startDate: "2026-08-04",
      expectedEndDate: "2026-10-30",
      sessionsPerWeek: 2,
      tuitionPerSession: 220000,
    }),
    rem1: await ensureClass({
      branchId: branch.id,
      courseId: null,
      classCode: "ST-REM-1",
      classGroup: "R1",
      className: "Lớp bổ trợ speaking",
      startDate: "2026-08-12",
      expectedEndDate: "2026-10-20",
      sessionsPerWeek: 1,
      tuitionPerSession: 0,
      isRemedial: true,
    }),
    rem2: await ensureClass({
      branchId: branch.id,
      courseId: null,
      classCode: "ST-REM-2",
      classGroup: "R2",
      className: "Lớp bổ trợ grammar",
      startDate: "2026-08-14",
      expectedEndDate: "2026-10-23",
      sessionsPerWeek: 1,
      tuitionPerSession: 0,
      isRemedial: true,
    }),
  };

  await ensureScheduleRule(classes.eu1.id, 2, "17:30", "19:00", "Room E1");
  await ensureScheduleRule(classes.eu1.id, 4, "17:30", "19:00", "Room E1");
  await ensureScheduleRule(classes.eu2.id, 1, "17:30", "19:00", "Room E2");
  await ensureScheduleRule(classes.eu2.id, 3, "17:30", "19:00", "Room E2");
  await ensureScheduleRule(classes.cam1.id, 6, "08:00", "09:30", "Room C1");
  await ensureScheduleRule(classes.cam1.id, 0, "08:00", "09:30", "Room C1");
  await ensureScheduleRule(classes.ielts1.id, 2, "19:15", "20:45", "Room I1");
  await ensureScheduleRule(classes.ielts1.id, 5, "19:15", "20:45", "Room I1");
  await ensureScheduleRule(classes.rem1.id, 3, "18:00", "19:00", "Room R1");
  await ensureScheduleRule(classes.rem2.id, 5, "18:00", "19:00", "Room R2");

  const classSessions = {
    eu1: await ensureSessionsForClass(classes.eu1.id, "2026-07-07", "2026-10-29", [2, 4], "17:30", "19:00", "Room E1"),
    eu2: await ensureSessionsForClass(classes.eu2.id, "2026-08-03", "2026-10-28", [1, 3], "17:30", "19:00", "Room E2"),
    cam1: await ensureSessionsForClass(classes.cam1.id, "2026-08-08", "2026-09-26", [6, 0], "08:00", "09:30", "Room C1"),
    ielts1: await ensureSessionsForClass(classes.ielts1.id, "2026-08-04", "2026-10-30", [2, 5], "19:15", "20:45", "Room I1"),
    rem1: await ensureSessionsForClass(classes.rem1.id, "2026-08-12", "2026-10-21", [3], "18:00", "19:00", "Room R1"),
    rem2: await ensureSessionsForClass(classes.rem2.id, "2026-08-14", "2026-10-23", [5], "18:00", "19:00", "Room R2"),
  };

  const scenarios: Scenario[] = [];
  const firstNames = ["An", "Bình", "Chi", "Duy", "Giang", "Hà", "Khang", "Lan", "Minh", "Ngọc", "Oanh", "Phúc", "Quỳnh", "Trang", "Vy"];

  for (let i = 1; i <= 10; i++) {
    scenarios.push({
      studentCode: `STRESS-HV${String(i).padStart(3, "0")}`,
      fullName: `${pick(firstNames, i)} Stress EU1 ${i}`,
      guardianName: `PH Stress EU1 ${i}`,
      phone: `0987000${String(i).padStart(3, "0")}`,
      classCode: classes.eu1.classCode,
      billingModel: "PERIOD",
      enrollDate: "2026-07-07",
      scholarshipPct: i === 1 ? 0.1 : i === 4 ? 0.2 : undefined,
      adjustmentPct: i === 2 ? 0.05 : undefined,
    });
  }

  for (let i = 11; i <= 18; i++) {
    scenarios.push({
      studentCode: `STRESS-HV${String(i).padStart(3, "0")}`,
      fullName: `${pick(firstNames, i)} Stress EU2 ${i}`,
      guardianName: `PH Stress EU2 ${i}`,
      phone: `0987111${String(i).padStart(3, "0")}`,
      classCode: classes.eu2.classCode,
      billingModel: "PERIOD",
      enrollDate: "2026-08-03",
    });
  }

  for (let i = 19; i <= 26; i++) {
    scenarios.push({
      studentCode: `STRESS-HV${String(i).padStart(3, "0")}`,
      fullName: `${pick(firstNames, i)} Stress CAM ${i}`,
      guardianName: `PH Stress CAM ${i}`,
      phone: `0987222${String(i).padStart(3, "0")}`,
      classCode: classes.cam1.classCode,
      billingModel: "COURSE",
      enrollDate: "2026-08-08",
      scholarshipPct: i === 19 ? 0.15 : undefined,
      adjustmentPct: i === 20 ? 0.1 : undefined,
    });
  }

  for (let i = 27; i <= 30; i++) {
    scenarios.push({
      studentCode: `STRESS-HV${String(i).padStart(3, "0")}`,
      fullName: `${pick(firstNames, i)} Stress IELTS ${i}`,
      guardianName: `PH Stress IELTS ${i}`,
      phone: `0987333${String(i).padStart(3, "0")}`,
      classCode: classes.ielts1.classCode,
      billingModel: "INSTALLMENT",
      enrollDate: "2026-08-04",
    });
  }

  const classMap = Object.fromEntries(Object.values(classes).map((item) => [item.classCode, item]));
  const enrollmentMap = new Map<string, Awaited<ReturnType<typeof ensureEnrollment>>>();
  const studentMap = new Map<string, { id: string; classId: string; billingModel: Scenario["billingModel"] }>();

  for (const scenario of scenarios) {
    const cls = classMap[scenario.classCode];
    const { student } = await ensureGuardianStudentLead(branch.id, scenario, cls.id);
    const enrollment = await ensureEnrollment(student.id, cls.id, scenario.enrollDate, scenario.billingModel);
    enrollmentMap.set(scenario.studentCode, enrollment);
    studentMap.set(scenario.studentCode, { id: student.id, classId: cls.id, billingModel: scenario.billingModel });

    if (scenario.scholarshipPct) {
      await ensureScholarship(student.id, enrollment.id, scenario.scholarshipPct, scenario.enrollDate);
    }
    if (scenario.adjustmentPct) {
      await ensureAdjustment(student.id, scenario.adjustmentPct, scenario.enrollDate);
    }

    if (scenario.billingModel === "INSTALLMENT") {
      const installments = [
        { month: "2026-08", sequence: 1, amount: 1760000, dueDate: "2026-08-15" },
        { month: "2026-09", sequence: 2, amount: 1760000, dueDate: "2026-09-15" },
        { month: "2026-10", sequence: 3, amount: 1760000, dueDate: "2026-10-15" },
      ];
      for (const item of installments) {
        const period = periods[item.month as keyof typeof periods];
        const existing = await prisma.enrollmentInstallment.findFirst({
          where: { enrollmentId: enrollment.id, sequence: item.sequence },
        });
        if (existing) {
          await prisma.enrollmentInstallment.update({
            where: { id: existing.id },
            data: { billingPeriodId: period.id, label: `Đợt ${item.sequence}/3`, amount: item.amount, dueDate: ymd(item.dueDate) },
          });
        } else {
          await prisma.enrollmentInstallment.create({
            data: {
              enrollmentId: enrollment.id,
              billingPeriodId: period.id,
              sequence: item.sequence,
              label: `Đợt ${item.sequence}/3`,
              amount: item.amount,
              dueDate: ymd(item.dueDate),
            },
          });
        }
      }
    }
  }

  const requirementBooksByCourse = {
    [courses.eu.id]: [books.euSb, books.euWb],
    [courses.cam.id]: [books.camSb, books.camWb],
    [courses.ielts.id]: [books.ieltsSb, books.ieltsWb],
  };

  for (const scenario of scenarios) {
    const enrollment = enrollmentMap.get(scenario.studentCode)!;
    const cls = classMap[scenario.classCode];
    if (!cls.courseId || cls.isRemedial) continue;
    const courseRequirements = await prisma.courseBookRequirement.findMany({ where: { courseId: cls.courseId }, orderBy: { sortOrder: "asc" } });
    for (const item of courseRequirements) {
      const book = requirementBooksByCourse[cls.courseId].find((entry) => entry.id === item.bookId)!;
      await ensureStudentBookRequirement(enrollment.id, enrollment.studentId, cls.id, item.id, book.id, item.quantity, book.unitPrice);
    }
  }

  const monthlyAbsencePattern = new Map<string, Set<string>>();
  for (const month of MONTHS) {
    monthlyAbsencePattern.set(month, new Set());
  }

  for (const [index, scenario] of scenarios.entries()) {
    if (scenario.billingModel === "COURSE") continue;
    if (index % 5 === 0) monthlyAbsencePattern.get("2026-07")?.add(scenario.studentCode);
    if (index % 4 === 0) monthlyAbsencePattern.get("2026-08")?.add(scenario.studentCode);
    if (index % 3 === 0) monthlyAbsencePattern.get("2026-09")?.add(scenario.studentCode);
    if (index % 6 === 0) monthlyAbsencePattern.get("2026-10")?.add(scenario.studentCode);
  }

  const sessionsByClassCode = {
    [classes.eu1.classCode]: classSessions.eu1,
    [classes.eu2.classCode]: classSessions.eu2,
    [classes.cam1.classCode]: classSessions.cam1,
    [classes.ielts1.classCode]: classSessions.ielts1,
  };

  for (const scenario of scenarios) {
    const student = studentMap.get(scenario.studentCode)!;
    const sessions = sessionsByClassCode[scenario.classCode] ?? [];
    for (const session of sessions) {
      const month = `${session.sessionDate.getUTCFullYear()}-${String(session.sessionDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const shouldAbsent =
        scenario.billingModel === "COURSE"
          ? (scenario.studentCode.endsWith("19") || scenario.studentCode.endsWith("21")) && month === "2026-09" && session.sessionDate.getUTCDate() % 2 === 0
          : monthlyAbsencePattern.get(month)?.has(scenario.studentCode) && session.sessionDate.getUTCDate() % 2 === 1;

      await ensureAttendance(session.id, student.id, shouldAbsent ? "ABSENT" : "PRESENT");

      if (scenario.billingModel === "COURSE" && shouldAbsent) {
        const enrollment = enrollmentMap.get(scenario.studentCode)!;
        const existingCredit = await prisma.sessionCredit.findFirst({ where: { studentId: student.id, sourceSessionId: session.id } });
        if (!existingCredit) {
          await prisma.sessionCredit.create({
            data: {
              studentId: student.id,
              enrollmentId: enrollment.id,
              sourceSessionId: session.id,
              status: "AVAILABLE",
              notes: `${TAG} Vắng buổi đã thu khóa`,
            },
          });
        }
      }
    }
  }

  for (const scenario of scenarios.filter((item) => item.billingModel === "COURSE")) {
    const enrollment = enrollmentMap.get(scenario.studentCode)!;
    await generateCourseCharge(enrollment.id, { billingPeriodId: periods["2026-08"].id });
  }

  for (const month of MONTHS) {
    await generateChargesForPeriod(periods[month].id);
  }

  for (const scenario of scenarios) {
    const cls = classMap[scenario.classCode];
    const student = await prisma.student.findUniqueOrThrow({ where: { studentCode: scenario.studentCode } });
    const enrollment = enrollmentMap.get(scenario.studentCode)!;
    const wantsBook = Number(scenario.studentCode.slice(-1)) % 5 !== 0;
    const courseRequirements = cls.courseId ? await prisma.courseBookRequirement.findMany({ where: { courseId: cls.courseId }, orderBy: { sortOrder: "asc" } }) : [];
    if (courseRequirements.length === 0) continue;

    for (const requirement of courseRequirements) {
      const studentRequirement = await prisma.studentBookRequirement.findUniqueOrThrow({
        where: { enrollmentId_bookId: { enrollmentId: enrollment.id, bookId: requirement.bookId } },
      });
      const book = await prisma.book.findUniqueOrThrow({ where: { id: requirement.bookId } });

      if (!wantsBook) {
        await prisma.studentBookRequirement.update({
          where: { id: studentRequirement.id },
          data: { status: "DECLINED", declinedAt: new Date(), notes: `${TAG} phụ huynh từ chối` },
        });
        continue;
      }

      const issueMonth = scenario.billingModel === "COURSE" ? "2026-08" : scenario.billingModel === "INSTALLMENT" ? "2026-08" : scenario.enrollDate.slice(0, 7);
      const issueDate = issueMonth === "2026-07" ? "2026-07-10" : issueMonth === "2026-08" ? "2026-08-10" : "2026-09-10";
      const charge = await prisma.charge.findUnique({
        where: {
          studentId_classId_billingPeriodId: {
            studentId: student.id,
            classId: cls.id,
            billingPeriodId: periods[issueMonth as keyof typeof periods].id,
          },
        },
      });

      const existingIssue = await prisma.bookIssue.findFirst({
        where: { studentId: student.id, bookId: book.id, classId: cls.id, issueDate: ymd(issueDate) },
      });

      if (!existingIssue) {
        const issue = await prisma.bookIssue.create({
          data: {
            bookId: book.id,
            classId: cls.id,
            studentId: student.id,
            chargeId: charge?.id ?? null,
            quantity: studentRequirement.quantity,
            unitPrice: studentRequirement.unitPriceSnapshot,
            amount: studentRequirement.totalAmount,
            issueDate: ymd(issueDate),
            paymentStatus: "UNPAID",
            notes: TAG,
          },
        });

        await prisma.studentBookRequirement.update({
          where: { id: studentRequirement.id },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            bookIssueId: issue.id,
            notes: `${TAG} đã xác nhận mua`,
          },
        });
      }
    }
  }

  // Đồng bộ lại học phí sau khi gắn giáo trình.
  for (const month of MONTHS) {
    await generateChargesForPeriod(periods[month].id);
  }

  const allStressCharges = await prisma.charge.findMany({
    where: { student: { studentCode: { startsWith: "STRESS-HV" } } },
    include: {
      student: true,
      class: true,
      billingPeriod: true,
      allocations: true,
      installment: true,
    },
  });

  for (const charge of allStressCharges) {
    await ensureInvoice(charge.id, charge.billingPeriod.periodName, charge.student.studentCode, charge.class.classCode);
  }

  // Thu tiền mẫu để tạo đủ full/partial/unpaid + opening balance qua nhiều kỳ.
  for (const charge of allStressCharges) {
    const codeNum = Number(charge.student.studentCode.slice(-3));
    const month = charge.billingPeriod.periodName;
    let payAmount = 0;

    if (charge.billingModel === "COURSE") {
      if (codeNum <= 20) payAmount = charge.totalAmount;
      else if (codeNum <= 22) payAmount = Math.round(charge.totalAmount * 0.4);
    } else if (charge.billingModel === "INSTALLMENT") {
      if (month === "2026-08" && codeNum <= 28) payAmount = charge.totalAmount;
      else if (month === "2026-08" && codeNum === 29) payAmount = Math.round(charge.totalAmount * 0.5);
    } else {
      if (month === "2026-07") {
        if (codeNum <= 3) payAmount = charge.totalAmount;
        else if (codeNum <= 6) payAmount = Math.round(charge.totalAmount * 0.5);
      } else if (month === "2026-08") {
        if (codeNum <= 2 || (codeNum >= 11 && codeNum <= 13)) payAmount = charge.totalAmount;
        else if (codeNum === 4 || codeNum === 14) payAmount = Math.round(charge.totalAmount * 0.35);
      } else if (month === "2026-09") {
        if (codeNum === 1 || codeNum === 11) payAmount = Math.round(charge.totalAmount * 0.25);
      }
    }

    if (payAmount <= 0) continue;
    const suffix = charge.billingModel === "INSTALLMENT" ? `I${charge.installment?.sequence ?? 0}` : charge.class.classCode.slice(-2);
    await ensurePaymentForCharge({
      chargeId: charge.id,
      studentId: charge.studentId,
      branchId: branch.id,
      receivedById: operator.id,
      paymentNo: paymentNo(month, charge.student.studentCode, suffix),
      paidDate: `${month}-20`,
      amount: payAmount,
    });
  }

  // Tiền dư để test opening balance âm / credit balance.
  const overpayCharge = allStressCharges.find((charge) => charge.student.studentCode === "STRESS-HV011" && charge.billingPeriod.periodName === "2026-08");
  if (overpayCharge) {
    const payment = await prisma.payment.findUnique({ where: { paymentNo: paymentNo("2026-08", "STRESS-HV011", "CR") } });
    if (!payment) {
      const paid = await ensurePaymentForCharge({
        chargeId: overpayCharge.id,
        studentId: overpayCharge.studentId,
        branchId: branch.id,
        receivedById: operator.id,
        paymentNo: paymentNo("2026-08", "STRESS-HV011", "CR"),
        paidDate: "2026-08-25",
        amount: Math.round(overpayCharge.totalAmount * 0.1),
      });
      const existingCredit = await prisma.creditBalance.findFirst({ where: { paymentId: paid.id, studentId: overpayCharge.studentId, reason: `${TAG} overpay` } });
      if (!existingCredit) {
        await prisma.creditBalance.create({
          data: {
            studentId: overpayCharge.studentId,
            paymentId: paid.id,
            amount: Math.round(overpayCharge.totalAmount * 0.1),
            reason: `${TAG} overpay`,
          },
        });
      }
    }
  }

  // Một phần buổi dư được dùng cho lớp bổ trợ.
  const availableCredits = await prisma.sessionCredit.findMany({
    where: {
      student: { studentCode: { in: ["STRESS-HV019", "STRESS-HV021"] } },
      status: "AVAILABLE",
    },
    take: 2,
    orderBy: { createdAt: "asc" },
  });
  const remedialSessions = [...classSessions.rem1, ...classSessions.rem2].slice(0, availableCredits.length);
  for (let i = 0; i < availableCredits.length; i++) {
    const credit = availableCredits[i]!;
    const remedialSession = remedialSessions[i]!;
    await prisma.sessionCredit.update({
      where: { id: credit.id },
      data: {
        status: "CONSUMED",
        consumedSessionId: remedialSession.id,
        consumedAt: new Date(),
        notes: `${TAG} dùng cho lớp bổ trợ`,
      },
    });
    await ensureAttendance(remedialSession.id, credit.studentId, "MAKEUP");
  }

  const summary = {
    periods: await prisma.billingPeriod.count({ where: { branchId: branch.id, periodName: { in: [...MONTHS] } } }),
    students: await prisma.student.count({ where: { studentCode: { startsWith: "STRESS-HV" } } }),
    leads: await prisma.lead.count({ where: { leadCode: { startsWith: "LEAD-STRESS-HV" } } }),
    classes: await prisma.class.count({ where: { classCode: { startsWith: "ST-" } } }),
    remedialClasses: await prisma.class.count({ where: { classCode: { startsWith: "ST-REM" }, isRemedial: true } }),
    sessions: await prisma.classSession.count({ where: { notes: TAG } }),
    enrollments: await prisma.enrollment.count({ where: { student: { studentCode: { startsWith: "STRESS-HV" } } } }),
    charges: await prisma.charge.count({ where: { student: { studentCode: { startsWith: "STRESS-HV" } } } }),
    payments: await prisma.payment.count({ where: { paymentNo: { startsWith: "PAY-ST-" } } }),
    invoices: await prisma.invoice.count({ where: { invoiceNo: { startsWith: "INV-ST-" } } }),
    sessionCredits: await prisma.sessionCredit.count({ where: { student: { studentCode: { startsWith: "STRESS-HV" } } } }),
    availableSessionCredits: await prisma.sessionCredit.count({ where: { student: { studentCode: { startsWith: "STRESS-HV" } }, status: "AVAILABLE" } }),
    consumedSessionCredits: await prisma.sessionCredit.count({ where: { student: { studentCode: { startsWith: "STRESS-HV" } }, status: "CONSUMED" } }),
  };

  console.log(JSON.stringify({ ok: true, tag: TAG, branch: branch.code, summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
