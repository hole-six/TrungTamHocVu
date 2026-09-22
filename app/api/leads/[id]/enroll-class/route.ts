import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { canAccessBranch } from "@/lib/branch-filter";
import { withStudentCodeRetry } from "@/lib/server/student-code";
import { ensureStudentFromLead } from "@/lib/server/lead-enrollment";
import { attachCourseBookRequirements } from "@/lib/server/enrollment-materials";
import { generatePeriodChargesForNewEnrollment } from "@/lib/server/billing-generation";
import { issueBooksToStudent } from "@/lib/server/book-issue";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("leads", role) || !canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Bạn không có quyền gán lớp từ Data tuyển sinh." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const classId = String(body.classId ?? "").trim();
  if (!classId) return NextResponse.json({ error: "Chưa chọn lớp để gán." }, { status: 400 });
  const enrollDate = body.enrollDate ? new Date(body.enrollDate) : new Date();
  if (Number.isNaN(enrollDate.getTime())) return NextResponse.json({ error: "Ngày nhập học không hợp lệ." }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, include: { student: true } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy Data tuyển sinh." }, { status: 404 });
  if (!(await canAccessBranch(lead.branchId))) return NextResponse.json({ error: "Không có quyền truy cập cơ sở." }, { status: 403 });

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      course: {
        include: {
          bookRequirements: {
            include: { book: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp." }, { status: 404 });
  if (cls.branchId !== lead.branchId) {
    return NextResponse.json({ error: "Data và lớp phải cùng cơ sở." }, { status: 409 });
  }
  if (cls.isRemedial) {
    return NextResponse.json({ error: "Không gán nhập học chính vào lớp bổ trợ." }, { status: 400 });
  }

  const unitPrice = Number(cls.tuitionPerSession ?? cls.course?.tuitionPerSession ?? 0);
  const periodCourseSessionCount = Number(cls.totalSessions ?? 0);
  if (!Number.isInteger(unitPrice) || unitPrice < 0 || !Number.isInteger(periodCourseSessionCount) || periodCourseSessionCount <= 0) {
    return NextResponse.json({ error: "Lớp chưa có học phí/buổi hoặc tổng số buổi để gán nhập học nhanh." }, { status: 400 });
  }

  const result = await withStudentCodeRetry(() =>
    prisma.$transaction(async (tx) => {
      const ensured = await ensureStudentFromLead(tx, lead.id, enrollDate);
      const existingActive = await tx.enrollment.findFirst({
        where: { studentId: ensured.student.id, classId: cls.id, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
      });
      if (existingActive) throw new Error("Học viên đã được gán lớp này rồi.");

      const enrollment = await tx.enrollment.create({
        data: {
          studentId: ensured.student.id,
          classId: cls.id,
          courseId: cls.courseId,
          status: "ACTIVE",
          billingModel: "PERIOD",
          enrollDate,
          learningStartDate: enrollDate,
          purchasedMainSessionCount: null,
          periodCourseSessionCount,
          tuitionUnitPriceSnapshot: unitPrice,
          paidCatchupSessionCount: 0,
          paidCatchupUnitPrice: null,
          pricingBasis: "MID_CLASS_FULL_COURSE",
        },
      });
      await attachCourseBookRequirements(tx, { studentId: ensured.student.id, classId: cls.id, enrollmentId: enrollment.id });
      await tx.enrollmentStatusHistory.create({
        data: { studentId: ensured.student.id, enrollmentId: enrollment.id, toStatus: "ACTIVE", changedById: user.id },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: { interestedClassId: cls.id, actualEnrollDate: enrollDate, status: "ENROLLED" },
      });
      await syncStudentDerivedFields(ensured.student.id, tx);
      return { studentId: ensured.student.id, enrollmentId: enrollment.id, createdStudent: ensured.created };
    }),
  );

  const billing = await generatePeriodChargesForNewEnrollment(result.enrollmentId);
  const bookItems = cls.course?.bookRequirements.map((item) => ({ bookId: item.bookId, quantity: item.quantity })) ?? [];
  const bookResult = bookItems.length
    ? await issueBooksToStudent({
        studentId: result.studentId,
        classId: cls.id,
        items: bookItems,
        issueDate: enrollDate,
        paidNow: false,
        issuedById: user.id,
        notes: "Tự động gắn sách khi gán lớp từ Data đạt test.",
      })
    : null;

  const syncedStudent = await syncStudentDerivedFields(result.studentId);
  const warnings = [
    ...billing.warnings,
    ...(bookResult && !("error" in bookResult) ? bookResult.warnings : []),
    ...(bookResult && "error" in bookResult ? [bookResult.error] : []),
  ];

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      branchId: cls.branchId,
      action: "enroll-from-lead",
      entityType: "Lead",
      entityId: lead.id,
      after: JSON.stringify({ studentId: result.studentId, enrollmentId: result.enrollmentId, classId: cls.id }),
    },
  });

  return NextResponse.json({
    item: syncedStudent,
    studentId: result.studentId,
    enrollmentId: result.enrollmentId,
    createdStudent: result.createdStudent,
    warnings,
  });
}
