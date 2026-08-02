import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { getReportHpSummary, getReportHsSummary, getReportsDashboardData } from "../lib/server/reporting";

const WEEKDAY_LOOKUP = [
  { index: 0, code: "Su", label: "Sunday", shortVi: "CN" },
  { index: 1, code: "M", label: "Monday", shortVi: "T2" },
  { index: 2, code: "T", label: "Tuesday", shortVi: "T3" },
  { index: 3, code: "W", label: "Wednesday", shortVi: "T4" },
  { index: 4, code: "Th", label: "Thursday", shortVi: "T5" },
  { index: 5, code: "F", label: "Friday", shortVi: "T6" },
  { index: 6, code: "S", label: "Saturday", shortVi: "T7" },
] as const;

const DEFAULT_TIME_SLOTS = [
  "9:30 - 11:00",
  "16:00 - 17:30",
  "17:30 - 19:00",
  "19:00 - 20:30",
  "16:30 - 17:45",
  "17:45 - 19:15",
] as const;

function formatDateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function getWeekInfo(dateText: string) {
  const utcDate = new Date(`${dateText}T00:00:00.000Z`);
  const day = utcDate.getUTCDay();
  return WEEKDAY_LOOKUP[day] ?? WEEKDAY_LOOKUP[0];
}

function durationHours(startTime: string | null | undefined, endTime: string | null | undefined) {
  if (!startTime || !endTime) {
    return 0;
  }

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return Math.max(0, (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60);
}

function getWeekNumber(dateText: string) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - firstDay.getTime()) / 86400000) + 1;
  return Math.ceil(dayOfYear / 7);
}

