import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type CanonicalData = {
  lookups: {
    courses: Array<{
      courseCode: string;
      name: string;
      tuitionPerSession: number | null;
      sessionsPerWeek: number | null;
    }>;
  };
  employees: Array<{
    employeeCode: string;
    fullName: string;
    shortName: string;
    dob: string | null;
    position: string | null;
    phone: string | null;
    email: string | null;
    hometown: string | null;
    permanentAddress: string | null;
    idNumber: string | null;
    idIssueDate: string | null;
    idIssuePlace: string | null;
    contractSignDate: string | null;
    contractExpiryDate: string | null;
    resignDate: string | null;
    workStatus: string;
    teachingHourlyRate: number | null;
    payMode: string;
    rawPayModeHint?: string | null;
    rawAssistantRateHint?: string | null;
  }>;
  crm: {
    guardians: Array<{
      businessKey: string;
      fullName: string;
      phone: string | null;
      address: string | null;
    }>;
    leads: Array<{
      leadCode: string;
      fullName: string;
      gender: string | null;
      dob: string | null;
      phone: string | null;
      address: string | null;
      meetDate: string | null;
      interestedClassRef: string | null;
      status: string;
      sourceStatus?: string | null;
      expectedStartDate?: string | null;
      actualEnrollDate?: string | null;
      notes?: string | null;
      notes2?: string | null;
      guardianRef?: string | null;
      sourceBusinessKey?: string | null;
    }>;
  };
  academics: {
    classes: Array<{
      classCode: string;
      classGroup: string | null;
      className: string;
      courseRef: string | null;
      totalSessions: number | null;
      startDate: string | null;
      expectedEndDate: string | null;
      sessionsPerWeek: number | null;
      tuitionPerSession: number | null;
      status: string;
      notes: string | null;
      reminderDayOfMonth?: number | null;
      reminderWeekday?: string | null;
      reminderTask?: string | null;
      oneOffTaskDate?: string | null;
      oneOffTaskName?: string | null;
    }>;
    students: Array<{
      studentCode: string;
      studentDisplayId: string | null;
      fullName: string;
      phone: string | null;
      enrollDate: string | null;
      leaveDate: string | null;
      leaveReason: string | null;
      evaluation: string | null;
      status: string;
      leadRef?: string | null;
      classRef?: string | null;
      sourceBusinessKey?: string | null;
    }>;
    studentGuardianLinks: Array<{
      studentRef: string;
      guardianRef: string;
      isPrimary: boolean;
    }>;
    enrollments: Array<{
      studentRef: string;
      classRef: string;
      status: string;
      enrollDate: string | null;
      endDate: string | null;
    }>;
  };
  finance: {
    billingPeriods: Array<{
      periodName: string;
    }>;
    charges: Array<{
      businessKey: string;
      studentRef: string;
      classRef: string;
      billingPeriodRef: string;
      sessionCount: number;
      absentCount: number;
      deductedCount: number;
      unitPrice: number;
      tuitionAmount: number;
      materialsAmount: number;
      openingBalance: number;
      totalAmount: number;
      closingBalance?: number | null;
      paymentStatus?: string | null;
      notes?: string | null;
    }>;
    payments: Array<{
      paymentNo: string;
      studentRef: string;
      paidDate: string | null;
      amount: number;
      method?: string | null;
      receivedByName?: string | null;
      billingPeriodRef?: string | null;
      notes?: string | null;
    }>;
    cashCategories: Array<{
      type: string;
      name: string;
      detail: string | null;
      notes: string | null;
      handledByHint?: string | null;
    }>;
    cashTransactions: Array<{
      transactionNo: string;
      type: string;
      txnDate: string | null;
      categoryName?: string | null;
      detail?: string | null;
      description?: string | null;
      amount: number;
      handledByName?: string | null;
      notes?: string | null;
      billingPeriodRef?: string | null;
    }>;
  };
  inventory: {
    books: Array<{
      bookCode: string | null;
      name: string;
      unitPrice: number;
      quantityOnHand: number;
      notes: string | null;
    }>;
    stockReceipts: Array<{
      receiptNo: string;
      bookRef: string;
      classRef?: string | null;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
      txnDate: string | null;
      receivedByName?: string | null;
      handedByName?: string | null;
      usageStatus?: string | null;
      notes?: string | null;
      billingPeriodRef?: string | null;
    }>;
    bookIssues: Array<{
      issueNo: string;
      bookRef: string | null;
      classRef?: string | null;
      studentRef?: string | null;
      studentDisplayKey?: string | null;
      quantity: number;
      unitPrice: number;
      amount: number;
      issueDate: string | null;
      billingPeriodRef?: string | null;
      notes?: string | null;
    }>;
  };
};

type ImportReadiness = {
  readyTables: ReadinessTable[];
  partialTables: ReadinessTable[];
  blockedTables: ReadinessTable[];
  coreBlockers: string[];
};

