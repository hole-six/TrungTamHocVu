import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BRANCHES = [
  { code: "DASH1", name: "Demo Tong Quan 1 - Cong no cao", students: 12, classes: 3, openLeads: 4, untouchedLeads: 2, lostLeads: 1, unassigned: 2, credits: 3, makeups: 1, unpaidBooks: 3, lowScore: 4, payRate: 0.35 },
  { code: "DASH2", name: "Demo Tong Quan 2 - Data ton cao", students: 18, classes: 4, openLeads: 12, untouchedLeads: 8, lostLeads: 3, unassigned: 1, credits: 1, makeups: 0, unpaidBooks: 1, lowScore: 2, payRate: 0.75 },
  { code: "DASH3", name: "Demo Tong Quan 3 - Bo tro va sach", students: 10, classes: 2, openLeads: 3, untouchedLeads: 1, lostLeads: 1, unassigned: 0, credits: 6, makeups: 4, unpaidBooks: 5, lowScore: 5, payRate: 0.55 },
  { code: "DASH4", name: "Demo Tong Quan 4 - Van hanh on", students: 16, classes: 4, openLeads: 1, untouchedLeads: 0, lostLeads: 0, unassigned: 0, credits: 0, makeups: 0, unpaidBooks: 0, lowScore: 1, payRate: 0.95 },
] as const;

