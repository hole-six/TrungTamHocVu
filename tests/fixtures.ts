// Dựng dữ liệu mẫu tối thiểu để thử nghiệp vụ tiền: 1 chi nhánh, 1 khóa, 1 lớp,
// N học viên. Cố tình KHÔNG dùng script seed thật — seed thật dựng hàng trăm bản ghi
// và thay đổi theo thời gian, làm phép thử vừa chậm vừa khó đoán.
import type { PrismaClient } from "@prisma/client";

let counter = 0;
const nextCode = (prefix: string) => `${prefix}${String((counter += 1)).padStart(4, "0")}`;

export async function seedBranch(db: PrismaClient) {
  const org = await db.organization.create({ data: { name: "Trung tâm thử nghiệm" } });
  return db.branch.create({ data: { organizationId: org.id, name: "Chi nhánh thử", code: nextCode("CN") } });
}

export async function seedClass(
  db: PrismaClient,
  branchId: string,
  options?: { tuitionPerSession?: number; totalSessions?: number },
) {
  const course = await db.course.create({
    data: {
      branchId,
      code: nextCode("KH"),
      name: "Khóa thử",
      tuitionPerSession: options?.tuitionPerSession ?? 170_000,
      sessionsPerWeek: 2,
    },
  });
  return db.class.create({
    data: {
      branchId,
      courseId: course.id,
      classCode: nextCode("LOP"),
      className: "Lớp thử",
      totalSessions: options?.totalSessions ?? 48,
      startDate: new Date("2026-01-05T00:00:00.000Z"),
      sessionsPerWeek: 2,
      tuitionPerSession: options?.tuitionPerSession ?? 170_000,
      status: "ACTIVE",
    },
  });
}

export async function seedStudent(db: PrismaClient, branchId: string, fullName: string) {
  return db.student.create({
    data: { branchId, studentCode: nextCode("HV"), fullName, status: "ACTIVE" },
  });
}

export async function seedEnrollment(
  db: PrismaClient,
  params: {
    studentId: string;
    classId: string;
    billingModel: "PERIOD" | "COURSE";
    enrollDate: Date;
    endDate?: Date | null;
    purchasedMainSessionCount?: number | null;
    unitPrice?: number | null;
    status?: string;
  },
) {
  return db.enrollment.create({
    data: {
      studentId: params.studentId,
      classId: params.classId,
      billingModel: params.billingModel,
      enrollDate: params.enrollDate,
      endDate: params.endDate ?? null,
      purchasedMainSessionCount: params.purchasedMainSessionCount ?? null,
      tuitionUnitPriceSnapshot: params.unitPrice ?? null,
      status: params.status ?? "ACTIVE",
    },
  });
}

export async function seedSession(
  db: PrismaClient,
  classId: string,
  sessionDate: Date,
  status: string = "PLANNED",
) {
  return db.classSession.create({
    data: { classId, sessionDate, startTime: "17:30", endTime: "19:00", status },
  });
}

export async function seedBillingPeriod(db: PrismaClient, branchId: string, periodName: string) {
  const [year, month] = periodName.split("-").map(Number);
  return db.billingPeriod.create({
    data: {
      branchId,
      periodName,
      startDate: new Date(Date.UTC(year, month - 1, 1)),
      endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
      status: "GENERATED",
    },
  });
}

export async function seedCharge(
  db: PrismaClient,
  params: {
    studentId: string;
    classId: string;
    billingPeriodId: string;
    enrollmentId?: string | null;
    tuitionAmount: number;
    materialsAmount?: number;
    unitPrice: number;
    billingModel?: string;
  },
) {
  const materialsAmount = params.materialsAmount ?? 0;
  return db.charge.create({
    data: {
      studentId: params.studentId,
      classId: params.classId,
      billingPeriodId: params.billingPeriodId,
      enrollmentId: params.enrollmentId ?? null,
      sessionCount: params.unitPrice > 0 ? Math.round(params.tuitionAmount / params.unitPrice) : 0,
      unitPrice: params.unitPrice,
      tuitionAmount: params.tuitionAmount,
      materialsAmount,
      openingBalance: 0,
      totalAmount: params.tuitionAmount + materialsAmount,
      billingModel: params.billingModel ?? "PERIOD",
    },
  });
}

export async function seedPayment(
  db: PrismaClient,
  params: { studentId: string; amount: number; paidDate?: Date },
) {
  return db.payment.create({
    data: {
      studentId: params.studentId,
      paymentNo: nextCode("PM"),
      amount: params.amount,
      paidDate: params.paidDate ?? new Date("2026-01-10T00:00:00.000Z"),
      status: "ALLOCATED",
    },
  });
}

export async function seedEmployee(
  db: PrismaClient,
  branchId: string,
  params?: {
    fullName?: string;
    payMode?: "HOURLY" | "SESSION";
    teachingHourlyRate?: number | null;
    assistantHourlyRate?: number | null;
    staffDailyRate?: number | null;
  },
) {
  return db.employee.create({
    data: {
      branchId,
      employeeCode: nextCode("NV"),
      fullName: params?.fullName ?? "Nhân sự thử",
      shortName: params?.fullName ?? "NV thử",
      payMode: params?.payMode ?? "HOURLY",
      teachingHourlyRate: params?.teachingHourlyRate ?? null,
      assistantHourlyRate: params?.assistantHourlyRate ?? null,
      staffDailyRate: params?.staffDailyRate ?? null,
      workStatus: "ACTIVE",
    },
  });
}

export async function seedSessionAssignment(
  db: PrismaClient,
  params: {
    sessionId: string;
    employeeId: string;
    role: "TEACHER" | "ASSISTANT" | "ASSISTANT2";
    hours: number;
    hourlyRate: number;
  },
) {
  return db.sessionAssignment.create({
    data: {
      sessionId: params.sessionId,
      employeeId: params.employeeId,
      role: params.role,
      hours: params.hours,
      hourlyRate: params.hourlyRate,
      amount: Math.round(params.hours * params.hourlyRate),
    },
  });
}

export async function seedTimesheetEntry(
  db: PrismaClient,
  params: { employeeId: string; workDate: Date; days: number; hours?: number },
) {
  return db.timesheetEntry.create({
    data: {
      employeeId: params.employeeId,
      workDate: params.workDate,
      days: params.days,
      hours: params.hours ?? params.days * 8,
    },
  });
}

export async function seedPayrollRun(db: PrismaClient, branchId: string, periodName: string, status = "DRAFT") {
  return db.payrollRun.create({ data: { branchId, periodName, status } });
}
