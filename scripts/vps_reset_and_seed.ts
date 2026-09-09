// Xóa TOÀN BỘ dữ liệu nghiệp vụ (học viên, CRM/lead, lớp/khóa, học phí, điểm danh,
// ví buổi học...) và seed lại một bộ dữ liệu demo "đầy đủ nhất" phản ánh đúng hệ
// thống Ví buổi học mới — dùng để CSO/sếp có cái nhìn tổng quan trên dữ liệu sạch,
// không còn chắp vá từ nhiều đợt test cũ.
//
// GIỮ NGUYÊN: Organization, Branch, Role/Permission, và mỗi vai trò nhân sự chỉ còn
// đúng 1 tài khoản mẫu (theo đúng mẫu prisma/seed đã có). KHÔNG đụng Book/Stock/Asset/
// TransactionCategory/Holiday (không thuộc phạm vi "học viên/CRM/lớp học" được yêu cầu).
//
// Toàn bộ số liệu học phí/ví ở đây được sinh qua ĐÚNG các hàm nghiệp vụ thật
// (generateChargesForPeriod, generateCourseCharge, topUpWalletFromPayment,
// debitWalletsForCompletedSession...) — không gõ tay số tiền/số buổi — để đảm bảo demo
// đúng công thức đang chạy thật, không phải số liệu giả lập rời rạc.
//
// Chạy: npx tsx scripts/vps_reset_and_seed.ts
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedRolesAndPermissions } from "../prisma/seeds/roles-permissions";
import { createSessionsInRange } from "../lib/server/class-generation";
import { ensureBillingPeriod, generateChargesForPeriod, generateCourseCharge } from "../lib/server/billing-generation";
import {
  debitWalletsForCompletedSession,
  topUpWalletFromPayment,
  transferWalletToNewEnrollment,
  markWalletRefunded,
  getWalletBalance,
} from "../lib/server/enrollment-wallet";

const prisma = new PrismaClient();

// "Hôm nay" của câu chuyện demo — cố định để dữ liệu nhất quán dù script chạy lệch giờ thật.
const TODAY = new Date("2026-09-07T04:00:00.000Z");