function d(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

async function clearDemoBranches(branchIds: string[]) {
  if (!branchIds.length) return;

  await prisma.paymentAllocation.deleteMany({
    where: {
      OR: [
        { charge: { student: { branchId: { in: branchIds } } } },
        { payment: { student: { branchId: { in: branchIds } } } },
      ],
    },
  });
  await prisma.payment.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.bookIssue.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.invoice.deleteMany({ where: { charge: { student: { branchId: { in: branchIds } } } } });
  await prisma.charge.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.billingPeriod.deleteMany({ where: { branchId: { in: branchIds } } });

  await prisma.sessionCredit.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.makeupRequest.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.studentAttendance.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.journalScore.deleteMany({ where: { entry: { student: { branchId: { in: branchIds } } } } });
  await prisma.journalEntry.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.classSessionJournal.deleteMany({ where: { session: { class: { branchId: { in: branchIds } } } } });
  await prisma.sessionAssignment.deleteMany({ where: { session: { class: { branchId: { in: branchIds } } } } });
  await prisma.classSession.deleteMany({ where: { class: { branchId: { in: branchIds } } } });

  await prisma.studentBookRequirement.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.classBookRequirement.deleteMany({ where: { class: { branchId: { in: branchIds } } } });
  await prisma.scheduleRule.deleteMany({ where: { class: { branchId: { in: branchIds } } } });
  await prisma.enrollment.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.studentGuardian.deleteMany({ where: { student: { branchId: { in: branchIds } } } });
  await prisma.student.deleteMany({ where: { branchId: { in: branchIds } } });

  await prisma.placementTest.deleteMany({ where: { lead: { branchId: { in: branchIds } } } });
  await prisma.leadInteraction.deleteMany({ where: { lead: { branchId: { in: branchIds } } } });
  await prisma.appointment.deleteMany({ where: { lead: { branchId: { in: branchIds } } } });
  await prisma.lead.deleteMany({ where: { branchId: { in: branchIds } } });

  await prisma.stockTransaction.deleteMany({ where: { book: { branchId: { in: branchIds } } } });
  await prisma.book.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.class.deleteMany({ where: { branchId: { in: branchIds } } });
}

async function seedBranch(orgId: string, spec: (typeof BRANCHES)[number], index: number) {
  const branch = await prisma.branch.upsert({
    where: { code: spec.code },
    update: { name: spec.name, organizationId: orgId, isActive: true },
    create: { code: spec.code, name: spec.name, organizationId: orgId, isActive: true, address: `Dia chi demo ${index}`, phone: `09000000${index}` },
  });

  const periods = await Promise.all(
    ["2026-09", "2026-10"].map((periodName, pIndex) =>
      prisma.billingPeriod.create({
        data: {
          branchId: branch.id,
          periodName,
          startDate: d(pIndex === 0 ? "2026-09-01" : "2026-10-01"),
          endDate: d(pIndex === 0 ? "2026-09-30" : "2026-10-31"),
          status: pIndex === 0 ? "POSTED" : "GENERATED",
        },
      }),
    ),
  );

  const book = await prisma.book.create({
    data: {
      branchId: branch.id,
      bookCode: `${spec.code}-BOOK`,
      category: "Demo",
      name: `Sach demo ${spec.code}`,
      purchasePrice: 50000,
      unitPrice: 120000,
      quantityOnHand: 100,
    },
  });

  const classes = [];
  for (let i = 0; i < spec.classes; i++) {
    const cls = await prisma.class.create({
      data: {
        branchId: branch.id,
        classCode: `${spec.code}-CLS-${i + 1}`,
        className: `${spec.code} Lop ${i + 1}`,
        classGroup: `${spec.code}-${i + 1}`,
        startDate: d("2026-09-01"),
        expectedEndDate: d("2026-12-31"),
        sessionsPerWeek: 2,
        totalSessions: 32,
        tuitionPerSession: 170000,
        status: "ACTIVE",
      },
    });
    await prisma.classBookRequirement.create({ data: { classId: cls.id, bookId: book.id, quantity: 1 } });
    classes.push(cls);
  }

  const guardians = [];
  const students = [];
  for (let i = 0; i < spec.students; i++) {
    const guardian = await prisma.guardian.create({ data: { fullName: `PH ${spec.code} ${i + 1}`, phone: `09${index}${String(i + 1).padStart(8, "0")}` } });
    guardians.push(guardian);
    const student = await prisma.student.create({
      data: {
        branchId: branch.id,
        studentCode: `${spec.code}-HS-${String(i + 1).padStart(3, "0")}`,
        fullName: `Hoc vien ${spec.code} ${String(i + 1).padStart(2, "0")}`,
        phone: guardian.phone,
        enrollDate: d("2026-09-05"),
        status: "ACTIVE",
      },
    });
    await prisma.studentGuardian.create({ data: { studentId: student.id, guardianId: guardian.id, relation: "Me", isPrimary: true } });
    students.push(student);
  }

  for (let i = 0; i < students.length; i++) {
    if (i < spec.unassigned) continue;
    const cls = classes[i % classes.length];
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: students[i].id,
        classId: cls.id,
        status: "ACTIVE",
        billingModel: "PERIOD",
        enrollDate: d("2026-09-05"),
        purchasedMainSessionCount: 32,
        tuitionUnitPriceSnapshot: cls.tuitionPerSession,
      },
    });

    const period = periods[i % periods.length];
    const tuitionAmount = 680000;
    const materialsAmount = i < spec.unpaidBooks ? 120000 : 0;
    const charge = await prisma.charge.create({
      data: {
        studentId: students[i].id,
        classId: cls.id,
        billingPeriodId: period.id,
        enrollmentId: enrollment.id,
        sessionCount: 4,
        scheduledSessionCount: 4,
        unitPrice: 170000,
        mainTuitionAmount: tuitionAmount,
        tuitionAmount,
        materialsAmount,
        totalAmount: tuitionAmount + materialsAmount,
        billingModel: "PERIOD",
      },
    });

    const paidAmount = Math.floor((tuitionAmount + materialsAmount) * spec.payRate);
    if (paidAmount > 0) {
      const payment = await prisma.payment.create({
        data: {
          studentId: students[i].id,
          paymentNo: `${spec.code}-PAY-${String(i + 1).padStart(3, "0")}`,
          paidDate: d("2026-09-20"),
          amount: paidAmount,
          method: "TRANSFER",
          status: "CONFIRMED",
          notes: "Dashboard overview demo",
        },
      });
      await prisma.paymentAllocation.create({ data: { paymentId: payment.id, chargeId: charge.id, amount: paidAmount } });
    }

    if (i < spec.unpaidBooks) {
      await prisma.bookIssue.create({
        data: {
          bookId: book.id,
          classId: cls.id,
          studentId: students[i].id,
          chargeId: charge.id,
          quantity: 1,
          unitPrice: 120000,
          amount: 120000,
          paymentStatus: "UNPAID",
          issueDate: d("2026-09-10"),
          notes: "Dashboard overview demo",
        },
      });
    }
  }

  for (let i = 0; i < spec.openLeads; i++) {
    const lead = await prisma.lead.create({
      data: {
        branchId: branch.id,
        leadCode: `${spec.code}-LEAD-OPEN-${String(i + 1).padStart(3, "0")}`,
        fullName: `Data ${spec.code} can xu ly ${i + 1}`,
        phone: `08${index}${String(i + 1).padStart(8, "0")}`,
        status: "CONTACTING",
        source: i % 2 === 0 ? "Facebook" : "Website",
        createdAt: d("2026-09-22"),
      },
    });
    if (i >= spec.untouchedLeads) {
      await prisma.leadInteraction.create({ data: { leadId: lead.id, type: "CALL", content: "Da goi lan 1", occurredAt: d("2026-09-23") } });
    }
  }
  for (let i = 0; i < spec.lostLeads; i++) {
    await prisma.lead.create({
      data: {
        branchId: branch.id,
        leadCode: `${spec.code}-LEAD-LOST-${String(i + 1).padStart(3, "0")}`,
        fullName: `Data ${spec.code} tu choi ${i + 1}`,
        phone: `07${index}${String(i + 1).padStart(8, "0")}`,
        status: "LOST",
        source: "Facebook",
        createdAt: d("2026-09-21"),
      },
    });
  }

  for (let i = 0; i < spec.credits; i++) {
    const student = students[(i + spec.unassigned) % students.length];
    const enrollment = await prisma.enrollment.findFirst({ where: { studentId: student.id, status: "ACTIVE" } });
    if (!enrollment) continue;
    await prisma.sessionCredit.create({
      data: {
        studentId: student.id,
        enrollmentId: enrollment.id,
        status: "AVAILABLE",
        origin: i % 2 === 0 ? "ABSENCE" : "PAID_CATCHUP",
        unitPriceSnapshot: 170000,
        paidAmount: i % 2 === 0 ? 0 : 170000,
        notes: "Dashboard overview demo",
      },
    });
  }

  for (let i = 0; i < spec.makeups; i++) {
    const student = students[(i + spec.unassigned + 2) % students.length];
    const enrollment = await prisma.enrollment.findFirst({ where: { studentId: student.id, status: "ACTIVE" } });
    if (!enrollment) continue;
    await prisma.makeupRequest.create({
      data: {
        studentId: student.id,
        enrollmentId: enrollment.id,
        requestedDate: d("2026-09-29"),
        status: i % 2 === 0 ? "PENDING" : "SCHEDULED",
        reason: "Can xep bo tro demo",
      },
    });
  }

  const session = await prisma.classSession.create({
    data: { classId: classes[0].id, sessionDate: d("2026-09-24"), startTime: "17:30", endTime: "19:00", status: "COMPLETED" },
  });
  const journal = await prisma.classSessionJournal.create({ data: { sessionId: session.id, unitLesson: "Demo", teacherNote: "Dashboard overview demo" } });
  for (let i = 0; i < Math.min(students.length, 8); i++) {
    const entry = await prisma.journalEntry.create({ data: { journalId: journal.id, studentId: students[i].id, comment: "Demo score" } });
    await prisma.journalScore.create({
      data: { entryId: entry.id, label: "Diem TB", score: i < spec.lowScore ? 5.5 : 8.2, maxScore: 10 },
    });
  }

  console.log(`${spec.code}: ${spec.students} hoc vien, ${spec.classes} lop, ${spec.openLeads} data mo, ${spec.credits + spec.makeups} bo tro/ycbt, ${spec.unpaidBooks} sach chua thu.`);
}

async function main() {
  const organization =
    (await prisma.organization.findFirst({ where: { name: "Dashboard Overview Demo" } })) ??
    (await prisma.organization.create({ data: { name: "Dashboard Overview Demo", address: "Demo", phone: "0900000000" } }));

  const existing = await prisma.branch.findMany({ where: { code: { in: BRANCHES.map((branch) => branch.code) } }, select: { id: true } });
  await clearDemoBranches(existing.map((branch) => branch.id));

  for (let i = 0; i < BRANCHES.length; i++) {
    await seedBranch(organization.id, BRANCHES[i], i + 1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
