import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SEED_TAG = "[seed-demo]";

function log(...args: unknown[]) {
  console.log(...args);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  const x = startOfDay(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// Học viên "sạch" dùng để minh họa demo — loại các mã STRESS-*/LEADC5BADBC1 (dữ liệu
// stress-test/QA, tên không phù hợp để demo cho khách xem).
async function getCleanActiveStudentsPool() {
  const students = await prisma.student.findMany({
    where: {
      status: "ACTIVE",
      studentCode: { not: { contains: "STRESS" } },
      NOT: { studentCode: { contains: "TEST" } },
    },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        include: { class: { include: { course: true } } },
      },
    },
    orderBy: { studentCode: "asc" },
  });
  return students.filter((s) => s.enrollments.some((e) => !e.class.isRemedial));
}

async function seedTeacherRequirements(adminUserId: string) {
  log("\n== Phase A: teacherRequirement + Đã nộp/Chưa nộp ==");
  const classes = await prisma.class.findMany({
    where: { isRemedial: false, status: "ACTIVE" },
    include: {
      roadmapItems: true,
      sessions: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { sessionDate: "asc" },
        include: { assignments: true, requirementCheck: true },
      },
    },
  });

  const REQUIREMENT_TEXTS = [
    (n: number) => `Giao bài tập buổi ${n}, chấm điểm và gửi nhận xét trước buổi học sau.`,
    (n: number) => `Gửi phiếu đánh giá học viên buổi ${n} cho phụ huynh qua Zalo trước 20h cùng ngày.`,
  ];

  let seededCount = 0;
  const TARGET = 8;

  for (const cls of classes) {
    if (seededCount >= TARGET) break;

    const candidates = cls.sessions
      .map((session, index) => ({ session, sessionNumber: index + 1 }))
      .filter(({ session }) => session.status === "COMPLETED" && session.assignments.length > 0 && !session.requirementCheck)
      .slice(0, 2);

    for (const [idx, { session, sessionNumber }] of candidates.entries()) {
      if (seededCount >= TARGET) break;
      const roadmapItem = cls.roadmapItems.find((r) => r.sessionNumber === sessionNumber);
      if (!roadmapItem) continue;

      const requirementText = REQUIREMENT_TEXTS[idx % REQUIREMENT_TEXTS.length](sessionNumber);
      if (!roadmapItem.teacherRequirement) {
        await prisma.classRoadmapItem.update({ where: { id: roadmapItem.id }, data: { teacherRequirement: requirementText } });
      }

      const status = idx % 2 === 0 ? "SUBMITTED" : "NOT_SUBMITTED";
      const employeeId = session.assignments[idx % session.assignments.length].employeeId;

      await prisma.$transaction(async (tx) => {
        let scoreEventId: string | null = null;
        if (status === "NOT_SUBMITTED") {
          const scoreEvent = await tx.assistantScoreEvent.create({
            data: {
              employeeId,
              branchId: cls.branchId,
              eventDate: session.sessionDate,
              type: "DEDUCT",
              points: 1,
              reason: `${SEED_TAG} Chưa hoàn thành yêu cầu buổi ${session.sessionDate.toLocaleDateString("vi-VN")} (${cls.className}): ${requirementText}`,
              createdById: adminUserId,
            },
          });
          scoreEventId = scoreEvent.id;
        }
        await tx.sessionRequirementCheck.create({
          data: {
            sessionId: session.id,
            requirementText,
            employeeId,
            initialStatus: status,
            status,
            scoreDecision: scoreEventId ? "DEDUCTED" : "PENDING",
            scoreEventId,
            checkedById: adminUserId,
          },
        });
      });

      seededCount += 1;
      log(`  + ${cls.className} buổi ${sessionNumber}: ${status} (employee ${employeeId.slice(0, 8)})`);
    }
  }
  log(`Đã seed ${seededCount} SessionRequirementCheck.`);
}