function d(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

// ===========================================================================
// PHASE 0 — XÓA TOÀN BỘ DỮ LIỆU NGHIỆP VỤ CŨ (giữ Organization/Branch/Role/Permission)
// ===========================================================================
async function wipeBusinessData() {
  console.log("\n=== PHASE 0: Xóa dữ liệu nghiệp vụ cũ ===");

  // Tài khoản cổng phụ huynh phải xóa TRƯỚC guardians (FK không cascade).
  await prisma.user.deleteMany({ where: { guardianId: { not: null } } });

  await prisma.enrollmentWalletTxn.deleteMany({});
  await prisma.enrollmentWallet.deleteMany({});

  await prisma.paymentAllocation.deleteMany({});
  await prisma.paymentCashPosting.deleteMany({});
  await prisma.refundCashPosting.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.creditBalance.deleteMany({});
  await prisma.payment.deleteMany({});

  await prisma.invoice.deleteMany({});
  await prisma.enrollmentInstallment.deleteMany({});
  await prisma.charge.deleteMany({});
  await prisma.billingPeriod.deleteMany({});

  await prisma.scholarship.deleteMany({});
  await prisma.adjustment.deleteMany({});

  await prisma.sessionCredit.deleteMany({});
  await prisma.makeupRequest.deleteMany({});
  await prisma.studentAttendance.deleteMany({});
  await prisma.journalScore.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.classSessionJournal.deleteMany({});
  await prisma.sessionRequirementCheck.deleteMany({});
  await prisma.sessionAssignment.deleteMany({});
  await prisma.classSession.deleteMany({});

  await prisma.classRoadmapItem.deleteMany({});
  await prisma.classDefaultAssignment.deleteMany({});
  await prisma.scheduleRule.deleteMany({});
  await prisma.classTaskLog.deleteMany({});
  await prisma.classTask.deleteMany({});

  await prisma.bookIssue.deleteMany({});
  await prisma.studentBookRequirement.deleteMany({});
  await prisma.courseBookRequirement.deleteMany({});

  await prisma.schoolExamScore.deleteMany({});

  await prisma.enrollmentStatusHistory.deleteMany({});
  await prisma.enrollment.deleteMany({});
  await prisma.studentGuardian.deleteMany({});
  await prisma.student.deleteMany({});

  await prisma.placementTest.deleteMany({});
  await prisma.leadInteraction.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.guardian.deleteMany({});

  await prisma.class.deleteMany({});
  await prisma.course.deleteMany({});

  await prisma.timesheetEntry.deleteMany({});
  await prisma.timesheetPeriod.deleteMany({});
  await prisma.payrollLine.deleteMany({});
  await prisma.payrollRun.deleteMany({});
  await prisma.assistantScoreEvent.deleteMany({});
  await prisma.assistantMonthlyBonus.deleteMany({});
  await prisma.employmentContract.deleteMany({});
  await prisma.payPolicy.deleteMany({});

  console.log("Đã xóa xong dữ liệu nghiệp vụ cũ.");
}

// ===========================================================================
// PHASE 1 — TỔ CHỨC / CHI NHÁNH / VAI TRÒ / NHÂN SỰ (mỗi vai trò 1 tài khoản mẫu)
// ===========================================================================
type RoleAccount = {
  employeeCode: string;
  fullName: string;
  shortName: string;
  position: string;
  email: string;
  roleCode: string;
  payMode: "HOURLY" | "MONTHLY";
  teachingHourlyRate?: number;
  assistantHourlyRate?: number;
  /** Đơn giá 1 ngày công hành chính — thiếu số này thì chấm công bao nhiêu ngày lương vẫn ra 0đ. */
  staffDailyRate?: number;
};

const ROLE_ACCOUNTS: RoleAccount[] = [
  { employeeCode: "EMP-T001", fullName: "Nguyễn Minh Anh", shortName: "M.Anh", position: "Giáo viên", email: "teacher.demo@tach.vn", roleCode: "TEACHER", payMode: "HOURLY", teachingHourlyRate: 180000, assistantHourlyRate: 120000 },
  { employeeCode: "EMP-A001", fullName: "Trần Gia Hân", shortName: "G.Hân", position: "Trợ giảng", email: "assistant.demo@tach.vn", roleCode: "TEACHING_ASSISTANT", payMode: "HOURLY", teachingHourlyRate: 120000, assistantHourlyRate: 90000 },
  { employeeCode: "EMP-KT01", fullName: "Lê Thu Trang", shortName: "T.Trang", position: "Kế toán", email: "accountant.demo@tach.vn", roleCode: "ACCOUNTANT", payMode: "MONTHLY", staffDailyRate: 450000 },
  { employeeCode: "EMP-QL01", fullName: "Phạm Đức Long", shortName: "Đ.Long", position: "Quản lý cơ sở", email: "manager.demo@tach.vn", roleCode: "BRANCH_MANAGER", payMode: "MONTHLY", staffDailyRate: 600000 },
  { employeeCode: "EMP-LT01", fullName: "Vũ Ngọc Hà", shortName: "N.Hà", position: "Lễ tân", email: "receptionist.demo@tach.vn", roleCode: "RECEPTIONIST", payMode: "MONTHLY", staffDailyRate: 350000 },
  { employeeCode: "EMP-NS01", fullName: "Đặng Thị Hoa", shortName: "T.Hoa", position: "Nhân sự", email: "hr.demo@tach.vn", roleCode: "HR", payMode: "MONTHLY", staffDailyRate: 450000 },
  { employeeCode: "EMP-GV01", fullName: "Bùi Thanh Tùng", shortName: "T.Tùng", position: "Giáo vụ", email: "registrar.demo@tach.vn", roleCode: "REGISTRAR", payMode: "MONTHLY", staffDailyRate: 420000 },
  { employeeCode: "EMP-TS01", fullName: "Hoàng Mai Linh", shortName: "M.Linh", position: "Tư vấn tuyển sinh", email: "admissions.demo@tach.vn", roleCode: "ADMISSIONS", payMode: "MONTHLY", staffDailyRate: 420000 },
  { employeeCode: "EMP-BGD01", fullName: "Ngô Quốc Việt", shortName: "Q.Việt", position: "Ban Giám Đốc", email: "board.demo@tach.vn", roleCode: "BOARD", payMode: "MONTHLY", staffDailyRate: 800000 },
];
const DIRECTOR_EMAIL = "admin@demo.vn";

async function seedOrgAndRoster() {
  console.log("\n=== PHASE 1: Tổ chức / chi nhánh / vai trò / nhân sự ===");
  await seedRolesAndPermissions();

  const organization =
    (await prisma.organization.findFirst({ where: { name: "Trung Tâm Học Vụ Demo" } })) ??
    (await prisma.organization.create({ data: { name: "Trung Tâm Học Vụ Demo", address: "123 Nguyễn Huệ, Quận 1, TP.HCM", phone: "0909000001" } }));

  const branch =
    (await prisma.branch.findUnique({ where: { code: "CS1" } })) ??
    (await prisma.branch.create({
      data: { organizationId: organization.id, code: "CS1", name: "Cơ sở 1", address: "123 Nguyễn Huệ, Quận 1, TP.HCM", phone: "0909000001", isActive: true },
    }));

  const passwordHash = await hash("Demo@123", 10);
  const canonicalEmployeeCodes = ROLE_ACCOUNTS.map((a) => a.employeeCode);
  const canonicalEmails = [DIRECTOR_EMAIL, ...ROLE_ACCOUNTS.map((a) => a.email)];

  // Trim: chỉ giữ đúng 1 tài khoản mẫu / nhân viên mỗi vai trò — xóa mọi cái khác
  // (dữ liệu test cũ chồng chéo qua nhiều đợt) trước khi upsert lại bộ chuẩn.
  await prisma.user.deleteMany({ where: { AND: [{ employeeId: null }, { email: { notIn: canonicalEmails } }] } });
  await prisma.user.deleteMany({ where: { employee: { employeeCode: { notIn: canonicalEmployeeCodes } } } });
  await prisma.employee.deleteMany({ where: { employeeCode: { notIn: canonicalEmployeeCodes } } });

  const roleByCode = new Map(
    (await prisma.role.findMany({ where: { code: { in: ["DIRECTOR", ...ROLE_ACCOUNTS.map((a) => a.roleCode)] } } })).map((r) => [r.code, r.id]),
  );

  const directorUser =
    (await prisma.user.findUnique({ where: { email: DIRECTOR_EMAIL } })) ??
    (await prisma.user.create({
      data: { email: DIRECTOR_EMAIL, passwordHash, fullName: "Admin Demo", role: "admin", roleId: roleByCode.get("DIRECTOR"), branchId: branch.id, isActive: true },
    }));

  const employeeByCode = new Map<string, { id: string; fullName: string }>();
  for (const acc of ROLE_ACCOUNTS) {
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
          teachingHourlyRate: acc.teachingHourlyRate,
          assistantHourlyRate: acc.assistantHourlyRate,
          staffDailyRate: acc.staffDailyRate,
        },
      }));
    employeeByCode.set(acc.employeeCode, employee);

    await prisma.user.upsert({
      where: { email: acc.email },
      update: { role: "user", roleId: roleByCode.get(acc.roleCode), branchId: branch.id, employeeId: employee.id, passwordHash, fullName: employee.fullName, isActive: true },
      create: { email: acc.email, passwordHash, fullName: employee.fullName, role: "user", roleId: roleByCode.get(acc.roleCode), branchId: branch.id, employeeId: employee.id, isActive: true },
    });

    await prisma.employmentContract.create({
      data: { employeeId: employee.id, contractNo: `HD-${acc.employeeCode}-2026`, signDate: d("2026-01-01"), expiryDate: d("2026-12-31") },
    });
    if (acc.payMode === "HOURLY") {
      await prisma.payPolicy.create({
        data: { employeeId: employee.id, role: acc.roleCode === "TEACHER" ? "TEACHER" : "ASSISTANT", rateType: "HOURLY", rateAmount: acc.teachingHourlyRate ?? acc.assistantHourlyRate ?? 0, effectiveFrom: d("2026-01-01") },
      });
    }
  }

  console.log(`Đã có ${ROLE_ACCOUNTS.length} nhân viên + 1 admin, mỗi vai trò đúng 1 tài khoản mẫu (mật khẩu chung: Demo@123).`);
  return { organization, branch, directorUser, teacher: employeeByCode.get("EMP-T001")!, assistant: employeeByCode.get("EMP-A001")!, accountant: employeeByCode.get("EMP-KT01")! };
}

// ===========================================================================
// Helpers dùng chung cho phần seed học viên/lớp/học phí/ví
// ===========================================================================
let studentSeq = 1;
let guardianSeq = 1;
let leadSeq = 1;

async function makeGuardian(fullName: string, phone: string) {
  guardianSeq++;
  return prisma.guardian.create({ data: { fullName, phone, address: "TP.HCM" } });
}

async function makeStudent(branchId: string, fullName: string, guardianId: string, gender: "MALE" | "FEMALE", dob: string, enrollDate: Date) {
  const code = `STU-${String(studentSeq++).padStart(4, "0")}`;
  const student = await prisma.student.create({
    data: { branchId, studentCode: code, fullName, gender, dob: d(dob), phone: "090900" + String(1000 + studentSeq), enrollDate, status: "ACTIVE" },
  });
  await prisma.studentGuardian.create({ data: { studentId: student.id, guardianId, relation: "Mẹ", isPrimary: true } });
  return student;
}

