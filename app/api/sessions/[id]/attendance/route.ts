import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { computeSessionTiming, getVietnamToday } from "@/lib/server/class-rules";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";

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

  const roster = activeEnrollments.map((e) => ({
    studentId: e.studentId,
    fullName: e.student.fullName,
    studentCode: e.student.studentCode,
    status: attendanceByStudent[e.studentId] ?? "PRESENT",
  }));

  return NextResponse.json({ roster, sessionStatus: session.status });
}

const ABSENCE_STATUSES = new Set(["ABSENT"]);

// Lưu điểm danh cho cả lớp trong 1 buổi — đồng thời đánh dấu buổi học là đã hoàn
// thành (việc điểm danh tức là buổi học đã diễn ra), thay cho cột TTHoc (C/K) cấp
// lớp trong ChiTietLopHoc gốc nhưng chuẩn hóa xuống cấp học viên.
//
// Với học viên đã thu học phí TRỌN KHÓA (Charge.billingModel="COURSE"): mỗi lần điểm
// danh CHUYỂN sang Vắng (dù trước đó là gì) sinh 1 "buổi dư"
// (SessionCredit) để đăng ký học bù — vắng buổi nào vẫn tính tiền buổi đó, không giảm
// học phí, bù lại bằng buổi dư (xem lib/server/billing-generation.ts generateCourseCharge).
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

  const newlyAbsentIds = records.filter((r) => !ABSENCE_STATUSES.has(oldStatusByStudent.get(r.studentId) ?? "") && ABSENCE_STATUSES.has(r.status)).map((r) => r.studentId);
  const newlyPresentIds = records.filter((r) => ABSENCE_STATUSES.has(oldStatusByStudent.get(r.studentId) ?? "") && !ABSENCE_STATUSES.has(r.status)).map((r) => r.studentId);
  const attendancePositiveStatuses = new Set(["PRESENT", "MAKEUP"]);
  const newlyAttendedIds = records
    .filter((r) => !attendancePositiveStatuses.has(oldStatusByStudent.get(r.studentId) ?? "") && attendancePositiveStatuses.has(r.status))
    .map((r) => r.studentId);

  const [courseEnrollments, existingCredits, remedialEnrollments, availableCreditsForRemedial, consumedCreditsForRemedial] = await Promise.all([
    newlyAbsentIds.length > 0
      ? prisma.enrollment.findMany({
          where: {
            studentId: { in: newlyAbsentIds },
            classId: session.classId,
            status: "ACTIVE",
            student: { charges: { some: { classId: session.classId, billingModel: "COURSE" } } },
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

  await prisma.$transaction(async (tx) => {
    for (const r of records) {
      await tx.studentAttendance.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: r.studentId } },
        create: { sessionId: session.id, studentId: r.studentId, status: r.status },
        update: { status: r.status },
      });
    }

    for (const enrollment of courseEnrollments) {
      const credit = existingCreditByStudent.get(enrollment.studentId);
      if (!credit) {
        await tx.sessionCredit.create({
          data: { studentId: enrollment.studentId, enrollmentId: enrollment.id, sourceSessionId: session.id, status: "AVAILABLE" },
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
      }
    }

    await tx.classSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
