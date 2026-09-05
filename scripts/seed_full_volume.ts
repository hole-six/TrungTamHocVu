// Seed dữ liệu ĐẦY ĐỦ trên nền đã có (branch/roles/employees/courses/categories từ
// seed_demo_erp.ts) — mục tiêu là đủ khối lượng thật để vận hành thử toàn bộ luồng
// nghiệp vụ (CRM → ghi danh → dạy học → điểm danh → học phí → thu tiền → lương),
// không phải chỉ 1 dòng minh họa mỗi bảng như seed_demo_erp.ts.
//
// Nguyên tắc: phần có công thức nghiệp vụ (giờ công, đơn giá học phí, học phí kỳ)
// dùng THẲNG hàm gốc trong lib/server/* — không viết lại công thức riêng ở đây để
// tránh lệch logic với app thật. Phần công nợ/thu tiền/lương gọi THẲNG API thật
// (fetch tới dev server) vì logic FIFO phân bổ + tổng hợp lương nằm trong route
// handler, gọi lại API đảm bảo đúng 100% thay vì viết lại.

import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { generateSessionDates, estimateEndDate } from "../lib/server/class-rules";
import { computeSessionBaseHours } from "../lib/server/payroll-rules";
import { computeEffectiveUnitPrice } from "../lib/server/tuition-rules";

const BASE_URL = process.env.SEED_BASE_URL || "http://localhost:3003";
const TODAY = new Date("2026-07-30T00:00:00.000Z");