async function setDefaultAssignments(classId: string, teacherId: string, assistantId: string) {
  await prisma.classDefaultAssignment.create({ data: { classId, employeeId: teacherId, role: "TEACHER" } });
  await prisma.classDefaultAssignment.create({ data: { classId, employeeId: assistantId, role: "ASSISTANT" } });
}

// Điểm danh + trừ ví cho mọi buổi PLANNED của lớp có sessionDate <= uptoDate. Tự lọc
// theo enrollDate của từng enrollment (bỏ qua buổi trước ngày học viên vào lớp) và
// theo status ACTIVE TẠI THỜI ĐIỂM GỌI — vì vậy phải gọi tuần tự đúng thứ tự thời
// gian, xen giữa các mốc chuyển lớp/rút lớp, để không điểm danh nhầm người đã nghỉ.
async function completeSessionsUpTo(classId: string, uptoDate: Date, absentOn?: Map<string, Set<string>>) {
  const sessions = await prisma.classSession.findMany({
    where: { classId, status: "PLANNED", sessionDate: { lte: uptoDate } },
    orderBy: { sessionDate: "asc" },
  });
  const activeEnrollments = await prisma.enrollment.findMany({
    where: { classId, status: "ACTIVE" },
    select: { id: true, studentId: true, enrollDate: true },
  });

  for (const session of sessions) {
    const dateKey = session.sessionDate.toISOString().slice(0, 10);
    for (const enr of activeEnrollments) {
      if (enr.enrollDate > session.sessionDate) continue;
      const isAbsent = absentOn?.get(dateKey)?.has(enr.studentId) ?? false;
      const status = isAbsent ? "ABSENT" : "PRESENT";
      await prisma.studentAttendance.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: enr.studentId } },
        create: { sessionId: session.id, studentId: enr.studentId, status, purpose: "NORMAL", enrollmentId: enr.id },
        update: { status, purpose: "NORMAL", enrollmentId: enr.id },
      });
      if (status === "PRESENT") {
        await prisma.enrollment.update({ where: { id: enr.id }, data: { usedSessionCount: { increment: 1 } } });
      } else {
        await prisma.sessionCredit.create({
          data: { studentId: enr.studentId, enrollmentId: enr.id, sourceSessionId: session.id, status: "AVAILABLE", origin: "ABSENCE" },
        });
      }
    }
    await prisma.classSession.update({ where: { id: session.id }, data: { status: "COMPLETED", completedAt: session.sessionDate } });
    await debitWalletsForCompletedSession(prisma, session.id);
  }
  return sessions.length;
}

