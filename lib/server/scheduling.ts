// 3 "sweep" tự động — thay cho việc nhân sự phải nhớ bấm "Sinh buổi học" / "Sinh học
// phí" / "Tính lương" mỗi tháng. Mỗi sweep chỉ đưa dữ liệu tới trạng thái "đã sinh,
// sẵn sàng rà soát" — KHÔNG bao giờ tự động duyệt/chốt/khóa sổ; các bước
// REVIEWED/POSTED/CLOSED/APPROVED/LOCKED/PAID vẫn hoàn toàn thủ công.
//
// Mỗi đơn vị công việc (1 lớp / 1 kỳ học phí / 1 kỳ lương của 1 cơ sở) chạy trong
// try/catch riêng — 1 lớp/cơ sở lỗi không làm hỏng cả lượt sweep — và ghi 1 dòng
// AuditLog (userId=null, nghĩa là "hệ thống tự làm") để Giám đốc xem lại được ở
// /admin?logEntity=... — không cần thêm bảng hay trang mới.
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { computeAutoSessionWindow, createSessionsInRange, computeEnrollmentSessionProgress } from "@/lib/server/class-generation";
import { ensureBillingPeriod, generateChargesForPeriod } from "@/lib/server/billing-generation";
import { ensurePayrollRun, generatePayrollForRun } from "@/lib/server/payroll-generation";
import { monthKey } from "@/lib/server/tuition-rules";
import { grantRemainingSessionCredits } from "@/lib/server/session-credits";
import { syncStudentDerivedFields } from "@/lib/server/database-sync";

// Chặt hơn canEditCharges/canEditPayroll (được phép cả REVIEWED/REOPENED) — một khi
// con người đã bắt đầu rà soát kỳ, sweep tự động không được đụng vào số liệu nữa.
const AUTOMATION_BILLING_STATUSES = ["DRAFT", "GENERATED"];
const AUTOMATION_PAYROLL_STATUSES = ["DRAFT", "CALCULATED"];
const CLASS_END_CREDIT_REASON = "Buổi dư do lớp đã hết hạn dự kiến mà chưa rút lớp";

type SweepResult = {
  correlationId: string;
  processed: number;
  errors: number;
};

async function logAuto(params: {
  correlationId: string;
  branchId: string | null;
  entityType: "Class" | "BillingPeriod" | "PayrollRun" | "Enrollment";
  entityId: string;
  action:
    | "AUTO_GENERATE_SESSIONS"
    | "AUTO_GENERATE_CHARGES"
    | "AUTO_GENERATE_PAYROLL"
    | "AUTO_COMPLETE_ENROLLMENT"
    | "AUTO_SKIPPED"
    | "AUTO_ERROR";
  after: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: null,
      branchId: params.branchId,
      correlationId: params.correlationId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      after: JSON.stringify(params.after),
    },
  });
}

