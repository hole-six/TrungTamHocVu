import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { computeSessionTiming, getVietnamToday } from "@/lib/server/class-rules";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";
import { findLockedPeriodForSession } from "@/lib/server/billing-generation";
import { BILLING_PERIOD_STATUS_LABEL } from "@/lib/server/tuition-rules";

// Điểm danh vẫn cho phép GV/TG (canUpdate("schedule") = false với 2 vai trò này) vì đây
// là việc dạy học hàng ngày, khác với quản lý lịch/ghi danh — xem giải thích tương tự ở
// app/(app)/classes/[id]/sessions/[sessionId]/page.tsx.
async function canMarkAttendance(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return canUpdate("schedule", role) || role === "TEACHER" || role === "TEACHING_ASSISTANT";
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const session = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: { attendances: true },
  });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });

  const activeEnrollments = await prisma.enrollment.findMany({
    where: { classId: session.classId, status: "ACTIVE" },
    include: { student: true },
    orderBy: { student: { fullName: "asc" } },
  });

  const attendanceByStudent = Object.fromEntries(session.attendances.map((a) => [a.studentId, a.status]));

  // Học viên đã "học bù trước" buổi này (xem app/api/sessions/[id]/prebook-makeup) có
  // đúng 1 SessionCredit CONSUMED với sourceSessionId = buổi này — khóa không cho sửa
  // điểm danh nữa vì buổi thật sự đã học rồi (ở buổi bổ trợ khác, sớm hơn).
  const lockedCredits = await prisma.sessionCredit.findMany({
    where: {
      sourceSessionId: session.id,
      status: "CONSUMED",
      studentId: { in: activeEnrollments.map((e) => e.studentId) },
    },
    select: { studentId: true, notes: true },
  });
  const lockedByStudent = new Map(lockedCredits.map((c) => [c.studentId, c.notes]));

  const roster = activeEnrollments.map((e) => ({
    studentId: e.studentId,
    fullName: e.student.fullName,
    studentCode: e.student.studentCode,
    status: attendanceByStudent[e.studentId] ?? "PRESENT",
    locked: lockedByStudent.has(e.studentId),
    lockedNote: lockedByStudent.get(e.studentId) ?? null,
  }));

  return NextResponse.json({ roster, sessionStatus: session.status });
}

const ABSENCE_STATUSES = new Set(["ABSENT"]);