// Thu tiền + phân bổ FIFO theo đúng thứ tự kỳ thu (mirror app/api/payments/route.ts),
// nạp ví PERIOD tự động qua topUpWalletFromPayment — dùng lại đúng công thức thật.
async function payAndAllocate(studentId: string, branchId: string, amount: number, paidDate: Date, receivedById: string, method: "Tiền mặt" | "Chuyển khoản" = "Chuyển khoản") {
  if (amount <= 0) return null;
  const paymentNo = `PM${studentSeq}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const payment = await prisma.payment.create({
    data: { studentId, paymentNo, paidDate, amount, method, receivedById, status: "ALLOCATED" },
  });

  const openCharges = await prisma.charge.findMany({
    where: { studentId },
    include: { allocations: true },
    orderBy: [{ billingPeriod: { startDate: "asc" } }, { createdAt: "asc" }],
  });

  let remaining = amount;
  for (const charge of openCharges) {
    if (remaining <= 0) break;
    const alreadyPaid = charge.allocations.reduce((s, a) => s + a.amount, 0);
    const due = charge.tuitionAmount + charge.materialsAmount - alreadyPaid;
    if (due <= 0) continue;
    const allocAmount = Math.min(due, remaining);
    await prisma.paymentAllocation.create({ data: { paymentId: payment.id, chargeId: charge.id, amount: allocAmount } });
    remaining -= allocAmount;
    if (charge.billingModel === "PERIOD" && charge.enrollmentId) {
      await topUpWalletFromPayment(prisma, { enrollmentId: charge.enrollmentId, paymentId: payment.id, amountVnd: allocAmount, unitPrice: charge.unitPrice });
    }
  }

  const cashTxn = await prisma.cashTransaction.create({
    data: { branchId, type: "THU", txnDate: paidDate, description: `Thu học phí phiếu ${paymentNo}`, detail: `Phiếu thu ${paymentNo}`, amount, handledById: receivedById, status: "CONFIRMED" },
  });
  await prisma.paymentCashPosting.create({ data: { paymentId: payment.id, cashTransactionId: cashTxn.id, amount, postingKind: "RECEIPT" } });

  return payment;
}

async function getChargeFor(studentId: string, classId: string, periodId: string) {
  return prisma.charge.findUnique({ where: { studentId_classId_billingPeriodId: { studentId, classId, billingPeriodId: periodId } } });
}

async function runMonthlyPeriodBilling(branchId: string, periodName: string) {
  const period = await ensureBillingPeriod(branchId, periodName);
  await generateChargesForPeriod(period.id);
  return period;
}

// ===========================================================================
// PHASE 2 — CRM: LEAD Ở NHIỀU GIAI ĐOẠN PIPELINE (không nhất thiết thành học viên)
// ===========================================================================
async function seedCrmPipeline(branchId: string, admissionsId: string, classFF1A1Id: string) {
  console.log("\n=== PHASE 2: CRM — lead ở nhiều giai đoạn ===");

  const guardianNew = await makeGuardian("Nguyễn Thị Bích", "0912000001");
  await prisma.lead.create({
    data: { branchId, leadCode: `LEAD-${String(leadSeq++).padStart(4, "0")}`, fullName: "Nguyễn Gia Bảo", gender: "MALE", dob: d("2017-03-10"), guardianId: guardianNew.id, phone: "0912000001", status: "CONTACTING", source: "Facebook", meetDate: TODAY, notes: "Chưa liên hệ được, để lại sđt qua form web." },
  });

  const guardianContacting = await makeGuardian("Trần Văn Đạt", "0912000002");
  const leadContacting = await prisma.lead.create({
    data: { branchId, leadCode: `LEAD-${String(leadSeq++).padStart(4, "0")}`, fullName: "Trần Bảo An", gender: "FEMALE", dob: d("2016-11-02"), guardianId: guardianContacting.id, phone: "0912000002", status: "CONTACTING", source: "Giới thiệu", meetDate: d("2026-08-20"), interestedClassId: classFF1A1Id },
  });
  await prisma.leadInteraction.create({ data: { leadId: leadContacting.id, employeeId: admissionsId, type: "CALL", content: "Đã gọi tư vấn, phụ huynh hẹn suy nghĩ thêm.", occurredAt: d("2026-08-21") } });

  const guardianAppointed = await makeGuardian("Lê Thị Hồng", "0912000003");
  const leadAppointed = await prisma.lead.create({
    data: { branchId, leadCode: `LEAD-${String(leadSeq++).padStart(4, "0")}`, fullName: "Lê Minh Quân", gender: "MALE", dob: d("2017-01-15"), guardianId: guardianAppointed.id, phone: "0912000003", status: "CONTACTING", source: "Facebook", meetDate: d("2026-08-25"), interestedClassId: classFF1A1Id },
  });
  await prisma.appointment.create({ data: { leadId: leadAppointed.id, employeeId: admissionsId, scheduledAt: d("2026-09-10"), status: "SCHEDULED", notes: "Hẹn test đầu vào." } });

  const guardianTested = await makeGuardian("Phạm Văn Kiên", "0912000004");
  const leadTested = await prisma.lead.create({
    data: { branchId, leadCode: `LEAD-${String(leadSeq++).padStart(4, "0")}`, fullName: "Phạm Thảo Nguyên", gender: "FEMALE", dob: d("2016-06-18"), guardianId: guardianTested.id, phone: "0912000004", status: "QUALIFIED", source: "Website", meetDate: d("2026-08-15"), interestedClassId: classFF1A1Id },
  });
  await prisma.placementTest.create({ data: { leadId: leadTested.id, testDate: d("2026-08-30"), status: "PASSED", suggestedClass: "First Friends 1" } });

  const guardianLost = await makeGuardian("Đỗ Thị Loan", "0912000005");
  const leadLost = await prisma.lead.create({
    data: { branchId, leadCode: `LEAD-${String(leadSeq++).padStart(4, "0")}`, fullName: "Đỗ Anh Khoa", gender: "MALE", dob: d("2016-09-01"), guardianId: guardianLost.id, phone: "0912000005", status: "LOST", source: "Facebook", meetDate: d("2026-07-10") },
  });
  await prisma.leadInteraction.create({ data: { leadId: leadLost.id, employeeId: admissionsId, type: "CALL", content: "Phụ huynh chọn trung tâm khác gần nhà hơn.", occurredAt: d("2026-07-15") } });

  const guardianUnqualified = await makeGuardian("Vương Thị Kim", "0912000006");
  const leadUnqualified = await prisma.lead.create({
    data: { branchId, leadCode: `LEAD-${String(leadSeq++).padStart(4, "0")}`, fullName: "Vương Đức Anh", gender: "MALE", dob: d("2018-02-20"), guardianId: guardianUnqualified.id, phone: "0912000006", status: "LOST", source: "Giới thiệu", meetDate: d("2026-08-05") },
  });
  await prisma.placementTest.create({ data: { leadId: leadUnqualified.id, testDate: d("2026-08-08"), status: "FAILED", suggestedClass: "Chưa đủ tuổi, hẹn năm sau" } });

  console.log("Đã seed 6 lead ở đủ các giai đoạn pipeline: NEW/CONTACTING/APPOINTED/TESTED/LOST/UNQUALIFIED.");
}

// ===========================================================================
// MAIN
// ===========================================================================
async function main() {
  await wipeBusinessData();
  const { branch, directorUser, teacher, assistant, accountant } = await seedOrgAndRoster();

  console.log("\n=== PHASE 3: Khóa học & lớp học ===");
  const courseFF1 = await prisma.course.create({ data: { branchId: branch.id, code: "FF1", name: "First Friends 1", tuitionPerSession: 170000, sessionsPerWeek: 2 } });
  const courseIELTS = await prisma.course.create({ data: { branchId: branch.id, code: "IELTS-FD", name: "IELTS Foundation", tuitionPerSession: 250000, sessionsPerWeek: 3 } });
  const courseTAGT = await prisma.course.create({ data: { branchId: branch.id, code: "TAGT", name: "Tiếng Anh Giao Tiếp Người Lớn", tuitionPerSession: 200000, sessionsPerWeek: 2 } });

  // FF1-A2: lớp tiếp theo của FF1-A1 (khai giảng tháng 10, dùng để demo pipeline
  // "lớp tiếp theo" — chưa cần sinh buổi vì chưa tới ngày khai giảng).
  const classFF1A2 = await prisma.class.create({
    data: { branchId: branch.id, courseId: courseFF1.id, classCode: "FF1-A2", classGroup: "A2", className: "First Friends 1 - Lớp A2", totalSessions: 48, startDate: d("2026-10-06"), sessionsPerWeek: 2, tuitionPerSession: 170000, status: "ACTIVE" },
  });
  await prisma.scheduleRule.create({ data: { classId: classFF1A2.id, weekday: 2, startTime: "17:30", endTime: "19:00", room: "Room A" } });
  await prisma.scheduleRule.create({ data: { classId: classFF1A2.id, weekday: 4, startTime: "17:30", endTime: "19:00", room: "Room A" } });

  const classFF1A1 = await prisma.class.create({
    data: { branchId: branch.id, courseId: courseFF1.id, classCode: "FF1-A1", classGroup: "A1", className: "First Friends 1 - Lớp A1", totalSessions: 48, startDate: d("2026-06-02"), sessionsPerWeek: 2, tuitionPerSession: 170000, status: "ACTIVE", nextClassId: classFF1A2.id },
  });
  await prisma.scheduleRule.create({ data: { classId: classFF1A1.id, weekday: 2, startTime: "17:30", endTime: "19:00", room: "Room A" } });
  await prisma.scheduleRule.create({ data: { classId: classFF1A1.id, weekday: 4, startTime: "17:30", endTime: "19:00", room: "Room A" } });
  await setDefaultAssignments(classFF1A1.id, teacher.id, assistant.id);

  const classTAGT = await prisma.class.create({
    data: { branchId: branch.id, courseId: courseTAGT.id, classCode: "TAGT-C1", classGroup: "C1", className: "Tiếng Anh Giao Tiếp - Lớp C1", totalSessions: null, startDate: d("2026-07-07"), sessionsPerWeek: 2, tuitionPerSession: 200000, status: "ACTIVE" },
  });
  await prisma.scheduleRule.create({ data: { classId: classTAGT.id, weekday: 2, startTime: "20:00", endTime: "21:30", room: "Room B" } });
  await prisma.scheduleRule.create({ data: { classId: classTAGT.id, weekday: 5, startTime: "20:00", endTime: "21:30", room: "Room B" } });
  await setDefaultAssignments(classTAGT.id, teacher.id, assistant.id);

  const classIELTSB1 = await prisma.class.create({
    data: { branchId: branch.id, courseId: courseIELTS.id, classCode: "IELTS-FD-B1", classGroup: "B1", className: "IELTS Foundation - Lớp B1", totalSessions: 40, startDate: d("2026-07-06"), sessionsPerWeek: 3, tuitionPerSession: 250000, status: "ACTIVE" },
  });
  await prisma.scheduleRule.create({ data: { classId: classIELTSB1.id, weekday: 1, startTime: "19:00", endTime: "20:30", room: "Room C" } });
  await prisma.scheduleRule.create({ data: { classId: classIELTSB1.id, weekday: 3, startTime: "19:00", endTime: "20:30", room: "Room C" } });
  await prisma.scheduleRule.create({ data: { classId: classIELTSB1.id, weekday: 5, startTime: "19:00", endTime: "20:30", room: "Room C" } });
  await setDefaultAssignments(classIELTSB1.id, teacher.id, assistant.id);

  const classIELTSB0 = await prisma.class.create({
    data: { branchId: branch.id, courseId: courseIELTS.id, classCode: "IELTS-FD-B0", classGroup: "B0", className: "IELTS Foundation - Lớp B0 (đã kết thúc)", totalSessions: 48, startDate: d("2026-01-05"), expectedEndDate: d("2026-05-29"), sessionsPerWeek: 3, tuitionPerSession: 240000, status: "COMPLETED", nextClassId: classIELTSB1.id },
  });
  await prisma.scheduleRule.create({ data: { classId: classIELTSB0.id, weekday: 1, startTime: "19:00", endTime: "20:30", room: "Room C" } });
  await prisma.scheduleRule.create({ data: { classId: classIELTSB0.id, weekday: 3, startTime: "19:00", endTime: "20:30", room: "Room C" } });
  await prisma.scheduleRule.create({ data: { classId: classIELTSB0.id, weekday: 5, startTime: "19:00", endTime: "20:30", room: "Room C" } });
  await setDefaultAssignments(classIELTSB0.id, teacher.id, assistant.id);

  await seedCrmPipeline(branch.id, /* dùng chính accountant tạm làm admissions demo nếu chưa có */ accountant.id, classFF1A1.id);

  // =========================================================================
  // PHASE 4 — IELTS-FD-B0: lớp đã kết thúc (lịch sử), 1 học viên học hết rồi
  // chuyển tiếp sang B1 (demo carry-over usedSessionCount qua transfer), 1 học
  // viên học xong rồi thôi (không học tiếp).
  // =========================================================================
  console.log("\n=== PHASE 4: IELTS-FD-B0 (lớp lịch sử, đã kết thúc) ===");
  await createSessionsInRange(classIELTSB0.id, d("2026-01-05"), d("2026-05-29"));
  const b0TotalSessions = await prisma.classSession.count({ where: { classId: classIELTSB0.id } });

  const gHuy = await makeGuardian("Trịnh Văn Long", "0913000001");
  const sHuy = await makeStudent(branch.id, "Trịnh Quang Huy", gHuy.id, "MALE", "2010-04-12", d("2026-01-05"));
  const enrHuyB0 = await prisma.enrollment.create({
    data: { studentId: sHuy.id, classId: classIELTSB0.id, courseId: courseIELTS.id, status: "ACTIVE", billingModel: "COURSE", enrollDate: d("2026-01-05"), learningStartDate: d("2026-01-05"), purchasedMainSessionCount: b0TotalSessions, tuitionUnitPriceSnapshot: 240000, packageLabel: `IELTS Foundation ${b0TotalSessions} buổi` },
  });
  await generateCourseCharge(enrHuyB0.id);
  const chargeHuyB0 = await prisma.charge.findFirst({ where: { studentId: sHuy.id, classId: classIELTSB0.id } });
  if (chargeHuyB0) await payAndAllocate(sHuy.id, branch.id, chargeHuyB0.tuitionAmount + chargeHuyB0.materialsAmount, d("2026-01-06"), accountant.id, "Chuyển khoản");

  const gDuc = await makeGuardian("Cao Thị Yến", "0913000002");
  const sDuc = await makeStudent(branch.id, "Cao Minh Đức", gDuc.id, "MALE", "2010-08-22", d("2026-01-05"));
  const enrDucB0 = await prisma.enrollment.create({
    data: { studentId: sDuc.id, classId: classIELTSB0.id, courseId: courseIELTS.id, status: "ACTIVE", billingModel: "COURSE", enrollDate: d("2026-01-05"), learningStartDate: d("2026-01-05"), purchasedMainSessionCount: b0TotalSessions, tuitionUnitPriceSnapshot: 240000, packageLabel: `IELTS Foundation ${b0TotalSessions} buổi` },
  });
  await generateCourseCharge(enrDucB0.id);
  const chargeDucB0 = await prisma.charge.findFirst({ where: { studentId: sDuc.id, classId: classIELTSB0.id } });
  if (chargeDucB0) await payAndAllocate(sDuc.id, branch.id, chargeDucB0.tuitionAmount + chargeDucB0.materialsAmount, d("2026-01-06"), accountant.id, "Tiền mặt");

  // Học hết cả khóa B0 cho cả 2 học viên (điểm danh có mặt toàn bộ).
  await completeSessionsUpTo(classIELTSB0.id, d("2026-05-29"));

  // Đức: học xong, dừng lại — không học tiếp.
  await prisma.enrollment.update({ where: { id: enrDucB0.id }, data: { status: "COMPLETED", endDate: d("2026-05-29"), continuationStatus: "COMPLETED" } });
  await prisma.enrollmentStatusHistory.create({ data: { studentId: sDuc.id, enrollmentId: enrDucB0.id, fromStatus: "ACTIVE", toStatus: "COMPLETED", reason: "Học hết khóa B0, không đăng ký tiếp", changedById: directorUser.id } });

  // Huy: đã học HẾT khóa B0 (63/63, remainingMainSessions=0) — khớp đúng nhánh thật
  // của app/api/classes/[id]/complete/route.ts: enrollment COURSE đã dùng hết KHÔNG
  // vào nhóm transferGroup (chỉ enrollment CÒN remaining>0 mới được nối
  // transferredFromEnrollmentId + mang usedSessionCount qua lớp mới) — enrollment đã
  // hết được đánh dấu COMPLETED, dừng lại, giống hệt Đức. B1 là một lượt ĐĂNG KÝ MỚI
  // hoàn toàn độc lập (gói mới, usedSessionCount bắt đầu lại từ 0), không phải hệ
  // thống tự chuyển tiếp.
  await prisma.enrollment.update({ where: { id: enrHuyB0.id }, data: { status: "COMPLETED", endDate: d("2026-05-29"), continuationStatus: "COMPLETED" } });
  await prisma.enrollmentStatusHistory.create({ data: { studentId: sHuy.id, enrollmentId: enrHuyB0.id, fromStatus: "ACTIVE", toStatus: "COMPLETED", reason: "Học hết khóa B0, đăng ký mới khóa B1 (không phải hệ thống tự chuyển tiếp)", changedById: directorUser.id } });
  const enrHuyB1 = await prisma.enrollment.create({
    data: {
      studentId: sHuy.id, classId: classIELTSB1.id, courseId: courseIELTS.id, status: "ACTIVE", billingModel: "COURSE",
      enrollDate: d("2026-06-01"), learningStartDate: d("2026-06-01"), purchasedMainSessionCount: 40, tuitionUnitPriceSnapshot: 250000,
      packageLabel: "IELTS Foundation 40 buổi (khóa B1, đăng ký mới)",
    },
  });
  await generateCourseCharge(enrHuyB1.id);
  const chargeHuyB1 = await prisma.charge.findFirst({ where: { studentId: sHuy.id, classId: classIELTSB1.id } });
  if (chargeHuyB1) await payAndAllocate(sHuy.id, branch.id, chargeHuyB1.tuitionAmount + chargeHuyB1.materialsAmount, d("2026-06-02"), accountant.id, "Chuyển khoản");

  // =========================================================================
  // PHASE 5 — IELTS-FD-B1 (COURSE): thêm 3 học viên — đủ tiền, còn nợ, sắp/đã hết buổi
  // =========================================================================
  console.log("\n=== PHASE 5: IELTS-FD-B1 (COURSE — mua trọn khóa) ===");
  await createSessionsInRange(classIELTSB1.id, d("2026-07-06"), TODAY);
  const b1SessionsSoFar = await prisma.classSession.count({ where: { classId: classIELTSB1.id, sessionDate: { lte: TODAY } } });

  const gVy = await makeGuardian("Lý Văn Sang", "0913000003");
  const sVy = await makeStudent(branch.id, "Lý Thảo Vy", gVy.id, "FEMALE", "2011-02-09", d("2026-07-06"));
  const enrVy = await prisma.enrollment.create({
    data: { studentId: sVy.id, classId: classIELTSB1.id, courseId: courseIELTS.id, status: "ACTIVE", billingModel: "COURSE", enrollDate: d("2026-07-06"), learningStartDate: d("2026-07-06"), purchasedMainSessionCount: 40, tuitionUnitPriceSnapshot: 250000, packageLabel: "IELTS Foundation 40 buổi" },
  });
  await generateCourseCharge(enrVy.id);
  const chargeVy = await prisma.charge.findFirst({ where: { studentId: sVy.id, classId: classIELTSB1.id } });
  if (chargeVy) await payAndAllocate(sVy.id, branch.id, Math.round((chargeVy.tuitionAmount + chargeVy.materialsAmount) * 0.6), d("2026-07-10"), accountant.id, "Tiền mặt"); // đóng 60% — còn nợ

  const gSon = await makeGuardian("Mai Thị Hạnh", "0913000004");
  const sSon = await makeStudent(branch.id, "Mai Xuân Sơn", gSon.id, "MALE", "2011-05-30", d("2026-07-06"));
  const purchasedSon = Math.max(1, b1SessionsSoFar - 2); // sắp hết buổi (còn ~2)
  const enrSon = await prisma.enrollment.create({
    data: { studentId: sSon.id, classId: classIELTSB1.id, courseId: courseIELTS.id, status: "ACTIVE", billingModel: "COURSE", enrollDate: d("2026-07-06"), learningStartDate: d("2026-07-06"), purchasedMainSessionCount: purchasedSon, tuitionUnitPriceSnapshot: 250000, packageLabel: `IELTS Foundation ${purchasedSon} buổi (gói nhỏ)` },
  });
  await generateCourseCharge(enrSon.id);
  const chargeSon = await prisma.charge.findFirst({ where: { studentId: sSon.id, classId: classIELTSB1.id } });
  if (chargeSon) await payAndAllocate(sSon.id, branch.id, chargeSon.tuitionAmount + chargeSon.materialsAmount, d("2026-07-10"), accountant.id, "Chuyển khoản");

  const gNgoc = await makeGuardian("Đinh Văn Thắng", "0913000005");
  const sNgoc = await makeStudent(branch.id, "Đinh Bảo Ngọc", gNgoc.id, "FEMALE", "2011-09-14", d("2026-07-06"));
  const purchasedNgoc = Math.max(1, b1SessionsSoFar - 6); // đã học vượt — "Đã học đủ, cần xử lý"
  const enrNgoc = await prisma.enrollment.create({
    data: { studentId: sNgoc.id, classId: classIELTSB1.id, courseId: courseIELTS.id, status: "ACTIVE", billingModel: "COURSE", enrollDate: d("2026-07-06"), learningStartDate: d("2026-07-06"), purchasedMainSessionCount: purchasedNgoc, tuitionUnitPriceSnapshot: 250000, packageLabel: `IELTS Foundation ${purchasedNgoc} buổi (gói nhỏ)` },
  });
  await generateCourseCharge(enrNgoc.id);
  const chargeNgoc = await prisma.charge.findFirst({ where: { studentId: sNgoc.id, classId: classIELTSB1.id } });
  if (chargeNgoc) await payAndAllocate(sNgoc.id, branch.id, chargeNgoc.tuitionAmount + chargeNgoc.materialsAmount, d("2026-07-10"), accountant.id, "Chuyển khoản");

  // Điểm danh có mặt toàn bộ cho cả lớp B1 tới hôm nay (áp dụng cho cả Huy đã join từ đầu tháng 6 nhưng lớp B1 chỉ thật sự chạy từ 7/7 — enrollDate của Huy là 2026-06-01, sớm hơn nên không bị lọc nhầm).
  await completeSessionsUpTo(classIELTSB1.id, TODAY);

  // =========================================================================
  // PHASE 6 — FF1-A1 + TAGT-C1 (cả 2 đều PERIOD, CÙNG 1 BillingPeriod theo chi
  // nhánh) — xử lý THEO TỪNG THÁNG, xuyên suốt cả 2 lớp cùng lúc, giống đúng cách
  // scheduler thật chạy 1 lần/tháng cho toàn chi nhánh. KHÔNG được gọi
  // generateChargesForPeriod cho cùng 1 kỳ nhiều lần rải rác ở nhiều chỗ khác nhau
  // trong lúc học viên vẫn đang lần lượt đóng tiền — dễ khiến ví bị tính dựa trên số
  // dư TẠM THỜI (đang âm vì chưa tới lượt đóng) rồi cộng dồn sai. Kịch bản: ví
  // đủ/dư/âm, vào giữa tháng, hủy buổi cả lớp (ví dư tự động), chuyển lớp, rút lớp
  // (hoàn/giữ).
  // =========================================================================
  console.log("\n=== PHASE 6: FF1-A1 + TAGT-C1 (PERIOD) — kịch bản Ví buổi học ===");
  await createSessionsInRange(classFF1A1.id, d("2026-06-02"), new Date(TODAY.getTime() + 45 * 86400000));
  await createSessionsInRange(classTAGT.id, d("2026-07-07"), new Date(TODAY.getTime() + 45 * 86400000));

  type P = { name: string; gender: "MALE" | "FEMALE"; dob: string };
  const rosterFF1: Record<string, P> = {
    lan: { name: "Nguyễn Thị Lan Anh", gender: "FEMALE", dob: "2019-05-01" },
    khang: { name: "Trần Minh Khang", gender: "MALE", dob: "2019-07-14" },
    chau: { name: "Lê Bảo Châu", gender: "FEMALE", dob: "2019-02-20" },
    hung: { name: "Phạm Gia Hưng", gender: "MALE", dob: "2019-11-03" },
    diep: { name: "Vũ Ngọc Diệp", gender: "FEMALE", dob: "2019-09-09" },
    tuan: { name: "Đỗ Anh Tuấn", gender: "MALE", dob: "2019-01-25" },
    trang: { name: "Hoàng Thu Trang", gender: "FEMALE", dob: "2019-04-17" },
    vy: { name: "Ngô Khánh Vy", gender: "FEMALE", dob: "2019-06-06" },
  };
  const rosterTAGT: Record<string, P> = {
    mai: { name: "Bùi Thị Mai", gender: "FEMALE", dob: "2000-03-03" },
    phuc: { name: "Đặng Văn Phúc", gender: "MALE", dob: "1998-12-12" },
  };
  const students: Record<string, { id: string; enrId: string }> = {};

  async function enrollPeriodStudent(key: string, p: P, classId: string, courseId: string, unitPrice: number, packageLabel: string, enrollDate: Date, phone: string) {
    const g = await makeGuardian(`PH ${p.name}`, phone);
    const s = await makeStudent(branch.id, p.name, g.id, p.gender, p.dob, enrollDate);
    const enr = await prisma.enrollment.create({
      data: { studentId: s.id, classId, courseId, status: "ACTIVE", billingModel: "PERIOD", enrollDate, learningStartDate: enrollDate, tuitionUnitPriceSnapshot: unitPrice, packageLabel },
    });
    students[key] = { id: s.id, enrId: enr.id };
    return { student: s, enrollment: enr };
  }

  async function payFF1(key: string, periodId: string, paidDate: Date, ratio = 1, method: "Tiền mặt" | "Chuyển khoản" = "Chuyển khoản") {
    const charge = await getChargeFor(students[key].id, classFF1A1.id, periodId);
    if (!charge) return;
    await payAndAllocate(students[key].id, branch.id, Math.round((charge.tuitionAmount + charge.materialsAmount) * ratio), paidDate, accountant.id, method);
  }
  async function payTAGT(key: string, periodId: string, paidDate: Date, ratio = 1) {
    const charge = await getChargeFor(students[key].id, classTAGT.id, periodId);
    if (!charge) return;
    await payAndAllocate(students[key].id, branch.id, Math.round((charge.tuitionAmount + charge.materialsAmount) * ratio), paidDate, accountant.id, "Chuyển khoản");
  }

  // ---- Ghi danh đầu vào (trước tháng 6) ----
  await enrollPeriodStudent("lan", rosterFF1.lan, classFF1A1.id, courseFF1.id, 170000, "First Friends 1 (đóng theo tháng)", d("2026-06-02"), "0914000001");
  await enrollPeriodStudent("khang", rosterFF1.khang, classFF1A1.id, courseFF1.id, 170000, "First Friends 1 (đóng theo tháng)", d("2026-06-02"), "0914000002");
  await enrollPeriodStudent("hung", rosterFF1.hung, classFF1A1.id, courseFF1.id, 170000, "First Friends 1 (đóng theo tháng)", d("2026-06-02"), "0914000003");
  await enrollPeriodStudent("diep", rosterFF1.diep, classFF1A1.id, courseFF1.id, 170000, "First Friends 1 (đóng theo tháng)", d("2026-06-02"), "0914000004");
  await enrollPeriodStudent("tuan", rosterFF1.tuan, classFF1A1.id, courseFF1.id, 170000, "First Friends 1 (đóng theo tháng)", d("2026-06-02"), "0914000005");
  await enrollPeriodStudent("trang", rosterFF1.trang, classFF1A1.id, courseFF1.id, 170000, "First Friends 1 (đóng theo tháng)", d("2026-06-02"), "0914000006");
  const { enrollment: vyEnr } = await enrollPeriodStudent("vy", rosterFF1.vy, classFF1A1.id, courseFF1.id, 170000, "First Friends 1 (đóng theo tháng)", d("2026-06-02"), "0914000007");
  await prisma.scholarship.create({ data: { studentId: students.vy.id, enrollmentId: vyEnr.id, percentage: 0.2, reason: "Con nhân viên trung tâm", effectiveFrom: d("2026-06-02") } });

  // ============================== THÁNG 6 (chỉ FF1-A1, TAGT chưa khai giảng) ==============================
  const period06 = await runMonthlyPeriodBilling(branch.id, "2026-06");
  for (const key of ["lan", "khang", "hung", "diep", "tuan", "trang", "vy"]) await payFF1(key, period06.id, d("2026-06-03"));
  await completeSessionsUpTo(classFF1A1.id, d("2026-06-30"), new Map([["2026-06-18", new Set([students.khang.id])]]));

  // ============================== THÁNG 7 (FF1-A1 + TAGT-C1 khai giảng) ==============================
  await enrollPeriodStudent("mai", rosterTAGT.mai, classTAGT.id, courseTAGT.id, 200000, "Tiếng Anh Giao Tiếp (đóng theo tháng)", d("2026-07-07"), "0915000001");
  await enrollPeriodStudent("phuc", rosterTAGT.phuc, classTAGT.id, courseTAGT.id, 200000, "Tiếng Anh Giao Tiếp (đóng theo tháng)", d("2026-07-07"), "0915000002");

  const period07 = await runMonthlyPeriodBilling(branch.id, "2026-07");
  // Thu đủ tiền theo lịch DỰ KIẾN (chưa hủy buổi nào) trước — đúng thứ tự nghiệp vụ
  // thật: thu đầu tháng, sự cố xảy ra SAU đó mới biết.
  for (const key of ["lan", "khang", "diep", "tuan", "trang", "vy"]) await payFF1(key, period07.id, d("2026-07-03"));
  await payFF1("hung", period07.id, d("2026-07-03"), 0.5, "Tiền mặt"); // Hưng: chỉ đóng 50% — cố tình thiếu để ví âm dần.
  for (const key of ["mai", "phuc"]) await payTAGT(key, period07.id, d("2026-07-03"));

  // Hủy 1 buổi giữa tháng 7 cho CẢ LỚP FF1-A1 (mưa bão) — buổi này KHÔNG trừ ví ai cả,
  // đúng kịch bản mục 3.3: ví dư tự động mang sang tháng 8, không cần thao tác bù riêng.
  const julySessions = await prisma.classSession.findMany({ where: { classId: classFF1A1.id, status: "PLANNED", sessionDate: { gte: d("2026-07-01"), lte: d("2026-07-31") } }, orderBy: { sessionDate: "asc" } });
  const stormSession = julySessions[2] ?? julySessions[0];
  if (stormSession) await prisma.classSession.update({ where: { id: stormSession.id }, data: { status: "CANCELLED", notes: "Hủy cả lớp vì mưa bão — không tính vào ví buổi học của ai." } });

  await completeSessionsUpTo(classFF1A1.id, d("2026-07-31"));
  await completeSessionsUpTo(classTAGT.id, d("2026-07-31"));

  // ============================== THÁNG 8 (nhiều sự kiện xen giữa tháng) ==============================
  // Trang CHUYỂN LỚP từ FF1-A1 sang TAGT-C1 hiệu lực từ 1/8 — phải làm TRƯỚC khi
  // sinh kỳ thu tháng 8, để cô ấy được loại khỏi charge tháng 8 của FF1-A1 và được
  // tính đúng vào charge tháng 8 (trọn tháng, không prorate) của TAGT-C1.
  await prisma.enrollment.update({ where: { id: students.trang.enrId }, data: { status: "TRANSFERRED", endDate: d("2026-07-31") } });
  await prisma.enrollmentStatusHistory.create({ data: { studentId: students.trang.id, enrollmentId: students.trang.enrId, fromStatus: "ACTIVE", toStatus: "TRANSFERRED", reason: "Chuyển sang lớp Tiếng Anh Giao Tiếp Người Lớn theo nguyện vọng", changedById: directorUser.id } });
  const trangOldEnrId = students.trang.enrId;
  const trangUsedSessions = (await prisma.enrollment.findUniqueOrThrow({ where: { id: trangOldEnrId } })).usedSessionCount;
  const trangEnrTAGT = await prisma.enrollment.create({
    data: { studentId: students.trang.id, classId: classTAGT.id, courseId: courseTAGT.id, status: "ACTIVE", billingModel: "PERIOD", enrollDate: d("2026-08-01"), learningStartDate: d("2026-08-01"), tuitionUnitPriceSnapshot: 200000, packageLabel: "Tiếng Anh Giao Tiếp (đóng theo tháng)", pricingBasis: "CONTINUATION_TRANSFER", transferredFromEnrollmentId: trangOldEnrId, usedSessionCount: trangUsedSessions },
  });
  await transferWalletToNewEnrollment(prisma, { fromEnrollmentId: trangOldEnrId, toEnrollmentId: trangEnrTAGT.id, oldUnitPrice: 170000, newUnitPrice: 200000 });
  students.trang.enrId = trangEnrTAGT.id;

  const period08 = await runMonthlyPeriodBilling(branch.id, "2026-08");
  for (const key of ["lan", "khang", "diep", "tuan", "vy"]) await payFF1(key, period08.id, d("2026-08-03"));
  for (const key of ["mai", "phuc", "trang"]) await payTAGT(key, period08.id, d("2026-08-03"));
  // Hưng: KHÔNG đóng gì thêm tháng 8 (đã âm từ tháng 7, để nguyên hiện trạng cần thu gấp).

  // 1-19/8: học bình thường ở cả 2 lớp (Diệp, Tuấn vẫn active, sẽ rút 20/8 và 25/8).
  await completeSessionsUpTo(classFF1A1.id, d("2026-08-19"));
  await completeSessionsUpTo(classTAGT.id, d("2026-08-19"));

  // 20/8: Vũ Ngọc Diệp RÚT LỚP — ví đang dư dương → chọn "Đã hoàn tiền".
  const diepWalletBefore = await getWalletBalance(prisma, students.diep.enrId);
  await prisma.enrollment.update({ where: { id: students.diep.enrId }, data: { status: "WITHDRAWN", endDate: d("2026-08-20") } });
  await prisma.enrollmentStatusHistory.create({ data: { studentId: students.diep.id, enrollmentId: students.diep.enrId, fromStatus: "ACTIVE", toStatus: "WITHDRAWN", reason: "Phụ huynh xin nghỉ, chuyển nhà", changedById: directorUser.id } });
  if (diepWalletBefore > 0) await markWalletRefunded(prisma, students.diep.enrId, "Đã hoàn tiền mặt lúc rút lớp (demo: chọn Đã hoàn tiền).");

  await completeSessionsUpTo(classFF1A1.id, d("2026-08-24"));

  // 25/8: Đỗ Anh Tuấn RÚT LỚP — ví đang dư dương → chọn "Giữ lại" (KHÔNG đụng ví).
  await prisma.enrollment.update({ where: { id: students.tuan.enrId }, data: { status: "WITHDRAWN", endDate: d("2026-08-25") } });
  await prisma.enrollmentStatusHistory.create({ data: { studentId: students.tuan.id, enrollmentId: students.tuan.enrId, fromStatus: "ACTIVE", toStatus: "WITHDRAWN", reason: "Phụ huynh xin nghỉ, chưa quyết định hoàn tiền", changedById: directorUser.id } });

  // 15/8: Lê Bảo Châu ghi danh GIỮA THÁNG vào FF1-A1 — chỉ đóng đúng phần còn lại
  // của tháng 8 tính từ ngày vào (mục 3.6). Charge tháng 8 (đã sinh ở trên) chưa có
  // cho Châu vì lúc đó cô ấy chưa tồn tại — sinh bổ sung ngay sau khi ghi danh.
  await enrollPeriodStudent("chau", rosterFF1.chau, classFF1A1.id, courseFF1.id, 170000, "First Friends 1 (đóng theo tháng)", d("2026-08-15"), "0914000008");
  await generateChargesForPeriod(period08.id);
  await payFF1("chau", period08.id, d("2026-08-16"), 1, "Tiền mặt");

  await completeSessionsUpTo(classFF1A1.id, d("2026-08-31"));
  await completeSessionsUpTo(classTAGT.id, d("2026-08-31"));

  // ============================== THÁNG 9 (tháng hiện tại, chưa hết tháng) ==============================
  const period09 = await runMonthlyPeriodBilling(branch.id, "2026-09");
  for (const key of ["lan", "chau", "vy"]) await payFF1(key, period09.id, d("2026-09-02"));
  // Khang: cố tình để trống — còn nợ tháng 9 hiện tại.
  for (const key of ["mai", "phuc", "trang"]) await payTAGT(key, period09.id, d("2026-09-02"));

  await completeSessionsUpTo(classFF1A1.id, TODAY);
  await completeSessionsUpTo(classTAGT.id, TODAY);

  console.log("\n=== HOÀN TẤT ===");
  const counts = await Promise.all([
    prisma.student.count(),
    prisma.enrollment.count(),
    prisma.class.count(),
    prisma.course.count(),
    prisma.lead.count(),
    prisma.charge.count(),
    prisma.payment.count(),
    prisma.enrollmentWallet.count(),
    prisma.employee.count(),
    prisma.user.count(),
  ]);
  console.log(
    JSON.stringify(
      {
        ok: true,
        students: counts[0],
        enrollments: counts[1],
        classes: counts[2],
        courses: counts[3],
        leads: counts[4],
        charges: counts[5],
        payments: counts[6],
        wallets: counts[7],
        employees: counts[8],
        users: counts[9],
        loginPassword: "Demo@123",
        directorEmail: DIRECTOR_EMAIL,
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
