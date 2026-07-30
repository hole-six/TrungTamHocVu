import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedRolesAndPermissions } from "../prisma/seeds/roles-permissions";

const prisma = new PrismaClient();

function periodRange(periodName: string) {
  const [yearText, monthText] = periodName.split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0),
  };
}

async function main() {
  await seedRolesAndPermissions();

  const passwordHash = await hash("Demo@123", 10);

  const organization =
    (await prisma.organization.findFirst({ where: { name: "Trung Tâm Học Vụ Demo" } })) ??
    (await prisma.organization.create({
      data: {
        name: "Trung Tâm Học Vụ Demo",
        address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
        phone: "0909000001",
      },
    }));

  const branch =
    (await prisma.branch.findUnique({ where: { code: "CS1" } })) ??
    (await prisma.branch.create({
      data: {
        organizationId: organization.id,
        code: "CS1",
        name: "Cơ sở 1",
        address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
        phone: "0909000001",
        isActive: true,
      },
    }));

  const [
    directorRole,
    teacherRole,
    accountantRole,
    receptionistRole,
    branchManagerRole,
    teachingAssistantRole,
    hrRole,
    registrarRole,
    admissionsRole,
    boardRole,
  ] = await Promise.all([
    prisma.role.findUnique({ where: { code: "DIRECTOR" } }),
    prisma.role.findUnique({ where: { code: "TEACHER" } }),
    prisma.role.findUnique({ where: { code: "ACCOUNTANT" } }),
    prisma.role.findUnique({ where: { code: "RECEPTIONIST" } }),
    prisma.role.findUnique({ where: { code: "BRANCH_MANAGER" } }),
    prisma.role.findUnique({ where: { code: "TEACHING_ASSISTANT" } }),
    prisma.role.findUnique({ where: { code: "HR" } }),
    prisma.role.findUnique({ where: { code: "REGISTRAR" } }),
    prisma.role.findUnique({ where: { code: "ADMISSIONS" } }),
    prisma.role.findUnique({ where: { code: "BOARD" } }),
  ]);

  const teacher =
    (await prisma.employee.findUnique({ where: { employeeCode: "EMP-T001" } })) ??
    (await prisma.employee.create({
      data: {
        branchId: branch.id,
        employeeCode: "EMP-T001",
        fullName: "Nguyễn Minh Anh",
        shortName: "M.Anh",
        dob: new Date("1995-08-14"),
        position: "Giáo viên",
        phone: "0909000002",
        email: "teacher.demo@tach.vn",
        workStatus: "ACTIVE",
        teachingHourlyRate: 180000,
        assistantHourlyRate: 120000,
        payMode: "HOURLY",
      },
    }));

  const assistant =
    (await prisma.employee.findUnique({ where: { employeeCode: "EMP-A001" } })) ??
    (await prisma.employee.create({
      data: {
        branchId: branch.id,
        employeeCode: "EMP-A001",
        fullName: "Trần Gia Hân",
        shortName: "G.Hân",
        dob: new Date("1999-04-21"),
        position: "Trợ giảng",
        phone: "0909000003",
        email: "assistant.demo@tach.vn",
        workStatus: "ACTIVE",
        teachingHourlyRate: 120000,
        assistantHourlyRate: 90000,
        payMode: "HOURLY",
      },
    }));

  const accountant =
    (await prisma.employee.findUnique({ where: { employeeCode: "EMP-KT01" } })) ??
    (await prisma.employee.create({
      data: {
        branchId: branch.id,
        employeeCode: "EMP-KT01",
        fullName: "Lê Thu Trang",
        shortName: "T.Trang",
        dob: new Date("1992-02-11"),
        position: "Kế toán",
        phone: "0909000004",
        email: "accountant.demo@tach.vn",
        workStatus: "ACTIVE",
        payMode: "MONTHLY",
      },
    }));

  const teacherContract = await prisma.employmentContract.findFirst({ where: { employeeId: teacher.id } });
  if (teacherContract) {
    await prisma.employmentContract.update({
      where: { id: teacherContract.id },
      data: {
        contractNo: "HD-GV-2026-001",
        signDate: new Date("2026-01-01"),
        expiryDate: new Date("2026-12-31"),
      },
    });
  } else {
    await prisma.employmentContract.create({
      data: {
        employeeId: teacher.id,
        contractNo: "HD-GV-2026-001",
        signDate: new Date("2026-01-01"),
        expiryDate: new Date("2026-12-31"),
      },
    });
  }

  const teacherPolicy = await prisma.payPolicy.findFirst({ where: { employeeId: teacher.id, role: "TEACHER" } });
  if (teacherPolicy) {
    await prisma.payPolicy.update({
      where: { id: teacherPolicy.id },
      data: {
        rateType: "HOURLY",
        rateAmount: 180000,
        effectiveFrom: new Date("2026-01-01"),
      },
    });
  } else {
    await prisma.payPolicy.create({
      data: {
        employeeId: teacher.id,
        role: "TEACHER",
        rateType: "HOURLY",
        rateAmount: 180000,
        effectiveFrom: new Date("2026-01-01"),
      },
    });
  }

  const directorUser =
    (await prisma.user.findUnique({ where: { email: "admin@demo.vn" } })) ??
    (await prisma.user.create({
      data: {
        email: "admin@demo.vn",
        passwordHash,
        fullName: "Admin Demo",
        role: "admin",
        roleId: directorRole?.id,
        branchId: branch.id,
        isActive: true,
      },
    }));

  await prisma.user.upsert({
    where: { email: "teacher.demo@tach.vn" },
    update: {
      role: "user",
      roleId: teacherRole?.id,
      branchId: branch.id,
      employeeId: teacher.id,
      passwordHash,
      fullName: teacher.fullName,
    },
    create: {
      email: "teacher.demo@tach.vn",
      passwordHash,
      fullName: teacher.fullName,
      role: "user",
      roleId: teacherRole?.id,
      branchId: branch.id,
      employeeId: teacher.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "accountant.demo@tach.vn" },
    update: {
      role: "user",
      roleId: accountantRole?.id,
      branchId: branch.id,
      employeeId: accountant.id,
      passwordHash,
      fullName: accountant.fullName,
    },
    create: {
      email: "accountant.demo@tach.vn",
      passwordHash,
      fullName: accountant.fullName,
      role: "user",
      roleId: accountantRole?.id,
      branchId: branch.id,
      employeeId: accountant.id,
      isActive: true,
    },
  });

  // Trợ giảng (Employee EMP-A001 đã tạo ở trên) — chỉ còn thiếu tài khoản đăng nhập.
  await prisma.user.upsert({
    where: { email: "assistant.demo@tach.vn" },
    update: {
      role: "user",
      roleId: teachingAssistantRole?.id,
      branchId: branch.id,
      employeeId: assistant.id,
      passwordHash,
      fullName: assistant.fullName,
    },
    create: {
      email: "assistant.demo@tach.vn",
      passwordHash,
      fullName: assistant.fullName,
      role: "user",
      roleId: teachingAssistantRole?.id,
      branchId: branch.id,
      employeeId: assistant.id,
      isActive: true,
    },
  });

  // Các vai trò còn lại — mỗi vai trò 1 nhân viên + 1 tài khoản đăng nhập, đủ để
  // Giám đốc test toàn bộ ma trận phân quyền (lib/server/role-matrix.ts) qua UI thật.
  const remainingRoleAccounts: Array<{
    employeeCode: string;
    fullName: string;
    shortName: string;
    position: string;
    email: string;
    roleId: string | undefined;
    payMode: "HOURLY" | "MONTHLY";
  }> = [
    {
      employeeCode: "EMP-QL01",
      fullName: "Phạm Đức Long",
      shortName: "Đ.Long",
      position: "Quản lý cơ sở",
      email: "manager.demo@tach.vn",
      roleId: branchManagerRole?.id,
      payMode: "MONTHLY",
    },
    {
      employeeCode: "EMP-LT01",
      fullName: "Vũ Ngọc Hà",
      shortName: "N.Hà",
      position: "Lễ tân",
      email: "receptionist.demo@tach.vn",
      roleId: receptionistRole?.id,
      payMode: "MONTHLY",
    },
    {
      employeeCode: "EMP-NS01",
      fullName: "Đặng Thị Hoa",
      shortName: "T.Hoa",
      position: "Nhân sự",
      email: "hr.demo@tach.vn",
      roleId: hrRole?.id,
      payMode: "MONTHLY",
    },
    {
      employeeCode: "EMP-GV01",
      fullName: "Bùi Thanh Tùng",
      shortName: "T.Tùng",
      position: "Giáo vụ",
      email: "registrar.demo@tach.vn",
      roleId: registrarRole?.id,
      payMode: "MONTHLY",
    },
    {
      employeeCode: "EMP-TS01",
      fullName: "Hoàng Mai Linh",
      shortName: "M.Linh",
      position: "Tư vấn tuyển sinh",
      email: "admissions.demo@tach.vn",
      roleId: admissionsRole?.id,
      payMode: "MONTHLY",
    },
    {
      employeeCode: "EMP-BGD01",
      fullName: "Ngô Quốc Việt",
      shortName: "Q.Việt",
      position: "Ban Giám Đốc",
      email: "board.demo@tach.vn",
      roleId: boardRole?.id,
      payMode: "MONTHLY",
    },
  ];

  for (const acc of remainingRoleAccounts) {
    const employee =
      (await prisma.employee.findUnique({ where: { employeeCode: acc.employeeCode } })) ??
      (await prisma.employee.create({
        data: {
          branchId: branch.id,
          employeeCode: acc.employeeCode,
          fullName: acc.fullName,
          shortName: acc.shortName,
          position: acc.position,
          email: acc.email,
          workStatus: "ACTIVE",
          payMode: acc.payMode,
        },
      }));

    await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        role: "user",
        roleId: acc.roleId,
        branchId: branch.id,
        employeeId: employee.id,
        passwordHash,
        fullName: employee.fullName,
      },
      create: {
        email: acc.email,
        passwordHash,
        fullName: employee.fullName,
        role: "user",
        roleId: acc.roleId,
        branchId: branch.id,
        employeeId: employee.id,
        isActive: true,
      },
    });
  }

  const course =
    (await prisma.course.findFirst({ where: { branchId: branch.id, code: "FF" } })) ??
    (await prisma.course.create({
      data: {
        branchId: branch.id,
        code: "FF",
        name: "First Friends",
        tuitionPerSession: 170000,
        sessionsPerWeek: 2,
        isActive: true,
      },
    }));

  const classRoom =
    (await prisma.class.findUnique({ where: { classCode: "FF-A1" } })) ??
    (await prisma.class.create({
      data: {
        branchId: branch.id,
        courseId: course.id,
        classCode: "FF-A1",
        classGroup: "A1",
        className: "First Friends A1",
        totalSessions: 24,
        startDate: new Date("2026-07-01"),
        expectedEndDate: new Date("2026-09-30"),
        sessionsPerWeek: 2,
        tuitionPerSession: 170000,
        status: "ACTIVE",
      },
    }));

  const scheduleRule =
    (await prisma.scheduleRule.findFirst({ where: { classId: classRoom.id, weekday: 2, startTime: "17:30" } })) ??
    (await prisma.scheduleRule.create({
      data: {
        classId: classRoom.id,
        weekday: 2,
        startTime: "17:30",
        endTime: "19:00",
        room: "Room A",
      },
    }));

  const guardian =
    (await prisma.guardian.findFirst({ where: { fullName: "Phạm Thu Hà", phone: "0909000005" } })) ??
    (await prisma.guardian.create({
      data: {
        fullName: "Phạm Thu Hà",
        phone: "0909000005",
        address: "Quận 3, TP.HCM",
      },
    }));

  const lead =
    (await prisma.lead.findUnique({ where: { leadCode: "LEAD-0001" } })) ??
    (await prisma.lead.create({
      data: {
        branchId: branch.id,
        leadCode: "LEAD-0001",
        fullName: "Nguyễn Bảo Ngọc",
        gender: "FEMALE",
        dob: new Date("2016-05-10"),
        guardianId: guardian.id,
        phone: "0909000005",
        address: "Quận 3, TP.HCM",
        meetDate: new Date("2026-06-20"),
        interestedClassId: classRoom.id,
        status: "ENROLLED",
        expectedStartDate: new Date("2026-07-01"),
        actualEnrollDate: new Date("2026-07-01"),
      },
    }));

  const placementTest = await prisma.placementTest.findFirst({ where: { leadId: lead.id } });
  if (placementTest) {
    await prisma.placementTest.update({
      where: { id: placementTest.id },
      data: {
        testDate: new Date("2026-06-25"),
        status: "PASSED",
        suggestedClass: classRoom.className,
      },
    });
  } else {
    await prisma.placementTest.create({
      data: {
        leadId: lead.id,
        testDate: new Date("2026-06-25"),
        status: "PASSED",
        suggestedClass: classRoom.className,
      },
    });
  }

  const student =
    (await prisma.student.findUnique({ where: { studentCode: "STU-0001" } })) ??
    (await prisma.student.create({
      data: {
        branchId: branch.id,
        studentCode: "STU-0001",
        studentDisplayId: "3-FFA1-STU0001",
        fullName: "Nguyễn Bảo Ngọc",
        leadId: lead.id,
        gender: "FEMALE",
        dob: new Date("2016-05-10"),
        phone: "0909000005",
        address: "Quận 3, TP.HCM",
        enrollDate: new Date("2026-07-01"),
        evaluation: "Tiếp thu tốt",
        status: "ACTIVE",
      },
    }));

  const studentGuardian =
    (await prisma.studentGuardian.findFirst({ where: { studentId: student.id, guardianId: guardian.id } })) ??
    (await prisma.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardian.id,
        relation: "Mẹ",
        isPrimary: true,
      },
    }));

  const enrollment =
    (await prisma.enrollment.findFirst({ where: { studentId: student.id, classId: classRoom.id } })) ??
    (await prisma.enrollment.create({
      data: {
        studentId: student.id,
        classId: classRoom.id,
        status: "ACTIVE",
        enrollDate: new Date("2026-07-01"),
      },
    }));

  await prisma.enrollmentStatusHistory.create({
    data: {
      studentId: student.id,
      enrollmentId: enrollment.id,
      toStatus: "ACTIVE",
      changedById: directorUser.id,
    },
  }).catch(() => undefined);

  const session =
    (await prisma.classSession.findFirst({ where: { classId: classRoom.id, sessionDate: new Date("2026-07-07") } })) ??
    (await prisma.classSession.create({
      data: {
        classId: classRoom.id,
        sessionDate: new Date("2026-07-07"),
        startTime: "17:30",
        endTime: "19:00",
        room: "Room A",
        status: "COMPLETED",
        completedAt: new Date("2026-07-07T19:00:00"),
      },
    }));

  await prisma.sessionAssignment.upsert({
    where: {
      sessionId_employeeId_role: {
        sessionId: session.id,
        employeeId: teacher.id,
        role: "TEACHER",
      },
    },
    update: {
      hours: 1.5,
      hourlyRate: 180000,
      amount: 270000,
    },
    create: {
      sessionId: session.id,
      employeeId: teacher.id,
      role: "TEACHER",
      hours: 1.5,
      hourlyRate: 180000,
      amount: 270000,
    },
  });

  await prisma.sessionAssignment.upsert({
    where: {
      sessionId_employeeId_role: {
        sessionId: session.id,
        employeeId: assistant.id,
        role: "ASSISTANT",
      },
    },
    update: {
      hours: 1.5,
      hourlyRate: 90000,
      amount: 135000,
    },
    create: {
      sessionId: session.id,
      employeeId: assistant.id,
      role: "ASSISTANT",
      hours: 1.5,
      hourlyRate: 90000,
      amount: 135000,
    },
  });

  await prisma.studentAttendance.upsert({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId: student.id,
      },
    },
    update: { status: "PRESENT" },
    create: {
      sessionId: session.id,
      studentId: student.id,
      status: "PRESENT",
    },
  });

  const timesheetPeriod =
    (await prisma.timesheetPeriod.findFirst({ where: { branchId: branch.id, periodName: "2026-07" } })) ??
    (await prisma.timesheetPeriod.create({
      data: {
        branchId: branch.id,
        periodName: "2026-07",
        ...periodRange("2026-07"),
      },
    }));

  await prisma.timesheetEntry.upsert({
    where: {
      employeeId_workDate: {
        employeeId: accountant.id,
        workDate: new Date("2026-07-07"),
      },
    },
    update: {
      periodId: timesheetPeriod.id,
      hours: 8,
      days: 1,
    },
    create: {
      periodId: timesheetPeriod.id,
      employeeId: accountant.id,
      workDate: new Date("2026-07-07"),
      checkInAm: "08:00",
      checkOutAm: "12:00",
      checkInPm: "13:00",
      checkOutPm: "17:00",
      hours: 8,
      days: 1,
    },
  });

  const billingPeriod =
    (await prisma.billingPeriod.findFirst({ where: { branchId: branch.id, periodName: "2026-07" } })) ??
    (await prisma.billingPeriod.create({
      data: {
        branchId: branch.id,
        periodName: "2026-07",
        ...periodRange("2026-07"),
        status: "GENERATED",
      },
    }));

  const charge =
    (await prisma.charge.findFirst({
      where: {
        studentId: student.id,
        classId: classRoom.id,
        billingPeriodId: billingPeriod.id,
      },
    })) ??
    (await prisma.charge.create({
      data: {
        studentId: student.id,
        classId: classRoom.id,
        billingPeriodId: billingPeriod.id,
        sessionCount: 8,
        absentCount: 0,
        deductedCount: 0,
        unitPrice: 170000,
        tuitionAmount: 1360000,
        materialsAmount: 150000,
        openingBalance: 0,
        totalAmount: 1510000,
      },
    }));

  await prisma.invoice.upsert({
    where: { chargeId: charge.id },
    update: {},
    create: {
      chargeId: charge.id,
      invoiceNo: "INV-2026-07-0001",
    },
  });

  const payment =
    (await prisma.payment.findUnique({ where: { paymentNo: "PAY-2026-07-0001" } })) ??
    (await prisma.payment.create({
      data: {
        studentId: student.id,
        paymentNo: "PAY-2026-07-0001",
        paidDate: new Date("2026-07-10"),
        amount: 1510000,
        method: "CASH",
        receivedById: accountant.id,
      },
    }));

  await prisma.paymentAllocation.upsert({
    where: {
      paymentId_chargeId: {
        paymentId: payment.id,
        chargeId: charge.id,
      },
    },
    update: { amount: 1510000 },
    create: {
      paymentId: payment.id,
      chargeId: charge.id,
      amount: 1510000,
    },
  });

  const tuitionCategory =
    (await prisma.transactionCategory.findFirst({ where: { type: "THU", name: "Học phí" } })) ??
    (await prisma.transactionCategory.create({
      data: {
        type: "THU",
        name: "Học phí",
        detail: "Thu học phí tháng",
      },
    }));

  const cashTxn =
    (await prisma.cashTransaction.findFirst({
      where: {
        branchId: branch.id,
        type: "THU",
        txnDate: new Date("2026-07-10"),
        amount: 1510000,
        description: "Thu học phí Nguyễn Bảo Ngọc",
      },
    })) ??
    (await prisma.cashTransaction.create({
      data: {
        branchId: branch.id,
        categoryId: tuitionCategory.id,
        type: "THU",
        txnDate: new Date("2026-07-10"),
        detail: "Học phí tháng 07/2026",
        description: "Thu học phí Nguyễn Bảo Ngọc",
        amount: 1510000,
        handledById: accountant.id,
      },
    }));

  await prisma.paymentCashPosting.upsert({
    where: { paymentId: payment.id },
    update: {
      cashTransactionId: cashTxn.id,
      amount: 1510000,
    },
    create: {
      paymentId: payment.id,
      cashTransactionId: cashTxn.id,
      amount: 1510000,
    },
  });

  const book =
    (await prisma.book.findFirst({ where: { branchId: branch.id, name: "First Friends 1 - Classbook" } })) ??
    (await prisma.book.create({
      data: {
        branchId: branch.id,
        bookCode: "BOOK-FF1-CB",
        name: "First Friends 1 - Classbook",
        unitPrice: 150000,
        quantityOnHand: 10,
      },
    }));

  const stockLocation =
    (await prisma.stockLocation.findFirst({ where: { branchId: branch.id, name: "Kho mặc định" } })) ??
    (await prisma.stockLocation.create({
      data: {
        branchId: branch.id,
        name: "Kho mặc định",
      },
    }));

  const stockReceipt =
    (await prisma.stockTransaction.findFirst({
      where: {
        bookId: book.id,
        type: "RECEIPT",
        txnDate: new Date("2026-07-01"),
        totalAmount: 1500000,
      },
    })) ??
    (await prisma.stockTransaction.create({
      data: {
        bookId: book.id,
        locationId: stockLocation.id,
        type: "RECEIPT",
        quantity: 10,
        unitPrice: 150000,
        totalAmount: 1500000,
        receivedById: accountant.id,
        handedById: accountant.id,
        txnDate: new Date("2026-07-01"),
      },
    }));

  const materialCharge =
    (await prisma.bookIssue.findFirst({
      where: { bookId: book.id, studentId: student.id, issueDate: new Date("2026-07-10") },
    })) ??
    (await prisma.bookIssue.create({
      data: {
        bookId: book.id,
        classId: classRoom.id,
        studentId: student.id,
        chargeId: charge.id,
        quantity: 1,
        unitPrice: 150000,
        amount: 150000,
        issueDate: new Date("2026-07-10"),
        paymentStatus: "PAID",
      },
    }));

  const supplyCategory =
    (await prisma.transactionCategory.findFirst({ where: { type: "CHI", name: "Giáo trình" } })) ??
    (await prisma.transactionCategory.create({
      data: {
        type: "CHI",
        name: "Giáo trình",
        detail: "Chi nhập giáo trình",
      },
    }));

  const stockCashTxn =
    (await prisma.cashTransaction.findFirst({
      where: {
        branchId: branch.id,
        type: "CHI",
        txnDate: new Date("2026-07-01"),
        amount: 1500000,
        description: "Chi nhập giáo trình FF1",
      },
    })) ??
    (await prisma.cashTransaction.create({
      data: {
        branchId: branch.id,
        categoryId: supplyCategory.id,
        type: "CHI",
        txnDate: new Date("2026-07-01"),
        detail: "Nhập kho giáo trình",
        description: "Chi nhập giáo trình FF1",
        amount: 1500000,
        handledById: accountant.id,
      },
    }));

  await prisma.stockCashPosting.upsert({
    where: { stockTransactionId: stockReceipt.id },
    update: {
      cashTransactionId: stockCashTxn.id,
      amount: 1500000,
    },
    create: {
      stockTransactionId: stockReceipt.id,
      cashTransactionId: stockCashTxn.id,
      amount: 1500000,
    },
  });

  const payrollRun =
    (await prisma.payrollRun.findFirst({ where: { branchId: branch.id, periodName: "2026-07" } })) ??
    (await prisma.payrollRun.create({
      data: {
        branchId: branch.id,
        periodName: "2026-07",
        status: "CALCULATED",
        calculatedAt: new Date("2026-07-31"),
      },
    }));

  await prisma.payrollLine.upsert({
    where: {
      payrollRunId_employeeId: {
        payrollRunId: payrollRun.id,
        employeeId: teacher.id,
      },
    },
    update: {
      teachingHours: 24,
      teachingAmount: 4320000,
      totalAmount: 4320000,
    },
    create: {
      payrollRunId: payrollRun.id,
      employeeId: teacher.id,
      teachingHours: 24,
      teachingAmount: 4320000,
      totalAmount: 4320000,
    },
  });

  const asset =
    (await prisma.asset.findFirst({ where: { branchId: branch.id, name: "Máy lạnh phòng A" } })) ??
    (await prisma.asset.create({
      data: {
        branchId: branch.id,
        assetCode: "ASSET-AC-001",
        name: "Máy lạnh phòng A",
        category: "Điện lạnh",
        room: "Room A",
        unitValue: 12000000,
      },
    }));

  const assetReceipt = await prisma.assetTransaction.findFirst({
    where: {
      assetId: asset.id,
      type: "RECEIPT",
      txnDate: new Date("2026-06-01"),
    },
  });
  if (!assetReceipt) {
    await prisma.assetTransaction.create({
      data: {
        assetId: asset.id,
        type: "RECEIPT",
        quantity: 1,
        txnDate: new Date("2026-06-01"),
        notes: "Tài sản demo",
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        branch: { id: branch.id, code: branch.code, name: branch.name },
        createdRefs: {
          organizationId: organization.id,
          teacherId: teacher.id,
          assistantId: assistant.id,
          accountantId: accountant.id,
          courseId: course.id,
          classId: classRoom.id,
          guardianId: guardian.id,
          leadId: lead.id,
          studentId: student.id,
          sessionId: session.id,
          billingPeriodId: billingPeriod.id,
          chargeId: charge.id,
          paymentId: payment.id,
          bookId: book.id,
          bookIssueId: materialCharge.id,
          payrollRunId: payrollRun.id,
          assetId: asset.id,
          scheduleRuleId: scheduleRule.id,
          studentGuardianId: studentGuardian.id,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