async function main() {
  const [reportHs, reportHp, dashboard, charges, cashTransactions, employees, books, stockTransactions, bookIssues, contracts, payPolicies, students, classes, leads, placementTests, courses, scheduleRules, sessions, sessionAssignments, studentAttendances, timesheetEntries] = await Promise.all([
    getReportHsSummary(null),
    getReportHpSummary(null),
    getReportsDashboardData(null),
    prisma.charge.findMany({
      orderBy: [{ billingPeriod: { periodName: "desc" } }, { student: { fullName: "asc" } }],
      include: {
        student: true,
        class: true,
        billingPeriod: true,
        allocations: true,
      },
    }),
    prisma.cashTransaction.findMany({
      orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
      include: {
        category: true,
      },
    }),
    prisma.employee.findMany({
      orderBy: { employeeCode: "asc" },
      select: { id: true, fullName: true, employeeCode: true, shortName: true, position: true, phone: true, email: true, workStatus: true },
    }),
    prisma.book.findMany({
      orderBy: { bookCode: "asc" },
      select: { id: true, bookCode: true, name: true, unitPrice: true, quantityOnHand: true },
    }),
    prisma.stockTransaction.findMany({
      orderBy: [{ txnDate: "desc" }],
      include: { book: true },
    }),
    prisma.bookIssue.findMany({
      orderBy: [{ issueDate: "desc" }],
      include: { book: true, student: true, class: true },
    }),
    prisma.employmentContract.findMany({
      orderBy: { createdAt: "desc" },
      select: { employeeId: true, contractNo: true, signDate: true, expiryDate: true },
    }),
    prisma.payPolicy.findMany({
      orderBy: { effectiveFrom: "desc" },
      select: { employeeId: true, role: true, rateType: true, rateAmount: true, effectiveFrom: true },
    }),
    prisma.student.findMany({
      orderBy: { studentCode: "asc" },
      include: {
        enrollments: {
          include: { class: true },
          orderBy: { enrollDate: "desc" },
        },
      },
    }),
    prisma.class.findMany({
      orderBy: { classCode: "asc" },
      include: {
        course: true,
        enrollments: true,
      },
    }),
    prisma.lead.findMany({
      orderBy: { leadCode: "asc" },
      include: {
        guardian: true,
        interestedClass: true,
      },
    }),
    prisma.placementTest.findMany({
      orderBy: [{ testDate: "desc" }],
      select: {
        leadId: true,
        testDate: true,
        status: true,
        suggestedClass: true,
      },
    }),
    prisma.course.findMany({
      orderBy: { code: "asc" },
      select: { code: true, name: true, tuitionPerSession: true, sessionsPerWeek: true },
    }),
    prisma.scheduleRule.findMany({
      orderBy: [{ class: { classCode: "asc" } }, { weekday: "asc" }, { startTime: "asc" }],
      include: {
        class: {
          include: {
            course: true,
          },
        },
      },
    }),
    prisma.classSession.findMany({
      orderBy: [{ sessionDate: "asc" }, { class: { classCode: "asc" } }],
      include: {
        class: {
          include: {
            course: true,
          },
        },
      },
    }),
    prisma.sessionAssignment.findMany({
      orderBy: [{ session: { sessionDate: "asc" } }, { role: "asc" }],
      include: {
        employee: true,
        session: {
          include: {
            class: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    }),
    prisma.studentAttendance.findMany({
      orderBy: [{ session: { sessionDate: "asc" } }, { student: { fullName: "asc" } }],
      include: {
        student: true,
        session: {
          include: {
            class: true,
          },
        },
      },
    }),
    prisma.timesheetEntry.findMany({
      orderBy: [{ workDate: "asc" }, { employee: { employeeCode: "asc" } }],
      include: {
        employee: true,
        period: true,
      },
    }),
  ]);

  const employeeNameById = Object.fromEntries(employees.map((employee) => [employee.id, employee.fullName])) as Record<string, string>;
  const latestContractByEmployeeId = new Map<string, { contractNo: string | null; signDate: Date | null; expiryDate: Date | null }>();
  for (const contract of contracts) {
    if (!latestContractByEmployeeId.has(contract.employeeId)) {
      latestContractByEmployeeId.set(contract.employeeId, {
        contractNo: contract.contractNo,
        signDate: contract.signDate,
        expiryDate: contract.expiryDate,
      });
    }
  }
  const latestPayPolicyByEmployeeId = new Map<string, { role: string; rateType: string; rateAmount: number; effectiveFrom: Date }>();
  for (const policy of payPolicies) {
    if (!latestPayPolicyByEmployeeId.has(policy.employeeId)) {
      latestPayPolicyByEmployeeId.set(policy.employeeId, policy);
    }
  }
  const latestPlacementByLeadId = new Map<string, { testDate: Date | null; status: string; suggestedClass: string | null }>();
  for (const test of placementTests) {
    if (!latestPlacementByLeadId.has(test.leadId)) {
      latestPlacementByLeadId.set(test.leadId, test);
    }
  }

  const sessionAssignmentsBySessionId = new Map<string, typeof sessionAssignments>();
  for (const assignment of sessionAssignments) {
    const items = sessionAssignmentsBySessionId.get(assignment.sessionId) ?? [];
    items.push(assignment);
    sessionAssignmentsBySessionId.set(assignment.sessionId, items);
  }

  const attendancesBySessionId = new Map<string, typeof studentAttendances>();
  for (const attendance of studentAttendances) {
    const items = attendancesBySessionId.get(attendance.sessionId) ?? [];
    items.push(attendance);
    attendancesBySessionId.set(attendance.sessionId, items);
  }

  const sessionOrdinalById = new Map<string, number>();
  const sessionCountsByClassId = new Map<string, number>();
  for (const session of sessions) {
    const currentCount = (sessionCountsByClassId.get(session.classId) ?? 0) + 1;
    sessionCountsByClassId.set(session.classId, currentCount);
    sessionOrdinalById.set(session.id, currentCount);
  }

  const timeSlotRows = Array.from(
    new Set([...DEFAULT_TIME_SLOTS, ...scheduleRules.map((rule) => `${rule.startTime} - ${rule.endTime}`)]),
  )
    .filter(Boolean)
    .map((slot, index) => ({
      khungTg: "",
      thoiGian: slot,
    }));

  const mucLucWeekdays = [1, 2, 3, 4, 5, 6, 0].map((weekdayIndex) => {
    const item = WEEKDAY_LOOKUP.find((entry) => entry.index == weekdayIndex) ?? WEEKDAY_LOOKUP[0];
    return {
      maThu: item.code,
      tenThu: item.label,
    };
  });

  const chiTietLopHoc = [
    ...sessions.map((session) => {
      const sessionDate = formatDateOnly(session.sessionDate);
      const weekInfo = getWeekInfo(sessionDate);
      const assignments = sessionAssignmentsBySessionId.get(session.id) ?? [];
      const attendances = attendancesBySessionId.get(session.id) ?? [];
      const teacher = assignments.find((item) => item.role === "TEACHER");
      const assistant = assignments.find((item) => item.role === "ASSISTANT");
      const assistant2 = assignments.find((item) => item.role === "ASSISTANT2");
      const totalHours = durationHours(session.startTime, session.endTime);
      const absentCount = attendances.filter((item) => item.status !== "PRESENT").length;
      const amPm = session.startTime && Number(session.startTime.slice(0, 2)) < 12 ? "AM" : "PM";
      const startTimeNumber = session.startTime ? Number(session.startTime.replace(":", "")) : 0;
      const roomSuffix = session.room ? ` (${session.room})` : "";

      return {
        loaiDong: "CLASS_SESSION",
        ngayThang: sessionDate,
        tenThu: weekInfo.shortVi,
        tenNv: "",
        denS: "",
        veS: "",
        denC: "",
        veC: "",
        column4: "LOP_HOC",
        thoiGian: session.startTime && session.endTime ? `${session.startTime} - ${session.endTime}` : "",
        maLop: session.class.classCode,
        tenLop: session.class.className,
        giaoVien: teacher?.employee.fullName ?? "",
        troGiang: assistant?.employee.fullName ?? "",
        troGiang2: assistant2?.employee.fullName ?? "",
        buoiSo: sessionOrdinalById.get(session.id) ?? 0,
        ttHoc: session.status === "COMPLETED" ? "C" : session.status,
        column42: "",
        themH: Math.max(0, (teacher?.addedHours ?? 0) + (assistant?.addedHours ?? 0)),
        diMuonTg: Math.max(0, (assistant?.deductedHours ?? 0)),
        congGioTg: assistant?.addedHours ?? 0,
        dgTg: assistant?.hourlyRate ?? 0,
        column6: "",
        ghiChu: session.notes ?? "",
        column5: attendances.map((item) => `${item.student.studentCode}:${item.status}`).join(" | "),
        nhacViec1: "",
        nhacViec2: "",
        phatSinh: "",
        ngayHt: session.status === "COMPLETED" ? formatDateOnly(session.completedAt ?? session.sessionDate) : "",
        ketQua: session.status,
        column2: "",
        soGio: totalHours,
        soGioGv: teacher?.hours ?? totalHours,
        luonghGv: teacher?.hourlyRate ?? 0,
        caGio: totalHours,
        tienGv: teacher?.amount ?? 0,
        soGioTg: assistant?.hours ?? 0,
        luonghTg: assistant?.hourlyRate ?? 0,
        tienTg: assistant?.amount ?? 0,
        gioNv: 0,
        congNv: 0,
        tenLop2: session.class.className,
        tenLop3: session.class.course?.name ?? session.class.className,
        amPm,
        column1: startTimeNumber,
        thuBuoiLop: `${weekInfo.shortVi}${startTimeNumber}${amPm}${session.class.classCode}`,
        thang: sessionDate.slice(0, 7),
        timeVaBuoi: `${session.startTime ?? ""} - ${session.endTime ?? ""}${roomSuffix}`.trim(),
        soBuoiHoc: (sessionOrdinalById.get(session.id) ?? 0) - absentCount,
        soBuoiNghi: absentCount,
        tuan: getWeekNumber(sessionDate),
        homNay: sessionDate === "2026-07-30" ? "HOM_NAY" : "",
        column3: "",
      };
    }),
    ...timesheetEntries.map((entry) => {
      const workDate = formatDateOnly(entry.workDate);
      const weekInfo = getWeekInfo(workDate);
      return {
        loaiDong: "TIMESHEET",
        ngayThang: workDate,
        tenThu: weekInfo.shortVi,
        tenNv: entry.employee.fullName,
        denS: entry.checkInAm ?? "",
        veS: entry.checkOutAm ?? "",
        denC: entry.checkInPm ?? "",
        veC: entry.checkOutPm ?? "",
        column4: "CHAM_CONG",
        thoiGian: "",
        maLop: "",
        tenLop: "",
        giaoVien: "",
        troGiang: "",
        troGiang2: "",
        buoiSo: "",
        ttHoc: "",
        column42: "",
        themH: entry.overtimeHours ?? 0,
        diMuonTg: entry.lateMinutes ?? 0,
        congGioTg: 0,
        dgTg: 0,
        column6: "",
        ghiChu: entry.notes ?? "",
        column5: entry.period?.periodName ?? "",
        nhacViec1: "",
        nhacViec2: "",
        phatSinh: "",
        ngayHt: workDate,
        ketQua: "APPROVED",
        column2: "",
        soGio: entry.hours ?? 0,
        soGioGv: 0,
        luonghGv: 0,
        caGio: 0,
        tienGv: 0,
        soGioTg: 0,
        luonghTg: 0,
        tienTg: 0,
        gioNv: entry.hours ?? 0,
        congNv: entry.days ?? 0,
        tenLop2: "",
        tenLop3: "",
        amPm: entry.checkInPm ? "FULL" : entry.checkInAm ? "AM" : "",
        column1: 0,
        thuBuoiLop: `${weekInfo.shortVi}-NV-${entry.employee.employeeCode}`,
        thang: workDate.slice(0, 7),
        timeVaBuoi: "VAN_PHONG",
        soBuoiHoc: 0,
        soBuoiNghi: 0,
        tuan: getWeekNumber(workDate),
        homNay: workDate === "2026-07-30" ? "HOM_NAY" : "",
        column3: "",
      };
    }),
  ];

  const payload = {
    generatedAt: "2026-07-30",
    reportHs,
    reportHp,
    reportCongLuong: {
      periodName: dashboard.payrollBreakdown?.periodName ?? null,
      teachers: dashboard.payrollBreakdown?.teachers ?? [],
      assistants: dashboard.payrollBreakdown?.assistants ?? [],
      payrollByPeriod: dashboard.payrollByPeriod,
    },
    sinhNhatHv: {
      month: "2026-07",
      students: dashboard.birthdayThisMonth.map((student) => ({
        studentCode: student.studentCode,
        fullName: student.fullName,
        dob: student.dob ? new Date(student.dob).toISOString().slice(0, 10) : null,
      })),
    },
    theoDoiHp: charges.map((charge) => {
      const paidAmount = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      const remainingAmount = charge.totalAmount - paidAmount;

      return {
        periodName: charge.billingPeriod.periodName,
        studentCode: charge.student.studentCode,
        studentName: charge.student.fullName,
        classCode: charge.class.classCode,
        className: charge.class.className,
        sessionCount: charge.sessionCount,
        absentCount: charge.absentCount,
        deductedCount: charge.deductedCount,
        unitPrice: charge.unitPrice,
        tuitionAmount: charge.tuitionAmount,
        materialsAmount: charge.materialsAmount,
        openingBalance: charge.openingBalance,
        totalAmount: charge.totalAmount,
        paidAmount,
        remainingAmount,
        paymentStatus:
          paidAmount <= 0 ? "UNPAID" : paidAmount < charge.totalAmount ? "PARTIAL" : paidAmount === charge.totalAmount ? "PAID" : "OVERPAID",
      };
    }),
    thuChi: cashTransactions.map((transaction) => ({
      txnDate: transaction.txnDate.toISOString().slice(0, 10),
      type: transaction.type,
      categoryName: transaction.category?.name ?? "",
      detail: transaction.detail ?? "",
      description: transaction.description ?? "",
      amount: transaction.amount,
      handledBy: transaction.handledById ? employeeNameById[transaction.handledById] ?? transaction.handledById : "",
      status: transaction.status,
    })),
    xuatNhapSach: {
      tonKho: books.map((book) => ({
        bookCode: book.bookCode,
        name: book.name,
        unitPrice: book.unitPrice,
        quantityOnHand: book.quantityOnHand,
        stockValue: book.unitPrice * book.quantityOnHand,
      })),
      nhapKho: stockTransactions
        .filter((transaction) => transaction.type === "RECEIPT")
        .map((transaction) => ({
          txnDate: transaction.txnDate.toISOString().slice(0, 10),
          bookCode: transaction.book.bookCode,
          bookName: transaction.book.name,
          quantity: transaction.quantity,
          unitPrice: transaction.unitPrice,
          totalAmount: transaction.totalAmount,
        })),
      xuatKho: bookIssues.map((issue) => ({
        issueDate: issue.issueDate.toISOString().slice(0, 10),
        bookCode: issue.book.bookCode,
        bookName: issue.book.name,
        studentCode: issue.student.studentCode,
        studentName: issue.student.fullName,
        className: issue.class?.className ?? "",
        quantity: issue.quantity,
        unitPrice: issue.unitPrice,
        amount: issue.amount,
        paymentStatus: issue.paymentStatus,
      })),
    },
    nhanSu: employees.map((employee) => {
      const contract = latestContractByEmployeeId.get(employee.id);
      const payPolicy = latestPayPolicyByEmployeeId.get(employee.id);
      return {
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        shortName: employee.shortName,
        position: employee.position ?? "",
        phone: employee.phone ?? "",
        email: employee.email ?? "",
        workStatus: employee.workStatus,
        contractNo: contract?.contractNo ?? "",
        signDate: contract?.signDate ? contract.signDate.toISOString().slice(0, 10) : "",
        expiryDate: contract?.expiryDate ? contract.expiryDate.toISOString().slice(0, 10) : "",
        payRole: payPolicy?.role ?? "",
        payType: payPolicy?.rateType ?? "",
        payRate: payPolicy?.rateAmount ?? 0,
      };
    }),
    dshv: students.map((student) => {
      const latestEnrollment = student.enrollments[0];
      return {
        studentCode: student.studentCode,
        displayId: student.studentCode,
        fullName: student.fullName,
        classCode: latestEnrollment?.class.classCode ?? "",
        className: latestEnrollment?.class.className ?? "",
        enrollDate: student.enrollDate ? student.enrollDate.toISOString().slice(0, 10) : "",
        leaveDate: student.leaveDate ? student.leaveDate.toISOString().slice(0, 10) : "",
        status: student.status,
        evaluation: student.evaluation ?? "",
        address: student.address ?? "",
      };
    }),
    dslop: classes.map((classRoom) => ({
      classCode: classRoom.classCode,
      className: classRoom.className,
      courseCode: classRoom.course?.code ?? "",
      courseName: classRoom.course?.name ?? "",
      totalSessions: classRoom.totalSessions ?? 0,
      startDate: classRoom.startDate ? classRoom.startDate.toISOString().slice(0, 10) : "",
      expectedEndDate: classRoom.expectedEndDate ? classRoom.expectedEndDate.toISOString().slice(0, 10) : "",
      sessionsPerWeek: classRoom.sessionsPerWeek ?? 0,
      tuitionPerSession: classRoom.tuitionPerSession ?? 0,
      studentCount: classRoom.enrollments.length,
      status: classRoom.status,
    })),
    dstest: leads.map((lead) => {
      const placement = latestPlacementByLeadId.get(lead.id);
      return {
        leadCode: lead.leadCode,
        fullName: lead.fullName,
        dob: lead.dob ? lead.dob.toISOString().slice(0, 10) : "",
        guardianName: lead.guardian?.fullName ?? "",
        phone: lead.phone ?? "",
        meetDate: lead.meetDate ? lead.meetDate.toISOString().slice(0, 10) : "",
        testDate: placement?.testDate ? placement.testDate.toISOString().slice(0, 10) : "",
        testStatus: placement?.status ?? "",
        interestedClass: lead.interestedClass?.className ?? placement?.suggestedClass ?? "",
        expectedStartDate: lead.expectedStartDate ? lead.expectedStartDate.toISOString().slice(0, 10) : "",
        actualEnrollDate: lead.actualEnrollDate ? lead.actualEnrollDate.toISOString().slice(0, 10) : "",
        status: lead.status,
        address: lead.address ?? "",
      };
    }),
    mucLuc: {
      table1: timeSlotRows,
      table2: courses.map((course) => ({
        maLop: course.code,
        tenLop: course.name,
        hocPhiBuoi: course.tuitionPerSession ?? 0,
        buoiHocTuan: course.sessionsPerWeek ?? 0,
      })),
      table3: mucLucWeekdays,
    },
    chiTietLopHoc,
    workbookPath: path.join(process.cwd(), "docs", "File Quan ly tong 2026.xlsx"),
  };

  const outputDir = path.join(os.tmpdir(), "erp-report-patch");
  const payloadPath = path.join(outputDir, "report_patch_payload.json");
  await mkdir(outputDir, { recursive: true });
  await writeFile(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        payloadPath,
        workbookPath: payload.workbookPath,
        payloadSummary: {
          reportHsRows: payload.reportHs.classes.length,
          reportHpRows: payload.reportHp.classes.length,
          payrollTeacherRows: payload.reportCongLuong.teachers.length,
          birthdayRows: payload.sinhNhatHv.students.length,
          theoDoiHpRows: payload.theoDoiHp.length,
          thuChiRows: payload.thuChi.length,
          tonKhoRows: payload.xuatNhapSach.tonKho.length,
          nhapKhoRows: payload.xuatNhapSach.nhapKho.length,
          xuatKhoRows: payload.xuatNhapSach.xuatKho.length,
          nhanSuRows: payload.nhanSu.length,
          dshvRows: payload.dshv.length,
          dslopRows: payload.dslop.length,
          dstestRows: payload.dstest.length,
          mucLucTable1Rows: payload.mucLuc.table1.length,
          mucLucTable2Rows: payload.mucLuc.table2.length,
          mucLucTable3Rows: payload.mucLuc.table3.length,
          chiTietLopHocRows: payload.chiTietLopHoc.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