// Lưu điểm danh cho cả lớp trong 1 buổi — đồng thời đánh dấu buổi học là đã hoàn
// thành (việc điểm danh tức là buổi học đã diễn ra), thay cho cột TTHoc (C/K) cấp
// lớp trong ChiTietLopHoc gốc nhưng chuẩn hóa xuống cấp học viên.
//
// Buổi bổ trợ (SessionCredit) theo dõi NỘI DUNG/tiến độ khóa học đã bỏ lỡ, độc lập
// với cách thu tiền — vắng buổi nào cũng sinh 1 buổi bổ trợ (AVAILABLE) cho buổi đó,
// bất kể lớp đang thu trọn khóa (COURSE), theo tháng (PERIOD) hay trả góp
// (INSTALLMENT): nội dung bị bỏ lỡ là như nhau dù thu tiền kiểu gì (COURSE/INSTALLMENT
// vẫn tính tiền buổi vắng đó nên buổi bổ trợ là bù lại nội dung đã trả tiền; PERIOD
// không tính tiền buổi vắng đó nhưng học viên vẫn thiếu đúng nội dung buổi học đó, nên
// vẫn cần buổi bổ trợ để học bù — xem cùng logic ở app/api/enrollments/[id]/route.ts
// lúc rút lớp). KHÔNG áp dụng cho lớp bổ trợ (isRemedial) — bản thân lớp đó đã là nơi
// dùng buổi bổ trợ, vắng ở đây không tự sinh thêm buổi bổ trợ mới.
// Nếu sau đó sửa lại thành có mặt mà buổi dư đó CHƯA dùng (AVAILABLE) thì hủy
// (VOIDED) — nếu đã dùng để học bù (CONSUMED) thì để nguyên, không tự động hủy được.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await canMarkAttendance(user.id))) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền điểm danh" }, { status: 403 });
  }

  const session = await prisma.classSession.findUnique({ where: { id: params.id }, include: { class: true } });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi học" }, { status: 404 });
  if (computeSessionTiming(session.sessionDate, getVietnamToday()) === "upcoming") {
    return NextResponse.json({ error: "Buổi học chưa diễn ra, chưa thể điểm danh." }, { status: 409 });
  }

  const body = await req.json();
  const records: { studentId: string; status: string }[] = body.records ?? [];
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "Thiếu danh sách điểm danh" }, { status: 400 });
  }

  const existingAttendances = await prisma.studentAttendance.findMany({ where: { sessionId: session.id } });
  const oldStatusByStudent = new Map(existingAttendances.map((a) => [a.studentId, a.status]));

  // Chặn sửa điểm danh cho học viên đã "học bù trước" buổi này (xem GET ở trên) —
  // buổi thật sự đã học rồi ở 1 buổi bổ trợ khác, không được đổi khác ABSENT.
  const lockedCredits = await prisma.sessionCredit.findMany({
    where: { sourceSessionId: session.id, status: "CONSUMED", studentId: { in: records.map((r) => r.studentId) } },
    select: { studentId: true },
  });
  const lockedStudentIds = new Set(lockedCredits.map((c) => c.studentId));
  const invalidLockedEdit = records.find((r) => lockedStudentIds.has(r.studentId) && r.status !== "ABSENT");
  if (invalidLockedEdit) {
    return NextResponse.json(
      { error: "Có học viên đã học bù trước buổi này — không thể sửa điểm danh của học viên đó." },
      { status: 409 },
    );
  }

  // Buổi đã COMPLETED trước đó rồi mà điểm danh lại bị SỬA THAY ĐỔI (không phải lần
  // điểm danh đầu tiên, không phải bấm lưu lại y nguyên) — nếu kỳ thu tháng chứa buổi
  // này đã chốt sổ (POSTED/CLOSED), sửa lúc này sẽ làm sai lệch số buổi/số vắng của
  // charge đã lập mà không ai hay biết. Không chặn lần điểm danh ĐẦU TIÊN (session
  // chưa COMPLETED khi vào đây) vì đó là luồng bình thường, luôn diễn ra TRƯỚC khi
  // sinh học phí.
  const isCorrection = session.status === "COMPLETED";
  const hasChanges = records.some((r) => (oldStatusByStudent.get(r.studentId) ?? "PRESENT") !== r.status);
  if (isCorrection && hasChanges) {
    const lockedPeriod = await findLockedPeriodForSession(session.classId, session.sessionDate);
    if (lockedPeriod) {
      return NextResponse.json(
        {
          error: `Kỳ thu học phí tháng ${lockedPeriod.periodName} của lớp này đã ở trạng thái "${BILLING_PERIOD_STATUS_LABEL[lockedPeriod.status] ?? lockedPeriod.status}" — cần Mở lại kỳ thu trước khi sửa điểm danh buổi này, để tránh phiếu học phí đã chốt bị lệch số liệu.`,
        },
        { status: 409 },
      );
    }
  }

  const newlyAbsentIds = records.filter((r) => !ABSENCE_STATUSES.has(oldStatusByStudent.get(r.studentId) ?? "") && ABSENCE_STATUSES.has(r.status)).map((r) => r.studentId);
  const newlyPresentIds = records.filter((r) => ABSENCE_STATUSES.has(oldStatusByStudent.get(r.studentId) ?? "") && !ABSENCE_STATUSES.has(r.status)).map((r) => r.studentId);
  const attendancePositiveStatuses = new Set(["PRESENT", "MAKEUP"]);
  const newlyAttendedIds = records
    .filter((r) => !attendancePositiveStatuses.has(oldStatusByStudent.get(r.studentId) ?? "") && attendancePositiveStatuses.has(r.status))
    .map((r) => r.studentId);

  const [absenceCreditEnrollments, existingCredits, remedialEnrollments, availableCreditsForRemedial, consumedCreditsForRemedial] = await Promise.all([
    newlyAbsentIds.length > 0 && !session.class.isRemedial
      ? prisma.enrollment.findMany({
          where: {
            studentId: { in: newlyAbsentIds },
            classId: session.classId,
            status: "ACTIVE",
          },
        })
      : Promise.resolve([]),
    prisma.sessionCredit.findMany({ where: { sourceSessionId: session.id, studentId: { in: [...newlyAbsentIds, ...newlyPresentIds] } } }),
    session.class.isRemedial
      ? prisma.enrollment.findMany({
          where: {
            classId: session.classId,
            studentId: { in: records.map((r) => r.studentId) },
            status: "ACTIVE",
          },
          include: { student: { select: { fullName: true } } },
        })
      : Promise.resolve([]),
    session.class.isRemedial
      ? prisma.sessionCredit.findMany({
          where: {
            studentId: { in: records.map((r) => r.studentId) },
            status: "AVAILABLE",
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    session.class.isRemedial
      ? prisma.sessionCredit.findMany({
          where: {
            studentId: { in: records.map((r) => r.studentId) },
            consumedSessionId: session.id,
            status: "CONSUMED",
          },
        })
      : Promise.resolve([]),
  ]);
  const existingCreditByStudent = new Map(existingCredits.map((c) => [c.studentId, c]));
  const remedialEnrollmentByStudent = new Map(remedialEnrollments.map((e) => [e.studentId, e]));
  const availableCreditQueues = new Map<string, typeof availableCreditsForRemedial>();
  for (const credit of availableCreditsForRemedial) {
    const list = availableCreditQueues.get(credit.studentId) ?? [];
    list.push(credit);
    availableCreditQueues.set(credit.studentId, list);
  }
  const consumedCreditByStudent = new Map(consumedCreditsForRemedial.map((c) => [c.studentId, c]));

  if (session.class.isRemedial) {
    for (const studentId of newlyAttendedIds) {
      if (!remedialEnrollmentByStudent.has(studentId)) {
        return NextResponse.json(
          { error: "Có học viên chưa được gán vào lớp bổ trợ nhưng đang bị điểm danh ở buổi này." },
          { status: 409 },
        );
      }
      if (!consumedCreditByStudent.has(studentId) && (availableCreditQueues.get(studentId)?.length ?? 0) <= 0) {
        return NextResponse.json(
          { error: "Có học viên đã hết buổi bổ trợ khả dụng, không thể chấm có mặt ở buổi bổ trợ này." },
          { status: 409 },
        );
      }
    }
  }

  const autoCompleted: { studentId: string; fullName: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const r of records) {
      await tx.studentAttendance.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: r.studentId } },
        create: { sessionId: session.id, studentId: r.studentId, status: r.status },
        update: { status: r.status },
      });
    }

    for (const enrollment of absenceCreditEnrollments) {
      const credit = existingCreditByStudent.get(enrollment.studentId);
      if (!credit) {
        await tx.sessionCredit.create({
          data: { studentId: enrollment.studentId, enrollmentId: enrollment.id, sourceSessionId: session.id, status: "AVAILABLE", origin: "ABSENCE" },
        });
      } else if (credit.status === "VOIDED") {
        await tx.sessionCredit.update({ where: { id: credit.id }, data: { status: "AVAILABLE" } });
      }
      // status AVAILABLE/CONSUMED sẵn rồi thì để nguyên, không tạo trùng (unique studentId+sourceSessionId).
    }

    for (const studentId of newlyPresentIds) {
      const credit = existingCreditByStudent.get(studentId);
      if (credit && credit.status === "AVAILABLE") {
        await tx.sessionCredit.update({ where: { id: credit.id }, data: { status: "VOIDED" } });
      }
    }

    if (session.class.isRemedial) {
      for (const record of records) {
        const oldStatus = oldStatusByStudent.get(record.studentId) ?? "";
        const becameAttended = !attendancePositiveStatuses.has(oldStatus) && attendancePositiveStatuses.has(record.status);
        const becameNotAttended = attendancePositiveStatuses.has(oldStatus) && !attendancePositiveStatuses.has(record.status);

        if (becameAttended && !consumedCreditByStudent.has(record.studentId)) {
          const nextCredit = availableCreditQueues.get(record.studentId)?.shift();
          if (nextCredit) {
            await tx.sessionCredit.update({
              where: { id: nextCredit.id },
              data: { status: "CONSUMED", consumedSessionId: session.id, consumedAt: new Date() },
            });
          }
        }

        if (becameNotAttended) {
          const consumed = consumedCreditByStudent.get(record.studentId);
          if (consumed) {
            await tx.sessionCredit.update({
              where: { id: consumed.id },
              data: { status: "AVAILABLE", consumedSessionId: null, consumedAt: null },
            });
          }
        }
      }

      const remainingCredits = await tx.sessionCredit.groupBy({
        by: ["studentId"],
        where: {
          studentId: { in: remedialEnrollments.map((e) => e.studentId) },
          status: "AVAILABLE",
        },
        _count: { _all: true },
      });
      const remainingCreditMap = new Map(remainingCredits.map((row) => [row.studentId, row._count._all]));

      for (const enrollment of remedialEnrollments) {
        if ((remainingCreditMap.get(enrollment.studentId) ?? 0) > 0) continue;
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { status: "COMPLETED", endDate: new Date() },
        });
        await tx.enrollmentStatusHistory.create({
          data: {
            studentId: enrollment.studentId,
            enrollmentId: enrollment.id,
            fromStatus: enrollment.status,
            toStatus: "COMPLETED",
            reason: "Đã dùng hết buổi bổ trợ khả dụng",
            changedById: user.id,
          },
        });
        await syncStudentDerivedFields(enrollment.studentId, tx);
        autoCompleted.push({ studentId: enrollment.studentId, fullName: enrollment.student.fullName });
      }
    }

    await tx.classSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true, autoCompleted });
}