async function seedAbsenceCredits(pool: Awaited<ReturnType<typeof getCleanActiveStudentsPool>>, count: number) {
  log("\n== Phase B1: SessionCredit origin=ABSENCE (buổi vắng thật) ==");
  const created: { studentId: string; creditId: string; fullName: string }[] = [];

  for (const student of pool) {
    if (created.length >= count) break;
    const enrollment = student.enrollments.find((e) => !e.class.isRemedial);
    if (!enrollment) continue;

    const alreadyHasAbsenceCredit = await prisma.sessionCredit.count({ where: { studentId: student.id, origin: "ABSENCE" } });
    if (alreadyHasAbsenceCredit > 0) continue;

    const candidateSessions = await prisma.classSession.findMany({
      where: { classId: enrollment.classId, status: "COMPLETED" },
      orderBy: { sessionDate: "asc" },
      take: 20,
    });

    for (const session of candidateSessions) {
      const [existingAttendance, existingCredit] = await Promise.all([
        prisma.studentAttendance.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } } }),
        prisma.sessionCredit.findUnique({ where: { studentId_sourceSessionId: { studentId: student.id, sourceSessionId: session.id } } }),
      ]);
      if (existingCredit) continue;
      // Phần lớn buổi đã học trong dữ liệu demo đã có điểm danh CÓ MẶT đầy đủ — không
      // đủ buổi "chưa điểm danh" để minh họa. Chuyển 1 buổi đã CÓ MẶT thành VẮNG (dữ
      // liệu minh họa trên VPS demo, không phải học viên thật) để có đủ ví dụ thực tế
      // cho tab "Có buổi bổ trợ". Bỏ qua nếu đã vắng/học bù sẵn.
      if (existingAttendance && existingAttendance.status !== "PRESENT") continue;

      const credit = await prisma.$transaction(async (tx) => {
        await tx.studentAttendance.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
          create: { sessionId: session.id, studentId: student.id, status: "ABSENT" },
          update: { status: "ABSENT" },
        });
        return tx.sessionCredit.create({
          data: {
            studentId: student.id,
            enrollmentId: enrollment.id,
            sourceSessionId: session.id,
            status: "AVAILABLE",
            origin: "ABSENCE",
          },
        });
      });
      created.push({ studentId: student.id, creditId: credit.id, fullName: student.fullName });
      log(`  + ${student.fullName} vắng buổi ${session.sessionDate.toISOString().slice(0, 10)} (${enrollment.class.className}) -> credit ${credit.id.slice(0, 8)}`);
      break;
    }
  }
  log(`Đã seed ${created.length} buổi bổ trợ (vắng thật).`);
  return created;
}

async function seedPaidCatchupCredits(pool: Awaited<ReturnType<typeof getCleanActiveStudentsPool>>, usedStudentIds: Set<string>) {
  log("\n== Phase B2: SessionCredit origin=PAID_CATCHUP (đầu khóa, có/miễn phí) ==");
  const now = new Date();
  const specs = [
    { isFree: false, count: 3 },
    { isFree: true, count: 2 },
  ];

  let specIndex = 0;
  for (const student of pool) {
    if (specIndex >= specs.length) break;
    if (usedStudentIds.has(student.id)) continue;
    const enrollment = student.enrollments.find((e) => !e.class.isRemedial);
    if (!enrollment) continue;

    const already = await prisma.sessionCredit.count({
      where: { studentId: student.id, origin: "PAID_CATCHUP", notes: { startsWith: SEED_TAG } },
    });
    if (already > 0) {
      specIndex += 1;
      continue;
    }

    const spec = specs[specIndex];
    const unitPrice = spec.isFree ? 0 : enrollment.class.tuitionPerSession ?? enrollment.class.course?.tuitionPerSession ?? 150000;
    const totalAmount = spec.isFree ? 0 : unitPrice * spec.count;

    const result = await prisma.$transaction(async (tx) => {
      const items = await Promise.all(
        Array.from({ length: spec.count }, () =>
          tx.sessionCredit.create({
            data: {
              studentId: student.id,
              enrollmentId: enrollment.id,
              sourceSessionId: null,
              status: "AVAILABLE",
              origin: "PAID_CATCHUP",
              unitPriceSnapshot: spec.isFree ? 0 : unitPrice,
              paidAmount: spec.isFree ? 0 : unitPrice,
              notes: `${SEED_TAG} Bổ trợ đầu khóa minh họa`,
            },
          }),
        ),
      );

      let chargeUpdated = false;
      if (totalAmount > 0) {
        let charge = await tx.charge.findFirst({
          where: { studentId: student.id, classId: enrollment.classId, billingModel: "COURSE", OR: [{ enrollmentId: null }, { enrollmentId: enrollment.id }] },
          include: { billingPeriod: true },
        });
        if (!charge) {
          const period = await tx.billingPeriod.findFirst({
            where: { branchId: student.branchId, startDate: { lte: now }, endDate: { gte: now } },
            orderBy: { startDate: "desc" },
          });
          if (period) {
            const periodCharge = await tx.charge.findUnique({
              where: { studentId_classId_billingPeriodId: { studentId: student.id, classId: enrollment.classId, billingPeriodId: period.id } },
            });
            if (periodCharge) charge = { ...periodCharge, billingPeriod: period };
          }
        }
        if (charge && (charge.billingPeriod.status === "DRAFT" || charge.billingPeriod.status === "GENERATED" || charge.billingPeriod.status === "REVIEWED" || charge.billingPeriod.status === "REOPENED")) {
          await tx.charge.update({
            where: { id: charge.id },
            data: {
              paidCatchupAmount: charge.paidCatchupAmount + totalAmount,
              tuitionAmount: charge.tuitionAmount + totalAmount,
              totalAmount: charge.totalAmount + totalAmount,
            },
          });
          chargeUpdated = true;
        }
      }
      return { items, chargeUpdated };
    });

    const chargeNote = spec.isFree ? "miễn phí, không cộng nợ" : result.chargeUpdated ? "đã cộng vào công nợ" : "không tìm thấy phiếu mở để cộng nợ";
    log(
      `  + ${student.fullName}: ${spec.count} buổi ${spec.isFree ? "miễn phí" : `x ${unitPrice.toLocaleString("vi-VN")}đ = ${totalAmount.toLocaleString("vi-VN")}đ`} (${enrollment.class.className}) — ${chargeNote}`,
    );
    usedStudentIds.add(student.id);
    specIndex += 1;
  }
}