type ReadinessTable = {
  table: string;
  rowCount: number;
  rowsWithAnyKey: number;
  rowsWithAllKeys: number;
  missingKeyCounts: Record<string, number>;
};

type ImportSummary = {
  targetEntity: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  notes?: string[];
};

type ImportJobStatus = "PENDING" | "VALIDATING" | "DRY_RUN" | "IMPORTED" | "FAILED" | "ROLLED_BACK";

const prisma = new PrismaClient();

function toDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getFlag(name: string): boolean {
  return process.argv.includes(name);
}

function getArg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index >= 0 && index < process.argv.length - 1) {
    return process.argv[index + 1];
  }
  return fallback;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function resolveBranch(branchCode?: string) {
  if (branchCode) {
    const branch = await prisma.branch.findUnique({
      where: { code: branchCode },
    });
    if (branch) {
      return branch;
    }
  }

  const firstBranch = await prisma.branch.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!firstBranch) {
    const organization =
      (await prisma.organization.findFirst({
        orderBy: { createdAt: "asc" },
      })) ??
      (await prisma.organization.create({
        data: {
          name: "Trung tâm (tạo tự động từ importer)",
        },
      }));

    return prisma.branch.create({
      data: {
        organizationId: organization.id,
        code: branchCode ?? "CS1",
        name: "Cơ sở 1",
        isActive: true,
      },
    });
  }

  return firstBranch;
}

async function ensureDefaultStockLocation(branchId: string, apply: boolean) {
  const existing = await prisma.stockLocation.findFirst({
    where: {
      branchId,
      name: "Kho mặc định",
    },
  });

  if (existing || !apply) {
    return existing;
  }

  return prisma.stockLocation.create({
    data: {
      branchId,
      name: "Kho mặc định",
    },
  });
}

async function recordImportJob(input: {
  branchId: string;
  sourceFile: string;
  targetEntity: string;
  status: ImportJobStatus;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorLog?: unknown;
}) {
  return prisma.importJob.create({
    data: {
      branchId: input.branchId,
      sourceFile: input.sourceFile,
      targetEntity: input.targetEntity,
      status: input.status,
      totalRows: input.totalRows,
      successRows: input.successRows,
      errorRows: input.errorRows,
      errorLog: input.errorLog ? JSON.stringify(input.errorLog, null, 2) : null,
    },
  });
}

