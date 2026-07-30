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
import { computeAutoSessionWindow, createSessionsInRange } from "@/lib/server/class-generation";
import { ensureBillingPeriod, generateChargesForPeriod } from "@/lib/server/billing-generation";
import { ensurePayrollRun, generatePayrollForRun } from "@/lib/server/payroll-generation";
import { monthKey } from "@/lib/server/tuition-rules";

// Chặt hơn canEditCharges/canEditPayroll (được phép cả REVIEWED/REOPENED) — một khi
// con người đã bắt đầu rà soát kỳ, sweep tự động không được đụng vào số liệu nữa.
const AUTOMATION_BILLING_STATUSES = ["DRAFT", "GENERATED"];
const AUTOMATION_PAYROLL_STATUSES = ["DRAFT", "CALCULATED"];

type SweepResult = {
  correlationId: string;
  processed: number;
  errors: number;
};

async function logAuto(params: {
  correlationId: string;
  branchId: string | null;
  entityType: "Class" | "BillingPeriod" | "PayrollRun";
  entityId: string;
  action: "AUTO_GENERATE_SESSIONS" | "AUTO_GENERATE_CHARGES" | "AUTO_GENERATE_PAYROLL" | "AUTO_SKIPPED" | "AUTO_ERROR";
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