function daysAgo(n: number): Date {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FAMILY_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ"];
const MIDDLE_NAMES_M = ["Văn", "Hữu", "Đức", "Minh", "Quốc", "Thành"];
const MIDDLE_NAMES_F = ["Thị", "Ngọc", "Thu", "Bảo", "Khánh", "Gia"];
const GIVEN_NAMES_M = ["An", "Bình", "Cường", "Dũng", "Đạt", "Hùng", "Khôi", "Long", "Nam", "Phúc", "Quân", "Sơn"];
const GIVEN_NAMES_F = ["Anh", "Chi", "Hà", "Linh", "Mai", "Nhi", "Phương", "Quỳnh", "Thảo", "Trang", "Vy", "Yến"];

function randomPersonName(gender: "MALE" | "FEMALE") {
  const family = pick(FAMILY_NAMES);
  const middle = gender === "MALE" ? pick(MIDDLE_NAMES_M) : pick(MIDDLE_NAMES_F);
  const given = gender === "MALE" ? pick(GIVEN_NAMES_M) : pick(GIVEN_NAMES_F);
  return `${family} ${middle} ${given}`;
}

async function apiLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("No set-cookie header on login response");
  // Giữ toàn bộ cookie (access + refresh) trả về trong nhiều dòng Set-Cookie.
  return cookie
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn(`  ⚠ ${method} ${path} -> ${res.status}: ${data.error ?? JSON.stringify(data)}`);
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log("🌱 Seed full volume — bắt đầu...");

  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: "CS1" } });
  const courses = await prisma.course.findMany({ where: { branchId: branch.id } });
  const courseByCode = Object.fromEntries(courses.map((c) => [c.code, c]));

  // ---------------------------------------------------------------------
  // 1. Thêm nhân sự giảng dạy cho đa dạng (giữ nguyên nhân sự đã có)
  // ---------------------------------------------------------------------
  const extraTeachers = [
    { code: "EMP-T002", fullName: "Đỗ Khánh Vy", shortName: "K.Vy", rate: 200000 },
    { code: "EMP-T003", fullName: "Phan Quốc Huy", shortName: "Q.Huy", rate: 190000 },
  ];
  const extraAssistants = [
    { code: "EMP-A002", fullName: "Võ Thị Ngọc Mai", shortName: "N.Mai", rate: 100000 },
  ];

  for (const t of extraTeachers) {
    await prisma.employee.upsert({
      where: { employeeCode: t.code },
      update: {},
      create: {
        branchId: branch.id,
        employeeCode: t.code,
        fullName: t.fullName,
        shortName: t.shortName,
        position: "Giáo viên",
        workStatus: "ACTIVE",
        teachingHourlyRate: t.rate,
        assistantHourlyRate: Math.round(t.rate * 0.6),
        payMode: "HOURLY",
      },
    });
  }
  for (const a of extraAssistants) {
    await prisma.employee.upsert({
      where: { employeeCode: a.code },
      update: {},
      create: {
        branchId: branch.id,
        employeeCode: a.code,
        fullName: a.fullName,
        shortName: a.shortName,
        position: "Trợ giảng",
        workStatus: "ACTIVE",
        teachingHourlyRate: null,
        assistantHourlyRate: a.rate,
        payMode: "HOURLY",
      },
    });
  }

  const teachers = await prisma.employee.findMany({ where: { position: "Giáo viên", branchId: branch.id } });
  const assistants = await prisma.employee.findMany({ where: { position: "Trợ giảng", branchId: branch.id } });
  console.log(`✅ Nhân sự dạy học: ${teachers.length} GV, ${assistants.length} TG`);

  // ---------------------------------------------------------------------
  // 2. Lớp học + lịch học (dùng course thật đã import từ workbook)
  // ---------------------------------------------------------------------
  const classPlans = [
    { code: "FF-A2-2026", group: "A2", courseCode: "FF", weekday: 2, start: "17:30", end: "19:00", room: "P.101" },
    { code: "FF-B1-2026", group: "B1", courseCode: "FF", weekday: 4, start: "17:30", end: "19:00", room: "P.101" },
    { code: "UP-A1-2026", group: "A1", courseCode: "UP", weekday: 3, start: "18:00", end: "19:30", room: "P.102" },
    { code: "IE-B1-2026", group: "B1", courseCode: "IE", weekday: 6, start: "08:00", end: "10:00", room: "P.201" },
    { code: "MOV-A1-2026", group: "A1", courseCode: "MOV", weekday: 2, start: "19:15", end: "20:45", room: "P.102" },
  ];

  type SeededClass = { id: string; classCode: string; tuitionPerSession: number };
  const seededClasses: SeededClass[] = [];

  for (const plan of classPlans) {
    const course = courseByCode[plan.courseCode];
    const cls = await prisma.class.upsert({
      where: { classCode: plan.code },
      update: {},
      create: {
        branchId: branch.id,
        courseId: course?.id ?? null,
        classCode: plan.code,
        classGroup: plan.group,
        className: `${course?.name ?? plan.courseCode} ${plan.group}`,
        totalSessions: 48,
        startDate: daysAgo(70),
        sessionsPerWeek: course?.sessionsPerWeek ?? 2,
        tuitionPerSession: course?.tuitionPerSession ?? 170000,
        status: "ACTIVE",
      },
    });
    await prisma.class.update({
      where: { id: cls.id },
      data: { expectedEndDate: estimateEndDate(cls.startDate, cls.totalSessions, cls.sessionsPerWeek) },
    });

    const existingRule = await prisma.scheduleRule.findFirst({ where: { classId: cls.id } });
    if (!existingRule) {
      await prisma.scheduleRule.create({
        data: { classId: cls.id, weekday: plan.weekday, startTime: plan.start, endTime: plan.end, room: plan.room },
      });
    }

    seededClasses.push({ id: cls.id, classCode: cls.classCode, tuitionPerSession: cls.tuitionPerSession ?? 170000 });
  }
  console.log(`✅ Lớp học: ${seededClasses.length} lớp mới/đã có`);

  // ---------------------------------------------------------------------
  // 3. Sinh buổi học (10 tuần trước -> 2 tuần sau) + phân công GV/TG
  // ---------------------------------------------------------------------
  const fromDate = daysAgo(70);
  const toDate = daysAgo(-14); // 14 ngày TỚI

  for (const cls of seededClasses) {
    const rules = await prisma.scheduleRule.findMany({ where: { classId: cls.id } });
    const candidates = generateSessionDates(rules, fromDate, toDate);
    const existing = await prisma.classSession.findMany({ where: { classId: cls.id }, select: { sessionDate: true } });
    const existingDates = new Set(existing.map((s) => s.sessionDate.toISOString().slice(0, 10)));
    const toCreate = candidates.filter((c) => !existingDates.has(c.sessionDate.toISOString().slice(0, 10)));

    const teacher = pick(teachers);
    const assistant = Math.random() > 0.3 ? pick(assistants) : null;

    for (const c of toCreate) {
      const isPast = c.sessionDate.getTime() < TODAY.getTime();
      const session = await prisma.classSession.create({
        data: {
          classId: cls.id,
          sessionDate: c.sessionDate,
          startTime: c.startTime,
          endTime: c.endTime,
          room: c.room,
          status: isPast ? "COMPLETED" : "PLANNED",
          completedAt: isPast ? c.sessionDate : null,
        },
      });

      const teacherHours = computeSessionBaseHours(teacher.payMode, session.startTime, session.endTime);
      await prisma.sessionAssignment.create({
        data: {
          sessionId: session.id,
          employeeId: teacher.id,
          role: "TEACHER",
          hours: teacherHours,
          hourlyRate: teacher.teachingHourlyRate ?? 0,
          amount: Math.round(teacherHours * (teacher.teachingHourlyRate ?? 0)),
        },
      });

      if (assistant) {
        const assistantHours = computeSessionBaseHours(assistant.payMode, session.startTime, session.endTime);
        await prisma.sessionAssignment.create({
          data: {
            sessionId: session.id,
            employeeId: assistant.id,
            role: "ASSISTANT",
            hours: assistantHours,
            hourlyRate: assistant.assistantHourlyRate ?? 0,
            amount: Math.round(assistantHours * (assistant.assistantHourlyRate ?? 0)),
          },
        });
      }
    }
  }
  const sessionCount = await prisma.classSession.count();
  console.log(`✅ Buổi học: tổng ${sessionCount} buổi (đã gồm buổi cũ)`);

  // ---------------------------------------------------------------------
  // 4. Guardians + Leads trải đủ pipeline
  // ---------------------------------------------------------------------
  // 4 trạng thái theo LEAD_STATUSES (lib/server/lead-rules.ts). "Đã hẹn test"/"đã test"
  // không còn là trạng thái riêng — nằm trong CONTACTING, phân biệt bằng việc có
  // PlacementTest hay chưa.
  const PIPELINE: { status: string; count: number }[] = [
    { status: "CONTACTING", count: 8 },
    { status: "QUALIFIED", count: 4 },
    { status: "LOST", count: 4 },
  ];
  const STUDENTS_TO_ENROLL = 14;

  let leadSeq = 100;
  const createdLeads: { id: string; status: string }[] = [];

  async function createLeadWithGuardian(status: string, meetDaysAgo: number) {
    leadSeq += 1;
    const gender = Math.random() > 0.5 ? "MALE" : "FEMALE";
    const childName = randomPersonName(gender);
    const guardianGender = Math.random() > 0.5 ? "MALE" : "FEMALE";
    const guardian = await prisma.guardian.create({
      data: {
        fullName: randomPersonName(guardianGender),
        phone: `09${randInt(10000000, 99999999)}`,
        address: "TP.HCM",
      },
    });
    const meetDate = daysAgo(meetDaysAgo);
    const lead = await prisma.lead.create({
      data: {
        branchId: branch.id,
        leadCode: `LEAD-${String(leadSeq).padStart(4, "0")}`,
        fullName: childName,
        gender,
        dob: new Date(TODAY.getUTCFullYear() - randInt(6, 15), randInt(0, 11), randInt(1, 28)),
        guardianId: guardian.id,
        phone: guardian.phone,
        meetDate,
        status,
        source: pick(["Facebook", "Giới thiệu", "Walk-in", "Zalo"]),
        expectedStartDate: status === "QUALIFIED" ? daysAgo(meetDaysAgo - 7) : null,
      },
    });
    await prisma.leadInteraction.create({
      data: {
        leadId: lead.id,
        employeeId: pick([...teachers, ...assistants, ...(await prisma.employee.findMany({ where: { position: "Tư vấn tuyển sinh" } }))]).id,
        type: pick(["CALL", "MEET", "MESSAGE"]),
        content: "Tư vấn khóa học phù hợp với độ tuổi.",
        occurredAt: meetDate,
      },
    });
    // Lead đã có kết luận (Đạt / Không có nhu cầu) thì phải có lịch hẹn + buổi test đã
    // diễn ra; lead đang CONTACTING thì chỉ một phần đã hẹn test, phần còn lại mới liên hệ.
    const hasVerdict = status === "QUALIFIED" || status === "LOST";
    if (hasVerdict || Math.random() < 0.5) {
      await prisma.appointment.create({
        data: { leadId: lead.id, scheduledAt: daysAgo(meetDaysAgo - 2), status: "DONE" },
      });
    }
    if (hasVerdict) {
      await prisma.placementTest.create({
        data: {
          leadId: lead.id,
          testDate: daysAgo(meetDaysAgo - 3),
          status: status === "LOST" ? "FAILED" : "PASSED",
          result: status === "LOST" ? "Chưa đạt" : "Đạt",
        },
      });
    }
    return lead;
  }

  for (const stage of PIPELINE) {
    for (let i = 0; i < stage.count; i++) {
      const lead = await createLeadWithGuardian(stage.status, randInt(10, 90));
      createdLeads.push({ id: lead.id, status: lead.status });
    }
  }
  // Leads sẽ ghi danh — tạo ở trạng thái QUALIFIED để convert qua API thật.
  for (let i = 0; i < STUDENTS_TO_ENROLL; i++) {
    const lead = await createLeadWithGuardian("QUALIFIED", randInt(30, 120));
    createdLeads.push({ id: lead.id, status: "QUALIFIED" });
  }
  console.log(`✅ Leads: ${createdLeads.length} lead trải đủ pipeline`);

  // ---------------------------------------------------------------------
  // 5. Đăng nhập admin để gọi API thật cho các bước có logic nghiệp vụ
  // ---------------------------------------------------------------------
  console.log("🔐 Đăng nhập admin để gọi API thật...");
  const cookie = await apiLogin("admin@demo.vn", "Demo@123");

  const qualifiedLeads = createdLeads.filter((l) => l.status === "QUALIFIED").slice(0, STUDENTS_TO_ENROLL);
  const studentIds: string[] = [];
  for (const lead of qualifiedLeads) {
    const convertRes = await api(cookie, "POST", `/api/leads/${lead.id}/convert`);
    if (!convertRes.ok) continue;
    const student = convertRes.data.item;
    studentIds.push(student.id);

    // Lùi ngày nhập học về quá khứ cho thật hơn (convert route mặc định = hôm nay).
    const enrollDate = daysAgo(randInt(30, 150));
    await prisma.student.update({ where: { id: student.id }, data: { enrollDate } });

    const cls = pick(seededClasses);
    await api(cookie, "POST", `/api/classes/${cls.id}/enrollments`, { studentId: student.id, enrollDate: enrollDate.toISOString() });
  }
  console.log(`✅ Học viên: ${studentIds.length} học viên đã ghi danh (qua API thật)`);

  // Vài học viên đã nghỉ học, để có dữ liệu "Đã nghỉ" đối chiếu.
  const leftCount = Math.min(2, studentIds.length);
  for (let i = 0; i < leftCount; i++) {
    await api(cookie, "PATCH", `/api/students/${studentIds[i]}`, {
      leaveDate: daysAgo(randInt(5, 20)).toISOString(),
      leaveReason: "Chuyển nơi ở",
    });
  }

  // ---------------------------------------------------------------------
  // 6. Điểm danh cho các buổi đã qua (chỉ các lớp có học viên ghi danh)
  // ---------------------------------------------------------------------
  const activeEnrollments = await prisma.enrollment.findMany({ where: { status: "ACTIVE" }, include: { class: true } });
  const enrollmentsByClass = new Map<string, string[]>();
  for (const e of activeEnrollments) {
    const list = enrollmentsByClass.get(e.classId) ?? [];
    list.push(e.studentId);
    enrollmentsByClass.set(e.classId, list);
  }

  const completedSessions = await prisma.classSession.findMany({ where: { status: "COMPLETED" } });
  for (const session of completedSessions) {
    const roster = enrollmentsByClass.get(session.classId) ?? [];
    for (const studentId of roster) {
      const roll = Math.random();
      const status = roll > 0.88 ? "ABSENT" : "PRESENT";
      await prisma.studentAttendance.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId } },
        update: {},
        create: { sessionId: session.id, studentId, status },
      });
    }
  }
  console.log(`✅ Điểm danh: đã điểm danh ${completedSessions.length} buổi đã qua`);

  // ---------------------------------------------------------------------
  // 7. Nhật ký lớp học (đã publish) cho vài buổi gần nhất mỗi lớp có học viên
  // ---------------------------------------------------------------------
  for (const [classId, roster] of enrollmentsByClass) {
    const recentSessions = await prisma.classSession.findMany({
      where: { classId, status: "COMPLETED" },
      orderBy: { sessionDate: "desc" },
      take: 3,
    });
    for (const session of recentSessions) {
      const journal = await prisma.classSessionJournal.upsert({
        where: { sessionId: session.id },
        update: {},
        create: {
          sessionId: session.id,
          unitLesson: `Unit ${randInt(1, 12)} - Lesson ${randInt(1, 3)}`,
          homeworkNote: "Làm bài tập trang tiếp theo, học thuộc từ vựng.",
          publishedAt: session.sessionDate,
        },
      });
      for (const studentId of roster) {
        const entry = await prisma.journalEntry.upsert({
          where: { journalId_studentId: { journalId: journal.id, studentId } },
          update: {},
          create: {
            journalId: journal.id,
            studentId,
            homeworkStatus: pick(["Đủ", "Chưa nộp", "Không có BTVN"]),
            comment: pick(["Học tốt, tích cực phát biểu.", "Cần cố gắng thêm phần nói.", "Tiến bộ rõ rệt so với tuần trước."]),
          },
        });
        await prisma.journalScore.createMany({
          data: [
            { entryId: entry.id, label: "Vấn đáp", score: randInt(6, 10), maxScore: 10 },
            { entryId: entry.id, label: "Minitest từ", score: randInt(5, 10), maxScore: 10 },
          ],
        });
      }
    }
  }
  console.log("✅ Nhật ký lớp học: đã tạo cho các buổi gần nhất");

  // ---------------------------------------------------------------------
  // 8. Học phí: tạo kỳ thu 3 tháng gần nhất + sinh học phí + thu tiền qua API thật
  // ---------------------------------------------------------------------
  const periods = ["2026-05", "2026-06", "2026-07"];
  for (const periodName of periods) {
    const [y, m] = periodName.split("-").map(Number);
    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    const existing = await prisma.billingPeriod.findUnique({ where: { branchId_periodName: { branchId: branch.id, periodName } } });
    const period =
      existing ??
      (await prisma.billingPeriod.create({ data: { branchId: branch.id, periodName, startDate, endDate } }));

    const genRes = await api(cookie, "POST", `/api/billing-periods/${period.id}/generate-charges`);
    console.log(`  → Sinh học phí kỳ ${periodName}: ${genRes.ok ? `${genRes.data.created ?? 0} tạo mới, ${genRes.data.updated ?? 0} cập nhật` : "lỗi"}`);
  }

  // Thu tiền: ~70% học viên đóng đủ, ~20% đóng một phần, ~10% chưa đóng.
  for (const studentId of studentIds) {
    const outstanding = await prisma.charge.aggregate({ where: { studentId }, _sum: { totalAmount: true } });
    const allocated = await prisma.paymentAllocation.aggregate({ where: { charge: { studentId } }, _sum: { amount: true } });
    const debt = (outstanding._sum.totalAmount ?? 0) - (allocated._sum.amount ?? 0);
    if (debt <= 0) continue;

    const roll = Math.random();
    const payAmount = roll > 0.3 ? debt : roll > 0.1 ? Math.round(debt * 0.5) : 0;
    if (payAmount <= 0) continue;

    await api(cookie, "POST", "/api/payments", {
      studentId,
      amount: payAmount,
      method: pick(["Tiền mặt", "Chuyển khoản"]),
      paidDate: daysAgo(randInt(1, 25)).toISOString(),
    });
  }
  console.log("✅ Học phí: đã sinh học phí 3 kỳ + thu tiền theo tỉ lệ thật/một phần/chưa thu");

  // ---------------------------------------------------------------------
  // 9. Thu chi ngoài học phí
  // ---------------------------------------------------------------------
  const categories = await prisma.transactionCategory.findMany();
  for (let i = 0; i < 15; i++) {
    const category = pick(categories);
    await prisma.cashTransaction.create({
      data: {
        branchId: branch.id,
        categoryId: category.id,
        type: category.type,
        txnDate: daysAgo(randInt(1, 80)),
        detail: category.name,
        description: `${category.type === "THU" ? "Thu" : "Chi"} ${category.name.toLowerCase()}`,
        amount: randInt(200000, 5000000),
        status: "CONFIRMED",
      },
    });
  }
  console.log("✅ Thu chi: đã tạo 15 phiếu thu/chi ngoài học phí");

  // ---------------------------------------------------------------------
  // 10. Kho giáo trình: nhập kho thêm + xuất cho vài học viên
  // ---------------------------------------------------------------------
  const books = await prisma.book.findMany({ where: { branchId: branch.id }, take: 10 });
  const stockLocation = await prisma.stockLocation.findFirst({ where: { branchId: branch.id } });
  for (const book of books.slice(0, 5)) {
    await prisma.stockTransaction.create({
      data: {
        bookId: book.id,
        locationId: stockLocation?.id ?? null,
        type: "RECEIPT",
        quantity: randInt(10, 30),
        unitPrice: book.unitPrice,
        totalAmount: book.unitPrice * 20,
        txnDate: daysAgo(randInt(20, 60)),
        status: "POSTED",
      },
    });
  }
  for (const studentId of studentIds.slice(0, 8)) {
    const book = pick(books);
    if (!book) continue;
    await prisma.bookIssue.create({
      data: {
        bookId: book.id,
        studentId,
        quantity: 1,
        unitPrice: book.unitPrice,
        amount: book.unitPrice,
        issueDate: daysAgo(randInt(5, 60)),
      },
    });
  }
  console.log("✅ Kho giáo trình: đã bổ sung nhập/xuất kho");

  // ---------------------------------------------------------------------
  // 11. Tài sản
  // ---------------------------------------------------------------------
  const assetPlans = [
    { name: "Điều hòa Panasonic 1 chiều", category: "Điện lạnh", room: "P.101", value: 8500000 },
    { name: "Máy chiếu Epson", category: "Thiết bị văn phòng", room: "P.102", value: 12000000 },
    { name: "Bàn học sinh", category: "Nội thất", room: "P.201", value: 800000 },
    { name: "Bảng trắng từ tính", category: "Nội thất", room: "P.101", value: 1500000 },
  ];
  for (const a of assetPlans) {
    const existing = await prisma.asset.findFirst({ where: { branchId: branch.id, name: a.name } });
    if (existing) continue;
    const asset = await prisma.asset.create({
      data: { branchId: branch.id, name: a.name, category: a.category, room: a.room, unitValue: a.value, status: "ACTIVE" },
    });
    await prisma.assetTransaction.create({
      data: { assetId: asset.id, type: "RECEIPT", quantity: 1, txnDate: daysAgo(randInt(60, 300)) },
    });
  }
  console.log("✅ Tài sản: đã tạo danh mục tài sản cố định");

  // ---------------------------------------------------------------------
  // 12. Chấm công nhân viên hành chính (không dạy học) qua API thật
  // ---------------------------------------------------------------------
  const officeStaff = await prisma.employee.findMany({
    where: { branchId: branch.id, position: { in: ["Kế toán", "Lễ tân", "Nhân sự", "Giáo vụ", "Tư vấn tuyển sinh", "Ban Giám Đốc", "Quản lý cơ sở"] } },
  });
  for (const staff of officeStaff) {
    for (let i = 1; i <= 15; i++) {
      const workDate = daysAgo(i);
      if (workDate.getUTCDay() === 0) continue; // nghỉ chủ nhật
      await api(cookie, "POST", "/api/timesheet-entries", {
        employeeId: staff.id,
        workDate: workDate.toISOString(),
        checkInAm: "08:00",
        checkOutAm: "12:00",
        checkInPm: "13:30",
        checkOutPm: "17:30",
      });
    }
  }
  console.log(`✅ Chấm công: ${officeStaff.length} nhân viên hành chính x ~13 ngày công (qua API thật)`);

  // ---------------------------------------------------------------------
  // 13. Lương: sinh kỳ lương 2 tháng gần nhất qua API thật (đảm bảo khớp
  //     đúng dữ liệu SessionAssignment/TimesheetEntry vừa tạo ở trên).
  // ---------------------------------------------------------------------
  for (const periodName of ["2026-06", "2026-07"]) {
    const existingRun = await prisma.payrollRun.findUnique({ where: { branchId_periodName: { branchId: branch.id, periodName } } });
    const run = existingRun ?? (await prisma.payrollRun.create({ data: { branchId: branch.id, periodName, status: "DRAFT" } }));
    const genRes = await api(cookie, "POST", `/api/payroll-runs/${run.id}/generate`);
    console.log(`  → Tính lương kỳ ${periodName}: ${genRes.ok ? `${genRes.data.created ?? 0} tạo mới, ${genRes.data.updated ?? 0} cập nhật` : "lỗi"}`);
  }
  console.log("✅ Lương: đã tính lương 2 kỳ gần nhất, khớp với buổi dạy/chấm công thật");

  // ---------------------------------------------------------------------
  // 14. Điểm học lực + điểm trợ giảng
  // ---------------------------------------------------------------------
  for (const studentId of studentIds.slice(0, 6)) {
    await api(cookie, "POST", `/api/students/${studentId}/exam-scores`, {
      schoolYear: "2025-2026",
      midTerm1: randInt(6, 10),
      finalTerm1: randInt(6, 10),
    });
  }
  for (const assistant of assistants) {
    await api(cookie, "POST", `/api/employees/${assistant.id}/score-events`, {
      branchId: branch.id,
      eventDate: daysAgo(randInt(5, 25)).toISOString(),
      type: Math.random() > 0.5 ? "ADD" : "DEDUCT",
      points: randInt(1, 5),
      reason: "Đánh giá thái độ làm việc trong tháng.",
    });
  }
  console.log("✅ Điểm học lực + điểm trợ giảng: đã tạo mẫu");

  console.log("\n🎉 Seed full volume hoàn tất.");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