export async function runDailySessionSweep(): Promise<SweepResult> {
  const correlationId = randomUUID();
  let processed = 0;
  let errors = 0;

  const branches = await prisma.branch.findMany({ where: { isActive: true } });
  for (const branch of branches) {
    const classes = await prisma.class.findMany({
      where: { branchId: branch.id, status: "ACTIVE", scheduleRules: { some: {} } },
    });

    for (const cls of classes) {
      try {
        const window = await computeAutoSessionWindow(cls.id);
        if (!window) continue; // đã sinh đủ trước, hoặc lớp không có mốc ngày nào để bắt đầu
        const result = await createSessionsInRange(cls.id, window.fromDate, window.toDate);
        await logAuto({
          correlationId,
          branchId: branch.id,
          entityType: "Class",
          entityId: cls.id,
          action: "AUTO_GENERATE_SESSIONS",
          after: { ...result, fromDate: window.fromDate, toDate: window.toDate },
        });
        processed++;
      } catch (error) {
        errors++;
        await logAuto({
          correlationId,
          branchId: branch.id,
          entityType: "Class",
          entityId: cls.id,
          action: "AUTO_ERROR",
          after: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }
  }

  return { correlationId, processed, errors };
}

export async function runMonthlyBillingSweep(): Promise<SweepResult> {
  const correlationId = randomUUID();
  const periodName = monthKey(new Date());
  let processed = 0;
  let errors = 0;

  const branches = await prisma.branch.findMany({ where: { isActive: true } });
  for (const branch of branches) {
    try {
      const period = await ensureBillingPeriod(branch.id, periodName);
      if (!AUTOMATION_BILLING_STATUSES.includes(period.status)) {
        await logAuto({
          correlationId,
          branchId: branch.id,
          entityType: "BillingPeriod",
          entityId: period.id,
          action: "AUTO_SKIPPED",
          after: { status: period.status, periodName },
        });
        continue;
      }
      const result = await generateChargesForPeriod(period.id);
      if ("error" in result) {
        errors++;
        await logAuto({ correlationId, branchId: branch.id, entityType: "BillingPeriod", entityId: period.id, action: "AUTO_ERROR", after: result });
        continue;
      }
      await logAuto({
        correlationId,
        branchId: branch.id,
        entityType: "BillingPeriod",
        entityId: period.id,
        action: "AUTO_GENERATE_CHARGES",
        after: result,
      });
      processed++;
    } catch (error) {
      errors++;
      await logAuto({
        correlationId,
        branchId: branch.id,
        entityType: "BillingPeriod",
        entityId: branch.id, // chưa chắc có period.id nếu lỗi xảy ra trước khi tạo được period
        action: "AUTO_ERROR",
        after: { error: error instanceof Error ? error.message : String(error), periodName },
      });
    }
  }

  return { correlationId, processed, errors };
}

// Lớp đã qua expectedEndDate mà enrollment vẫn ACTIVE (không ai chủ động rút lớp) —
// tự động hoàn tất enrollment và cộng buổi bổ trợ cho phần buổi chưa học, cùng chính
// sách "rút lớp không hoàn tiền, chỉ cộng buổi bổ trợ" áp dụng khi rút thủ công (xem
// app/api/enrollments/[id]/route.ts). Bỏ qua lớp bổ trợ (isRemedial) vì lớp đó tự
// hoàn tất theo cơ chế riêng khi hết buổi dư (app/api/sessions/[id]/attendance/route.ts).
export async function runClassEndCreditSweep(): Promise<SweepResult> {
  const correlationId = randomUUID();
  let processed = 0;
  let errors = 0;

  const branches = await prisma.branch.findMany({ where: { isActive: true } });
  for (const branch of branches) {
    const classes = await prisma.class.findMany({
      where: { branchId: branch.id, status: "ACTIVE", isRemedial: false, expectedEndDate: { lt: new Date() } },
    });

    for (const cls of classes) {
      const enrollments = await prisma.enrollment.findMany({
        where: { classId: cls.id, status: "ACTIVE" },
      });

      for (const enrollment of enrollments) {
        try {
          const progress = await computeEnrollmentSessionProgress(cls.id, enrollment.enrollDate);
          const remaining = progress.remaining ?? 0;

          const grantedCredits = await prisma.$transaction(async (tx) => {
            const credits =
              remaining > 0
                ? await grantRemainingSessionCredits(
                    tx,
                    { id: enrollment.id, studentId: enrollment.studentId, classId: enrollment.classId ?? cls.id },
                    remaining,
                    CLASS_END_CREDIT_REASON
                  )
                : null;

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
                reason: "Lớp đã hết hạn dự kiến (expectedEndDate) — tự động hoàn tất, hệ thống sweep",
                changedById: null,
              },
            });

            await syncStudentDerivedFields(enrollment.studentId, tx);

            return credits;
          });

          await logAuto({
            correlationId,
            branchId: branch.id,
            entityType: "Enrollment",
            entityId: enrollment.id,
            action: "AUTO_COMPLETE_ENROLLMENT",
            after: { classId: cls.id, remaining, granted: grantedCredits?.granted ?? 0 },
          });
          processed++;
        } catch (error) {
          errors++;
          await logAuto({
            correlationId,
            branchId: branch.id,
            entityType: "Enrollment",
            entityId: enrollment.id,
            action: "AUTO_ERROR",
            after: { classId: cls.id, error: error instanceof Error ? error.message : String(error) },
          });
        }
      }
    }
  }

  return { correlationId, processed, errors };
}

export async function runMonthlyPayrollSweep(): Promise<SweepResult> {
  const correlationId = randomUUID();
  const periodName = monthKey(new Date());
  let processed = 0;
  let errors = 0;

  const branches = await prisma.branch.findMany({ where: { isActive: true } });
  for (const branch of branches) {
    try {
      const run = await ensurePayrollRun(branch.id, periodName);
      if (!AUTOMATION_PAYROLL_STATUSES.includes(run.status)) {
        await logAuto({
          correlationId,
          branchId: branch.id,
          entityType: "PayrollRun",
          entityId: run.id,
          action: "AUTO_SKIPPED",
          after: { status: run.status, periodName },
        });
        continue;
      }
      const result = await generatePayrollForRun(run.id);
      if ("error" in result) {
        errors++;
        await logAuto({ correlationId, branchId: branch.id, entityType: "PayrollRun", entityId: run.id, action: "AUTO_ERROR", after: result });
        continue;
      }
      await logAuto({
        correlationId,
        branchId: branch.id,
        entityType: "PayrollRun",
        entityId: run.id,
        action: "AUTO_GENERATE_PAYROLL",
        after: result,
      });
      processed++;
    } catch (error) {
      errors++;
      await logAuto({
        correlationId,
        branchId: branch.id,
        entityType: "PayrollRun",
        entityId: branch.id,
        action: "AUTO_ERROR",
        after: { error: error instanceof Error ? error.message : String(error), periodName },
      });
    }
  }

  return { correlationId, processed, errors };
}