async function seedManualPrebook(pool: Awaited<ReturnType<typeof getCleanActiveStudentsPool>>, usedStudentIds: Set<string>, remedialSessionId: string) {
  log("\n== Phase B3: SessionCredit origin=MANUAL (học bù trước) ==");
  const now = new Date();

  for (const student of pool) {
    if (usedStudentIds.has(student.id)) continue;
    const enrollment = student.enrollments.find((e) => !e.class.isRemedial);
    if (!enrollment) continue;

    const futureSession = await prisma.classSession.findFirst({
      where: { classId: enrollment.classId, sessionDate: { gt: now }, status: { in: ["PLANNED", "CONFIRMED"] } },
      orderBy: { sessionDate: "asc" },
    });
    if (!futureSession) continue;

    const [existingFutureAttendance, existingTodayAttendance] = await Promise.all([
      prisma.studentAttendance.findUnique({ where: { sessionId_studentId: { sessionId: futureSession.id, studentId: student.id } } }),
      prisma.studentAttendance.findUnique({ where: { sessionId_studentId: { sessionId: remedialSessionId, studentId: student.id } } }),
    ]);
    if (existingFutureAttendance || existingTodayAttendance) continue;

    await prisma.$transaction(async (tx) => {
      await tx.sessionCredit.create({
        data: {
          studentId: student.id,
          enrollmentId: enrollment.id,
          sourceSessionId: futureSession.id,
          status: "CONSUMED",
          origin: "MANUAL",
          consumedSessionId: remedialSessionId,
          consumedAt: new Date(),
          notes: `${SEED_TAG} Học bù trước buổi ${futureSession.sessionDate.toLocaleDateString("vi-VN")} (${enrollment.class.className})`,
        },
      });
      await tx.studentAttendance.create({ data: { sessionId: futureSession.id, studentId: student.id, status: "ABSENT" } });
      await tx.studentAttendance.upsert({
        where: { sessionId_studentId: { sessionId: remedialSessionId, studentId: student.id } },
        create: { sessionId: remedialSessionId, studentId: student.id, status: "MAKEUP" },
        update: { status: "MAKEUP" },
      });
    });

    log(`  + ${student.fullName} học bù trước buổi ${futureSession.sessionDate.toISOString().slice(0, 10)} (${enrollment.class.className}) tại buổi bổ trợ hôm nay.`);
    usedStudentIds.add(student.id);
    return;
  }
  log("  (không tìm thấy học viên phù hợp có buổi tương lai để demo học bù trước)");
}

