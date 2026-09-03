import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { getUserRole } from "@/lib/permissions";
import { canUpdate } from "@/lib/server/role-matrix";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";

type StudentResult = { studentId: string; ok: boolean; message: string };

// Gán NHIỀU học viên cùng lúc vào 1 lớp bổ trợ + tiêu buổi bổ trợ của họ vào ĐÚNG 1
// buổi tương lai đã chọn — gộp 2 việc trước đây phải làm rời rạc ở 2 chỗ khác nhau
// (ghi danh ở "Gán nhập học", rồi tiêu credit ở "Đăng ký học bù" của từng người) thành
// 1 thao tác hàng loạt. Mỗi học viên xử lý trong transaction RIÊNG để 1 người lỗi
// (vd hết buổi bổ trợ) không làm hỏng việc gán cho những người còn lại.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canUpdate("schedule", role)) {
    return NextResponse.json({ error: "Vai trò của bạn không có quyền gán học viên vào lớp bổ trợ" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({ where: { id: params.id } });
  if (!cls) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if (!cls.isRemedial) return NextResponse.json({ error: "Thao tác này chỉ áp dụng cho lớp bổ trợ" }, { status: 400 });

  const body: any = await req.json().catch(() => ({}));
  const rawStudentIds: unknown[] = Array.isArray(body.studentIds) ? body.studentIds : [];
  const studentIds: string[] = [...new Set(rawStudentIds.map((item) => String(item).trim()).filter(Boolean))];
  const targetSessionId = String(body.targetSessionId ?? "").trim();

  if (studentIds.length === 0) return NextResponse.json({ error: "Chưa chọn học viên nào" }, { status: 400 });
  if (!targetSessionId) return NextResponse.json({ error: "Chưa chọn buổi bổ trợ đích" }, { status: 400 });

  const targetSession = await prisma.classSession.findUnique({ where: { id: targetSessionId } });
  if (!targetSession) return NextResponse.json({ error: "Không tìm thấy buổi học đích" }, { status: 404 });
  if (targetSession.classId !== cls.id) {
    return NextResponse.json({ error: "Buổi đích phải thuộc đúng lớp bổ trợ này" }, { status: 400 });
  }
  if (targetSession.status === "CANCELLED") {
    return NextResponse.json({ error: "Buổi này đã bị hủy, không thể gán vào đây" }, { status: 409 });
  }

  const results: StudentResult[] = [];

  for (const studentId of studentIds) {
    try {
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      if (!student) {
        results.push({ studentId, ok: false, message: "Không tìm thấy học viên" });
        continue;
      }
      if (student.branchId !== cls.branchId) {
        results.push({ studentId, ok: false, message: "Học viên khác cơ sở với lớp bổ trợ" });
        continue;
      }

      const credit = await prisma.sessionCredit.findFirst({
        where: { studentId, status: "AVAILABLE" },
        orderBy: { createdAt: "asc" },
      });
      if (!credit) {
        results.push({ studentId, ok: false, message: "Học viên không còn buổi bổ trợ khả dụng" });
        continue;
      }
      if (credit.sourceSessionId === targetSessionId) {
        results.push({ studentId, ok: false, message: "Buổi đích trùng với buổi đã vắng của học viên này" });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const existingActive = await tx.enrollment.findFirst({
          where: { studentId, classId: cls.id, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
        });

        if (!existingActive) {
          const created = await tx.enrollment.create({
            data: {
              studentId,
              classId: cls.id,
              status: "ACTIVE",
              billingModel: "COURSE",
              enrollDate: new Date(),
              learningStartDate: new Date(),
              purchasedMainSessionCount: null,
              tuitionUnitPriceSnapshot: null,
              paidCatchupSessionCount: 0,
              paidCatchupUnitPrice: null,
              pricingBasis: "MANUAL",
            },
          });
          await tx.enrollmentStatusHistory.create({
            data: { studentId, enrollmentId: created.id, toStatus: "ACTIVE", changedById: user.id },
          });
        }

        await tx.studentAttendance.upsert({
          where: { sessionId_studentId: { sessionId: targetSessionId, studentId } },
          create: { sessionId: targetSessionId, studentId, status: "MAKEUP" },
          update: { status: "MAKEUP" },
        });

        await tx.sessionCredit.update({
          where: { id: credit.id },
          data: { status: "CONSUMED", consumedSessionId: targetSessionId, consumedAt: new Date() },
        });

        await syncStudentDerivedFields(studentId, tx);
      });

      results.push({ studentId, ok: true, message: `Đã gán ${student.fullName} vào buổi bổ trợ đã chọn` });
    } catch {
      results.push({ studentId, ok: false, message: "Có lỗi xảy ra khi xử lý học viên này" });
    }
  }

  return NextResponse.json({ results });
}