async function importCourses(
  branchId: string,
  rows: CanonicalData["lookups"]["courses"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.courseCode || !row.name) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.course.findFirst({
      where: {
        branchId,
        code: row.courseCode,
      },
    });

    if (!apply) {
      if (existing) {
        updatedRows += 1;
      } else {
        createdRows += 1;
      }
      continue;
    }

    if (existing) {
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          tuitionPerSession: row.tuitionPerSession ?? 0,
          sessionsPerWeek: row.sessionsPerWeek ?? 0,
          isActive: true,
        },
      });
      updatedRows += 1;
    } else {
      await prisma.course.create({
        data: {
          branchId,
          code: row.courseCode,
          name: row.name,
          tuitionPerSession: row.tuitionPerSession ?? 0,
          sessionsPerWeek: row.sessionsPerWeek ?? 0,
          isActive: true,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "Course",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importTransactionCategories(
  rows: CanonicalData["finance"]["cashCategories"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.type || !row.name) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.transactionCategory.findFirst({
      where: {
        type: row.type,
        name: row.name,
        detail: row.detail ?? null,
      },
    });

    if (!apply) {
      if (existing) {
        updatedRows += 1;
      } else {
        createdRows += 1;
      }
      continue;
    }

    if (existing) {
      await prisma.transactionCategory.update({
        where: { id: existing.id },
        data: {
          notes: row.notes ?? existing.notes,
        },
      });
      updatedRows += 1;
    } else {
      await prisma.transactionCategory.create({
        data: {
          type: row.type,
          name: row.name,
          detail: row.detail,
          notes: row.notes ?? row.handledByHint ?? null,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "TransactionCategory",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importBooks(
  branchId: string,
  rows: CanonicalData["inventory"]["books"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.name) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.book.findFirst({
      where: {
        branchId,
        name: row.name,
      },
    });

    if (!apply) {
      if (existing) {
        updatedRows += 1;
      } else {
        createdRows += 1;
      }
      continue;
    }

    if (existing) {
      await prisma.book.update({
        where: { id: existing.id },
        data: {
          bookCode: row.bookCode ?? existing.bookCode,
          unitPrice: row.unitPrice,
          quantityOnHand: row.quantityOnHand,
          notes: row.notes ?? existing.notes,
        },
      });
      updatedRows += 1;
    } else {
      await prisma.book.create({
        data: {
          branchId,
          bookCode: row.bookCode,
          name: row.name,
          unitPrice: row.unitPrice,
          quantityOnHand: row.quantityOnHand,
          notes: row.notes,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "Book",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importEmployees(
  branchId: string,
  rows: CanonicalData["employees"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.employeeCode || !row.fullName || !row.shortName) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.employee.findUnique({
      where: { employeeCode: row.employeeCode },
      include: { contracts: true, payPolicies: true },
    });

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    const employeeData = {
      branchId,
      fullName: row.fullName,
      shortName: row.shortName,
      dob: toDateOrNull(row.dob),
      position: row.position,
      phone: row.phone,
      email: row.email,
      hometown: row.hometown,
      permanentAddress: row.permanentAddress,
      idNumber: row.idNumber,
      idIssueDate: toDateOrNull(row.idIssueDate),
      idIssuePlace: row.idIssuePlace,
      resignDate: toDateOrNull(row.resignDate),
      workStatus: row.workStatus || "ACTIVE",
      teachingHourlyRate: row.teachingHourlyRate ?? undefined,
      payMode: row.payMode || "HOURLY",
      notes: row.rawPayModeHint ?? row.rawAssistantRateHint ?? undefined,
    };

    const employee = existing
      ? await prisma.employee.update({
          where: { id: existing.id },
          data: employeeData,
        })
      : await prisma.employee.create({
          data: {
            employeeCode: row.employeeCode,
            ...employeeData,
          },
        });

    const signDate = toDateOrNull(row.contractSignDate);
    const expiryDate = toDateOrNull(row.contractExpiryDate);
    if (signDate || expiryDate) {
      const currentContract = existing?.contracts?.[0];
      if (currentContract) {
        await prisma.employmentContract.update({
          where: { id: currentContract.id },
          data: {
            signDate,
            expiryDate,
          },
        });
      } else {
        await prisma.employmentContract.create({
          data: {
            employeeId: employee.id,
            signDate,
            expiryDate,
          },
        });
      }
    }

    if (row.teachingHourlyRate) {
      const currentPolicy = existing?.payPolicies?.find(
        (policy) => policy.role === "TEACHER" && policy.rateType === row.payMode,
      );
      if (currentPolicy) {
        await prisma.payPolicy.update({
          where: { id: currentPolicy.id },
          data: {
            rateAmount: row.teachingHourlyRate,
            effectiveFrom: signDate ?? currentPolicy.effectiveFrom,
            notes: row.rawPayModeHint ?? currentPolicy.notes,
          },
        });
      } else {
        await prisma.payPolicy.create({
          data: {
            employeeId: employee.id,
            role: "TEACHER",
            rateType: row.payMode || "HOURLY",
            rateAmount: row.teachingHourlyRate,
            effectiveFrom: signDate ?? new Date(),
            notes: row.rawPayModeHint ?? undefined,
          },
        });
      }
    }

    if (existing) updatedRows += 1;
    else createdRows += 1;
  }

  return {
    targetEntity: "Employee",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importClasses(
  branchId: string,
  rows: CanonicalData["academics"]["classes"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.classCode || !row.className) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.class.findUnique({
      where: { classCode: row.classCode },
    });

    const course = row.courseRef
      ? await prisma.course.findFirst({
          where: {
            branchId,
            OR: [{ code: row.courseRef }, { name: row.courseRef }],
          },
        })
      : null;

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    const classData = {
      branchId,
      courseId: course?.id,
      classGroup: row.classGroup,
      className: row.className,
      totalSessions: row.totalSessions ?? undefined,
      startDate: toDateOrNull(row.startDate),
      expectedEndDate: toDateOrNull(row.expectedEndDate),
      sessionsPerWeek: row.sessionsPerWeek ?? undefined,
      tuitionPerSession: row.tuitionPerSession ?? undefined,
      status: row.status || "ACTIVE",
      notes: row.notes,
    };

    if (existing) {
      await prisma.class.update({
        where: { id: existing.id },
        data: classData,
      });
      updatedRows += 1;
    } else {
      await prisma.class.create({
        data: {
          classCode: row.classCode,
          ...classData,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "Class",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importGuardians(
  rows: CanonicalData["crm"]["guardians"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.fullName) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.guardian.findFirst({
      where: {
        fullName: row.fullName,
        phone: row.phone ?? null,
      },
    });

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    if (existing) {
      await prisma.guardian.update({
        where: { id: existing.id },
        data: {
          address: row.address ?? existing.address,
        },
      });
      updatedRows += 1;
    } else {
      await prisma.guardian.create({
        data: {
          fullName: row.fullName,
          phone: row.phone,
          address: row.address,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "Guardian",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importLeads(
  branchId: string,
  rows: CanonicalData["crm"]["leads"],
  guardians: CanonicalData["crm"]["guardians"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  const guardianMap = new Map<string, { id: string }>();
  if (guardians.length > 0) {
    const allGuardians = await prisma.guardian.findMany();
    for (const sourceGuardian of guardians) {
      const match = allGuardians.find(
        (item) => item.fullName === sourceGuardian.fullName && (item.phone ?? null) === (sourceGuardian.phone ?? null),
      );
      if (match) guardianMap.set(sourceGuardian.businessKey, { id: match.id });
    }
  }

  for (const row of rows) {
    if (!row.leadCode || !row.fullName) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.lead.findUnique({
      where: { leadCode: row.leadCode },
    });

    const classRef = row.interestedClassRef;
    const interestedClass = classRef
      ? await prisma.class.findFirst({
          where: {
            OR: [{ classCode: classRef }, { className: classRef }],
          },
        })
      : null;

    const leadData = {
      branchId,
      fullName: row.fullName,
      gender: row.gender,
      dob: toDateOrNull(row.dob),
      guardianId: row.guardianRef ? guardianMap.get(row.guardianRef)?.id : undefined,
      phone: row.phone,
      address: row.address,
      meetDate: toDateOrNull(row.meetDate),
      interestedClassId: interestedClass?.id,
      status: row.status || "NEW",
      expectedStartDate: toDateOrNull(row.expectedStartDate),
      actualEnrollDate: toDateOrNull(row.actualEnrollDate),
      source: row.sourceStatus ?? undefined,
      notes: row.notes ?? undefined,
      notes2: row.notes2 ?? undefined,
    };

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    if (existing) {
      await prisma.lead.update({
        where: { id: existing.id },
        data: leadData,
      });
      updatedRows += 1;
    } else {
      await prisma.lead.create({
        data: {
          leadCode: row.leadCode,
          ...leadData,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "Lead",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importStudents(
  branchId: string,
  rows: CanonicalData["academics"]["students"],
  links: CanonicalData["academics"]["studentGuardianLinks"],
  enrollments: CanonicalData["academics"]["enrollments"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  const leads = await prisma.lead.findMany({ select: { id: true, leadCode: true } });
  const leadMap = new Map(leads.map((item) => [item.leadCode, item.id]));
  const classes = await prisma.class.findMany({ select: { id: true, classCode: true, className: true } });
  const classMap = new Map<string, string>();
  for (const item of classes) {
    classMap.set(item.classCode, item.id);
    classMap.set(item.className, item.id);
  }

  for (const row of rows) {
    if (!row.studentCode || !row.fullName) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.student.findUnique({
      where: { studentCode: row.studentCode },
    });

    const studentData = {
      branchId,
      studentDisplayId: row.studentDisplayId,
      fullName: row.fullName,
      leadId: row.leadRef ? leadMap.get(row.leadRef) : undefined,
      phone: row.phone,
      enrollDate: toDateOrNull(row.enrollDate),
      leaveDate: toDateOrNull(row.leaveDate),
      leaveReason: row.leaveReason,
      evaluation: row.evaluation,
      status: row.status || "ACTIVE",
    };

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    const student = existing
      ? await prisma.student.update({
          where: { id: existing.id },
          data: studentData,
        })
      : await prisma.student.create({
          data: {
            studentCode: row.studentCode,
            ...studentData,
          },
        });

    const studentLinks = links.filter((item) => item.studentRef === row.studentCode);
    for (const link of studentLinks) {
      const lead = row.leadRef ? await prisma.lead.findUnique({ where: { leadCode: row.leadRef }, include: { guardian: true } }) : null;
      const guardianId = lead?.guardian?.id;
      if (!guardianId) continue;
      const existingLink = await prisma.studentGuardian.findFirst({
        where: { studentId: student.id, guardianId },
      });
      if (!existingLink) {
        await prisma.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId,
            isPrimary: link.isPrimary,
          },
        });
      }
    }

    const studentEnrollments = enrollments.filter((item) => item.studentRef === row.studentCode);
    for (const enrollment of studentEnrollments) {
      const classId = classMap.get(enrollment.classRef);
      if (!classId || !enrollment.enrollDate) continue;
      const existingEnrollment = await prisma.enrollment.findFirst({
        where: { studentId: student.id, classId },
      });
      if (existingEnrollment) {
        await prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: enrollment.status,
            enrollDate: toDateOrNull(enrollment.enrollDate) ?? existingEnrollment.enrollDate,
            endDate: toDateOrNull(enrollment.endDate),
          },
        });
      } else {
        const createdEnrollment = await prisma.enrollment.create({
          data: {
            studentId: student.id,
            classId,
            status: enrollment.status,
            enrollDate: toDateOrNull(enrollment.enrollDate) ?? new Date(),
            endDate: toDateOrNull(enrollment.endDate),
          },
        });
        await prisma.enrollmentStatusHistory.create({
          data: {
            studentId: student.id,
            enrollmentId: createdEnrollment.id,
            toStatus: enrollment.status,
          },
        });
      }
    }

    if (existing) updatedRows += 1;
    else createdRows += 1;
  }

  return {
    targetEntity: "Student",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

function getPeriodBoundary(periodName: string): { startDate: Date; endDate: Date } {
  const [yearText, monthText] = periodName.split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  if (!year || !month) {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }
  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0),
  };
}

async function importBillingPeriods(
  branchId: string,
  rows: CanonicalData["finance"]["billingPeriods"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    if (!row.periodName) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.billingPeriod.findFirst({
      where: { branchId, periodName: row.periodName },
    });
    const boundary = getPeriodBoundary(row.periodName);

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    if (existing) {
      await prisma.billingPeriod.update({
        where: { id: existing.id },
        data: {
          startDate: boundary.startDate,
          endDate: boundary.endDate,
        },
      });
      updatedRows += 1;
    } else {
      await prisma.billingPeriod.create({
        data: {
          branchId,
          periodName: row.periodName,
          startDate: boundary.startDate,
          endDate: boundary.endDate,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "BillingPeriod",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importCharges(
  rows: CanonicalData["finance"]["charges"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  const students = await prisma.student.findMany({ select: { id: true, studentCode: true } });
  const studentMap = new Map(students.map((item) => [item.studentCode, item.id]));
  const classes = await prisma.class.findMany({ select: { id: true, classCode: true, className: true } });
  const classMap = new Map<string, string>();
  for (const item of classes) {
    classMap.set(item.classCode, item.id);
    classMap.set(item.className, item.id);
  }
  const periods = await prisma.billingPeriod.findMany({ select: { id: true, periodName: true } });
  const periodMap = new Map(periods.map((item) => [item.periodName, item.id]));

  for (const row of rows) {
    const studentId = studentMap.get(row.studentRef);
    const classId = classMap.get(row.classRef);
    const billingPeriodId = periodMap.get(row.billingPeriodRef);

    if (!studentId || !classId || !billingPeriodId) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.charge.findFirst({
      where: { studentId, classId, billingPeriodId },
    });

    const chargeData = {
      sessionCount: row.sessionCount ?? 0,
      absentCount: row.absentCount ?? 0,
      deductedCount: row.deductedCount ?? 0,
      unitPrice: row.unitPrice ?? 0,
      tuitionAmount: row.tuitionAmount ?? 0,
      materialsAmount: row.materialsAmount ?? 0,
      openingBalance: row.openingBalance ?? 0,
      totalAmount: row.totalAmount ?? 0,
      notes: row.notes ?? row.paymentStatus ?? undefined,
    };

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    if (existing) {
      await prisma.charge.update({
        where: { id: existing.id },
        data: chargeData,
      });
      updatedRows += 1;
    } else {
      await prisma.charge.create({
        data: {
          studentId,
          classId,
          billingPeriodId,
          ...chargeData,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "Charge",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importPayments(
  rows: CanonicalData["finance"]["payments"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  const students = await prisma.student.findMany({ select: { id: true, studentCode: true } });
  const studentMap = new Map(students.map((item) => [item.studentCode, item.id]));
  const employees = await prisma.employee.findMany({ select: { id: true, fullName: true, shortName: true } });

  for (const row of rows) {
    const studentId = studentMap.get(row.studentRef);
    if (!studentId || !row.paymentNo || !row.paidDate || !row.amount) {
      skippedRows += 1;
      continue;
    }

    const existing = await prisma.payment.findUnique({
      where: { paymentNo: row.paymentNo },
    });
    const receiver = row.receivedByName
      ? employees.find(
          (item) => item.fullName === row.receivedByName || item.shortName === row.receivedByName,
        )
      : undefined;

    const paymentData = {
      studentId,
      paidDate: toDateOrNull(row.paidDate) ?? new Date(),
      amount: row.amount,
      method: row.method ?? undefined,
      receivedById: receiver?.id,
      notes: row.notes ?? row.billingPeriodRef ?? undefined,
    };

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    if (existing) {
      await prisma.payment.update({
        where: { id: existing.id },
        data: paymentData,
      });
      updatedRows += 1;
    } else {
      await prisma.payment.create({
        data: {
          paymentNo: row.paymentNo,
          ...paymentData,
        },
      });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "Payment",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importStockReceipts(
  branchId: string,
  stockLocationId: string | null,
  rows: CanonicalData["inventory"]["stockReceipts"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  const books = await prisma.book.findMany({ where: { branchId }, select: { id: true, name: true } });
  const bookMap = new Map(books.map((item) => [item.name, item.id]));
  const classes = await prisma.class.findMany({ select: { id: true, classCode: true, className: true } });
  const classMap = new Map<string, string>();
  for (const item of classes) {
    classMap.set(item.classCode, item.id);
    classMap.set(item.className, item.id);
  }
  const employees = await prisma.employee.findMany({ select: { id: true, fullName: true, shortName: true } });

  for (const row of rows) {
    const bookId = bookMap.get(row.bookRef);
    if (!bookId || !row.txnDate || !row.quantity) {
      skippedRows += 1;
      continue;
    }
    const txnDate = toDateOrNull(row.txnDate);
    if (!txnDate) {
      skippedRows += 1;
      continue;
    }

    const classId = row.classRef ? classMap.get(row.classRef) : undefined;
    const receivedBy = row.receivedByName
      ? employees.find((item) => item.fullName === row.receivedByName || item.shortName === row.receivedByName)
      : undefined;
    const handedBy = row.handedByName
      ? employees.find((item) => item.fullName === row.handedByName || item.shortName === row.handedByName)
      : undefined;

    const existing = await prisma.stockTransaction.findFirst({
      where: {
        bookId,
        type: "RECEIPT",
        txnDate,
        totalAmount: row.totalAmount,
      },
    });

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    const data = {
      bookId,
      locationId: stockLocationId ?? undefined,
      classId,
      type: "RECEIPT",
      quantity: row.quantity,
      unitPrice: row.unitPrice ?? 0,
      totalAmount: row.totalAmount ?? row.quantity * (row.unitPrice ?? 0),
      receivedById: receivedBy?.id,
      handedById: handedBy?.id,
      txnDate,
      notes: row.notes ?? row.usageStatus ?? undefined,
    };

    if (existing) {
      await prisma.stockTransaction.update({ where: { id: existing.id }, data });
      updatedRows += 1;
    } else {
      await prisma.stockTransaction.create({ data });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "StockTransaction",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importBookIssues(
  rows: CanonicalData["inventory"]["bookIssues"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  const books = await prisma.book.findMany({ select: { id: true, name: true } });
  const bookMap = new Map(books.map((item) => [item.name, item.id]));
  const students = await prisma.student.findMany({ select: { id: true, studentCode: true } });
  const studentMap = new Map(students.map((item) => [item.studentCode, item.id]));
  const classes = await prisma.class.findMany({ select: { id: true, classCode: true, className: true } });
  const classMap = new Map<string, string>();
  for (const item of classes) {
    classMap.set(item.classCode, item.id);
    classMap.set(item.className, item.id);
  }
  const periods = await prisma.billingPeriod.findMany({ select: { id: true, periodName: true } });
  const periodMap = new Map(periods.map((item) => [item.periodName, item.id]));

  for (const row of rows) {
    const bookId = row.bookRef ? bookMap.get(row.bookRef) : undefined;
    const studentId = row.studentRef ? studentMap.get(row.studentRef) : undefined;
    if (!bookId || !studentId || !row.issueDate) {
      skippedRows += 1;
      continue;
    }
    const issueDate = toDateOrNull(row.issueDate);
    if (!issueDate) {
      skippedRows += 1;
      continue;
    }

    const classId = row.classRef ? classMap.get(row.classRef) : undefined;
    let chargeId: string | undefined;
    if (row.billingPeriodRef && classId) {
      const billingPeriodId = periodMap.get(row.billingPeriodRef);
      if (billingPeriodId) {
        const charge = await prisma.charge.findFirst({
          where: { studentId, classId, billingPeriodId },
          select: { id: true },
        });
        chargeId = charge?.id;
      }
    }

    const existing = await prisma.bookIssue.findFirst({
      where: { bookId, studentId, issueDate },
    });

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    const data = {
      bookId,
      classId,
      studentId,
      chargeId,
      quantity: row.quantity || 1,
      unitPrice: row.unitPrice || 0,
      amount: row.amount || row.quantity * (row.unitPrice || 0),
      issueDate,
      notes: row.notes ?? row.studentDisplayKey ?? undefined,
    };

    if (existing) {
      await prisma.bookIssue.update({ where: { id: existing.id }, data });
      updatedRows += 1;
    } else {
      await prisma.bookIssue.create({ data });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "BookIssue",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function importCashTransactions(
  branchId: string,
  rows: CanonicalData["finance"]["cashTransactions"],
  apply: boolean,
): Promise<ImportSummary> {
  let createdRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  const categories = await prisma.transactionCategory.findMany({ select: { id: true, type: true, name: true } });
  const employees = await prisma.employee.findMany({ select: { id: true, fullName: true, shortName: true } });

  for (const row of rows) {
    if (!row.txnDate || !row.amount) {
      skippedRows += 1;
      continue;
    }
    const txnDate = toDateOrNull(row.txnDate);
    if (!txnDate) {
      skippedRows += 1;
      continue;
    }

    const category = row.categoryName
      ? categories.find((item) => item.type === row.type && item.name === row.categoryName)
      : undefined;
    const handler = row.handledByName
      ? employees.find((item) => item.fullName === row.handledByName || item.shortName === row.handledByName)
      : undefined;

    const existing = await prisma.cashTransaction.findFirst({
      where: {
        branchId,
        type: row.type,
        txnDate,
        amount: row.amount,
        description: row.description ?? null,
      },
    });

    if (!apply) {
      if (existing) updatedRows += 1;
      else createdRows += 1;
      continue;
    }

    const data = {
      branchId,
      categoryId: category?.id,
      type: row.type,
      txnDate,
      detail: row.detail ?? undefined,
      description: row.description ?? undefined,
      amount: row.amount,
      handledById: handler?.id,
      notes: row.notes ?? row.billingPeriodRef ?? undefined,
    };

    if (existing) {
      await prisma.cashTransaction.update({ where: { id: existing.id }, data });
      updatedRows += 1;
    } else {
      await prisma.cashTransaction.create({ data });
      createdRows += 1;
    }
  }

  return {
    targetEntity: "CashTransaction",
    totalRows: rows.length,
    successRows: createdRows + updatedRows,
    errorRows: skippedRows,
    createdRows,
    updatedRows,
    skippedRows,
  };
}

async function main() {
  const apply = getFlag("--apply");
  const inputDir = getArg("--input", path.join("docs", "generated", "workbook_2026"))!;
  const branchCode = getArg("--branch-code");
  const sourceFile = getArg("--source-file", "docs/File Quan ly tong 2026.xlsx")!;

  const canonical = await readJsonFile<CanonicalData>(path.join(inputDir, "canonical.json"));
  const readiness = await readJsonFile<ImportReadiness>(path.join(inputDir, "import_readiness.json"));

  const branch = await resolveBranch(branchCode);
  const stockLocation = await ensureDefaultStockLocation(branch.id, apply);

  const summaries: ImportSummary[] = [];

  const courseSummary = await importCourses(branch.id, canonical.lookups.courses, apply);
  summaries.push(courseSummary);

  const employeeSummary = await importEmployees(branch.id, canonical.employees, apply);
  summaries.push(employeeSummary);

  const classSummary = await importClasses(branch.id, canonical.academics.classes, apply);
  summaries.push(classSummary);

  const guardianSummary = await importGuardians(canonical.crm.guardians, apply);
  summaries.push(guardianSummary);

  const leadSummary = await importLeads(branch.id, canonical.crm.leads, canonical.crm.guardians, apply);
  summaries.push(leadSummary);

  const studentSummary = await importStudents(
    branch.id,
    canonical.academics.students,
    canonical.academics.studentGuardianLinks,
    canonical.academics.enrollments,
    apply,
  );
  summaries.push(studentSummary);

  const billingPeriodSummary = await importBillingPeriods(
    branch.id,
    canonical.finance.billingPeriods,
    apply,
  );
  summaries.push(billingPeriodSummary);

  const chargeSummary = await importCharges(canonical.finance.charges, apply);
  summaries.push(chargeSummary);

  const paymentSummary = await importPayments(canonical.finance.payments, apply);
  summaries.push(paymentSummary);

  const categorySummary = await importTransactionCategories(canonical.finance.cashCategories, apply);
  summaries.push(categorySummary);

  const bookSummary = await importBooks(branch.id, canonical.inventory.books, apply);
  summaries.push(bookSummary);

  const stockReceiptSummary = await importStockReceipts(
    branch.id,
    stockLocation ? stockLocation.id : null,
    canonical.inventory.stockReceipts,
    apply,
  );
  summaries.push(stockReceiptSummary);

  const bookIssueSummary = await importBookIssues(canonical.inventory.bookIssues, apply);
  summaries.push(bookIssueSummary);

  const cashTransactionSummary = await importCashTransactions(
    branch.id,
    canonical.finance.cashTransactions,
    apply,
  );
  summaries.push(cashTransactionSummary);

  const noModelTables: ReadinessTable[] = readiness.readyTables.filter(
    (item) => item.table === "MucLuc.Table3",
  ).concat(readiness.partialTables.filter((item) => item.table === "MucLuc.Table1"));

  if (apply) {
    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Course",
      status: "IMPORTED",
      totalRows: courseSummary.totalRows,
      successRows: courseSummary.successRows,
      errorRows: courseSummary.errorRows,
      errorLog: {
        createdRows: courseSummary.createdRows,
        updatedRows: courseSummary.updatedRows,
        skippedRows: courseSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Employee",
      status: "IMPORTED",
      totalRows: employeeSummary.totalRows,
      successRows: employeeSummary.successRows,
      errorRows: employeeSummary.errorRows,
      errorLog: {
        createdRows: employeeSummary.createdRows,
        updatedRows: employeeSummary.updatedRows,
        skippedRows: employeeSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Class",
      status: "IMPORTED",
      totalRows: classSummary.totalRows,
      successRows: classSummary.successRows,
      errorRows: classSummary.errorRows,
      errorLog: {
        createdRows: classSummary.createdRows,
        updatedRows: classSummary.updatedRows,
        skippedRows: classSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Guardian",
      status: "IMPORTED",
      totalRows: guardianSummary.totalRows,
      successRows: guardianSummary.successRows,
      errorRows: guardianSummary.errorRows,
      errorLog: {
        createdRows: guardianSummary.createdRows,
        updatedRows: guardianSummary.updatedRows,
        skippedRows: guardianSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Lead",
      status: "IMPORTED",
      totalRows: leadSummary.totalRows,
      successRows: leadSummary.successRows,
      errorRows: leadSummary.errorRows,
      errorLog: {
        createdRows: leadSummary.createdRows,
        updatedRows: leadSummary.updatedRows,
        skippedRows: leadSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Student",
      status: "IMPORTED",
      totalRows: studentSummary.totalRows,
      successRows: studentSummary.successRows,
      errorRows: studentSummary.errorRows,
      errorLog: {
        createdRows: studentSummary.createdRows,
        updatedRows: studentSummary.updatedRows,
        skippedRows: studentSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "BillingPeriod",
      status: "IMPORTED",
      totalRows: billingPeriodSummary.totalRows,
      successRows: billingPeriodSummary.successRows,
      errorRows: billingPeriodSummary.errorRows,
      errorLog: {
        createdRows: billingPeriodSummary.createdRows,
        updatedRows: billingPeriodSummary.updatedRows,
        skippedRows: billingPeriodSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Charge",
      status: "IMPORTED",
      totalRows: chargeSummary.totalRows,
      successRows: chargeSummary.successRows,
      errorRows: chargeSummary.errorRows,
      errorLog: {
        createdRows: chargeSummary.createdRows,
        updatedRows: chargeSummary.updatedRows,
        skippedRows: chargeSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Payment",
      status: "IMPORTED",
      totalRows: paymentSummary.totalRows,
      successRows: paymentSummary.successRows,
      errorRows: paymentSummary.errorRows,
      errorLog: {
        createdRows: paymentSummary.createdRows,
        updatedRows: paymentSummary.updatedRows,
        skippedRows: paymentSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "TransactionCategory",
      status: "IMPORTED",
      totalRows: categorySummary.totalRows,
      successRows: categorySummary.successRows,
      errorRows: categorySummary.errorRows,
      errorLog: {
        createdRows: categorySummary.createdRows,
        updatedRows: categorySummary.updatedRows,
        skippedRows: categorySummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "Book",
      status: "IMPORTED",
      totalRows: readiness.readyTables.find((item) => item.table === "XuatNhapSach.T_SachTon")?.rowCount ?? bookSummary.totalRows,
      successRows: bookSummary.successRows,
      errorRows: (readiness.readyTables.find((item) => item.table === "XuatNhapSach.T_SachTon")?.rowCount ?? bookSummary.totalRows) - bookSummary.successRows,
      errorLog: {
        createdRows: bookSummary.createdRows,
        updatedRows: bookSummary.updatedRows,
        skippedRows: bookSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "StockTransaction",
      status: "IMPORTED",
      totalRows: stockReceiptSummary.totalRows,
      successRows: stockReceiptSummary.successRows,
      errorRows: stockReceiptSummary.errorRows,
      errorLog: {
        createdRows: stockReceiptSummary.createdRows,
        updatedRows: stockReceiptSummary.updatedRows,
        skippedRows: stockReceiptSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "BookIssue",
      status: "IMPORTED",
      totalRows: bookIssueSummary.totalRows,
      successRows: bookIssueSummary.successRows,
      errorRows: bookIssueSummary.errorRows,
      errorLog: {
        createdRows: bookIssueSummary.createdRows,
        updatedRows: bookIssueSummary.updatedRows,
        skippedRows: bookIssueSummary.skippedRows,
      },
    });

    await recordImportJob({
      branchId: branch.id,
      sourceFile,
      targetEntity: "CashTransaction",
      status: "IMPORTED",
      totalRows: cashTransactionSummary.totalRows,
      successRows: cashTransactionSummary.successRows,
      errorRows: cashTransactionSummary.errorRows,
      errorLog: {
        createdRows: cashTransactionSummary.createdRows,
        updatedRows: cashTransactionSummary.updatedRows,
        skippedRows: cashTransactionSummary.skippedRows,
      },
    });

    for (const table of noModelTables) {
      await recordImportJob({
        branchId: branch.id,
        sourceFile,
        targetEntity: table.table,
        status: "VALIDATING",
        totalRows: table.rowCount,
        successRows: 0,
        errorRows: table.rowCount,
        errorLog: {
          reason: "Bảng lookup hỗ trợ runtime, hiện schema chưa có model persist riêng.",
          missingKeyCounts: table.missingKeyCounts,
        },
      });
    }

    for (const table of readiness.blockedTables) {
      await recordImportJob({
        branchId: branch.id,
        sourceFile,
        targetEntity: table.table,
        status: "FAILED",
        totalRows: table.rowCount,
        successRows: 0,
        errorRows: table.rowCount,
        errorLog: {
          missingKeyCounts: table.missingKeyCounts,
          reason: "Thiếu khóa nghiệp vụ để import an toàn vào ERP.",
        },
      });
    }
  }

  const output = {
    mode: apply ? "apply" : "dry-run",
    branch: {
      id: branch.id,
      code: branch.code,
      name: branch.name,
    },
    stockLocation: stockLocation
      ? { id: stockLocation.id, name: stockLocation.name }
      : { name: "Kho mặc định", pendingCreation: !apply },
    imported: summaries,
    blockedTables: readiness.blockedTables.length,
    partialTables: readiness.partialTables.length,
    readyTables: readiness.readyTables.length,
    coreBlockers: readiness.coreBlockers,
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