async function ensureTodayRemedialSession() {
  log("\n== Phase C: lớp bổ trợ đang diễn ra hôm nay + phân công ==");
  let remedialClass = await prisma.class.findFirst({ where: { isRemedial: true, status: "ACTIVE" }, orderBy: { className: "asc" } });
  if (!remedialClass) {
    const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
    if (!branch) throw new Error("Không tìm thấy cơ sở (Branch) nào để tạo lớp bổ trợ.");
    const classCode = `BOTRO-${Date.now().toString(36).toUpperCase()}`;
    remedialClass = await prisma.class.create({
      data: {
        branchId: branch.id,
        classCode,
        className: "Lớp bổ trợ",
        status: "ACTIVE",
        isRemedial: true,
        notes: `${SEED_TAG} Lớp bổ trợ minh họa — không thu học phí riêng, chứa các buổi bổ trợ`,
      },
    });
    log(`  + Tạo mới lớp bổ trợ: ${remedialClass.className} (${remedialClass.id.slice(0, 8)})`);
  }

  const now = new Date();
  let session = await prisma.classSession.findFirst({
    where: { classId: remedialClass.id, sessionDate: { gte: startOfDay(now), lte: endOfDay(now) } },
  });
  if (!session) {
    session = await prisma.classSession.create({
      data: {
        classId: remedialClass.id,
        sessionDate: startOfDay(now),
        startTime: "18:00",
        endTime: "19:30",
        room: "P.201",
        status: "CONFIRMED",
        notes: `${SEED_TAG} Buổi bổ trợ minh họa hôm nay`,
      },
    });
    log(`  + Tạo buổi bổ trợ hôm nay: ${remedialClass.className} (${session.id.slice(0, 8)})`);
  } else {
    log(`  Buổi bổ trợ hôm nay đã tồn tại: ${remedialClass.className} (${session.id.slice(0, 8)})`);
  }

  const [teacher, assistant] = await Promise.all([
    prisma.employee.findFirst({ where: { position: { contains: "Giáo viên" }, workStatus: "ACTIVE" } }),
    prisma.employee.findFirst({ where: { position: { contains: "Trợ giảng" }, workStatus: "ACTIVE" } }),
  ]);
  for (const [employee, role] of [[teacher, "TEACHER"] as const, [assistant, "ASSISTANT"] as const]) {
    if (!employee) continue;
    const existing = await prisma.sessionAssignment.findFirst({ where: { sessionId: session.id, employeeId: employee.id, role } });
    if (!existing) {
      await prisma.sessionAssignment.create({ data: { sessionId: session.id, employeeId: employee.id, role } });
      log(`  + Phân công ${role === "TEACHER" ? "giáo viên" : "trợ giảng"}: ${employee.fullName}`);
    }
  }

  return session.id;
}

async function redeemAbsenceCreditsIntoRemedial(credits: { creditId: string; studentId: string; fullName: string }[], remedialSessionId: string, redeemCount: number) {
  log("\n== Phase D: thêm tay ngang (redeem) học viên vào buổi bổ trợ hôm nay ==");
  let redeemed = 0;
  for (const credit of credits) {
    if (redeemed >= redeemCount) break;
    const current = await prisma.sessionCredit.findUnique({ where: { id: credit.creditId } });
    if (!current || current.status !== "AVAILABLE") continue;

    await prisma.$transaction(async (tx) => {
      await tx.studentAttendance.upsert({
        where: { sessionId_studentId: { sessionId: remedialSessionId, studentId: credit.studentId } },
        create: { sessionId: remedialSessionId, studentId: credit.studentId, status: "MAKEUP" },
        update: { status: "MAKEUP" },
      });
      await tx.sessionCredit.update({
        where: { id: credit.creditId },
        data: { status: "CONSUMED", consumedSessionId: remedialSessionId, consumedAt: new Date() },
      });
    });
    log(`  + Thêm tay ngang: ${credit.fullName} vào buổi bổ trợ hôm nay (credit ${credit.creditId.slice(0, 8)})`);
    redeemed += 1;
  }
  log(`Đã thêm tay ngang ${redeemed} học viên, còn lại ${credits.length - redeemed} buổi bổ trợ AVAILABLE để demo trực tiếp.`);
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@demo.vn" } });
  if (!admin) throw new Error("Không tìm thấy tài khoản admin@demo.vn để gán checkedById/createdById.");

  await seedTeacherRequirements(admin.id);

  const pool = await getCleanActiveStudentsPool();
  log(`\nTổng học viên "sạch" khả dụng để seed: ${pool.length}`);

  const remedialSessionId = await ensureTodayRemedialSession();

  const absenceCredits = await seedAbsenceCredits(pool, 4);

  const usedStudentIds = new Set(absenceCredits.map((c) => c.studentId));
  await seedPaidCatchupCredits(pool, usedStudentIds);
  await seedManualPrebook(pool, usedStudentIds, remedialSessionId);

  await redeemAbsenceCreditsIntoRemedial(absenceCredits, remedialSessionId, 2);

  log("\nHoàn tất seed dữ liệu minh họa bổ trợ.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
