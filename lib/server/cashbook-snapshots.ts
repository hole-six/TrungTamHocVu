import { prisma } from "@/lib/prisma";
import type { StandardReportFilters } from "@/lib/reporting-filters";
import { serializeFilterHashInput } from "@/lib/reporting-filters";

const REPORT_CODE = "CASHBOOK_OVERVIEW";
const PERIOD_TYPE = "MONTH";

function hashString(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function getCurrentMonthPeriodKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthDateRange(periodKey: string) {
  const [yearRaw, monthRaw] = periodKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Kỳ thu chi không hợp lệ: ${periodKey}`);
  }
  return {
    startDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export function resolveCashbookPeriodKey(filters: StandardReportFilters) {
  return filters.periodKey ?? getCurrentMonthPeriodKey();
}

function buildFilterHash(filters: StandardReportFilters) {
  return hashString(serializeFilterHashInput(filters));
}

export async function buildCashbookOverviewLivePayload(
  branchId: string | null,
  filters?: Pick<StandardReportFilters, "periodKey" | "status">
) {
  const currentPeriodKey = filters?.periodKey ?? getCurrentMonthPeriodKey();
  const { startDate, endDate } = getMonthDateRange(currentPeriodKey);
  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;
  if (filters?.status) where.type = filters.status;
  where.txnDate = {
    gte: startDate,
    lte: endDate,
  };

  const [transactions, categories] = await Promise.all([
    prisma.cashTransaction.findMany({
      where,
      orderBy: { txnDate: "desc" },
      include: { category: true },
    }),
    prisma.transactionCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);

  const txnIds = transactions.map((t) => t.id);
  const [paymentPostings, refundPostings, stockPostings, handlers] = await Promise.all([
    prisma.paymentCashPosting.findMany({ where: { cashTransactionId: { in: txnIds } }, select: { cashTransactionId: true } }),
    prisma.refundCashPosting.findMany({ where: { cashTransactionId: { in: txnIds } }, select: { cashTransactionId: true } }),
    prisma.stockCashPosting.findMany({ where: { cashTransactionId: { in: txnIds } }, select: { cashTransactionId: true } }),
    prisma.user.findMany({
      where: { id: { in: [...new Set(transactions.map((t) => t.handledById).filter((id): id is string => !!id))] } },
      select: { id: true, fullName: true },
    }),
  ]);
  // Phiếu sinh từ nghiệp vụ khác (thu học phí/hoàn tiền/nhập kho) chỉ được sửa ở
  // nghiệp vụ gốc — khớp đúng ràng buộc đã có ở PATCH /api/cash-transactions/[id].
  const derivedIds = new Set([
    ...paymentPostings.map((p) => p.cashTransactionId),
    ...refundPostings.map((p) => p.cashTransactionId),
    ...stockPostings.map((p) => p.cashTransactionId),
  ]);
  const handlerNameById = new Map(handlers.map((h) => [h.id, h.fullName]));

  const totalThu = transactions.filter((item) => item.type === "THU" && item.status !== "VOIDED").reduce((sum, item) => sum + item.amount, 0);
  const totalChi = transactions.filter((item) => item.type === "CHI" && item.status !== "VOIDED").reduce((sum, item) => sum + item.amount, 0);

  const byCategory = Object.values(
    transactions.reduce((accumulator, transaction) => {
      const key = transaction.category?.name ?? "Chưa phân loại";
      if (!accumulator[key]) {
        accumulator[key] = { name: key, thu: 0, chi: 0 };
      }
      if (transaction.status !== "VOIDED") {
        if (transaction.type === "THU") accumulator[key].thu += transaction.amount;
        if (transaction.type === "CHI") accumulator[key].chi += transaction.amount;
      }
      return accumulator;
    }, {} as Record<string, { name: string; thu: number; chi: number }>),
  ).sort((left, right) => left.name.localeCompare(right.name, "vi"));

  return {
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      txnDate: transaction.txnDate,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      detail: transaction.detail,
      notes: transaction.notes,
      attachmentUrl: transaction.attachmentUrl,
      status: transaction.status,
      categoryId: transaction.categoryId,
      categoryName: transaction.category?.name ?? null,
      handledByName: transaction.handledById ? handlerNameById.get(transaction.handledById) ?? null : null,
      isDerived: derivedIds.has(transaction.id),
    })),
    categories,
    totals: {
      totalThu,
      totalChi,
      balance: totalThu - totalChi,
    },
    byCategory,
  };
}

export async function findCashbookOverviewSnapshot(branchId: string, filters: StandardReportFilters) {
  const periodKey = resolveCashbookPeriodKey(filters);
  const filterHash = buildFilterHash(filters);
  const period = await prisma.reportingPeriod.findUnique({
    where: {
      branchId_periodType_periodKey: {
        branchId,
        periodType: PERIOD_TYPE,
        periodKey,
      },
    },
  });
  if (!period) return null;

  const snapshot = await prisma.reportSnapshot.findFirst({
    where: {
      branchId,
      periodId: period.id,
      reportCode: REPORT_CODE,
      filterHash,
    },
    orderBy: { asOfAt: "desc" },
  });
  if (!snapshot) return null;

  return {
    id: snapshot.id,
    periodKey,
    asOfAt: snapshot.asOfAt,
    detail: snapshot.detailJson ? JSON.parse(snapshot.detailJson) : {},
  };
}

export async function createCashbookOverviewSnapshot({
  branchId,
  userId,
  filters,
}: {
  branchId: string;
  userId: string;
  filters: StandardReportFilters;
}) {
  const periodKey = resolveCashbookPeriodKey(filters);
  const filterHash = buildFilterHash(filters);
  const { startDate, endDate } = getMonthDateRange(periodKey);
  const payload = await buildCashbookOverviewLivePayload(branchId, {
    periodKey,
    status: filters.status,
  });

  const period = await prisma.reportingPeriod.upsert({
    where: {
      branchId_periodType_periodKey: {
        branchId,
        periodType: PERIOD_TYPE,
        periodKey,
      },
    },
    update: {
      startDate,
      endDate,
      status: "SNAPSHOT_READY",
    },
    create: {
      branchId,
      periodType: PERIOD_TYPE,
      periodKey,
      startDate,
      endDate,
      status: "SNAPSHOT_READY",
    },
  });

  const detailJson = JSON.stringify(payload);
  const summaryJson = JSON.stringify({
    totalThu: payload.totals.totalThu,
    totalChi: payload.totals.totalChi,
    balance: payload.totals.balance,
    transactionCount: payload.transactions.length,
  });

  const snapshot = await prisma.reportSnapshot.upsert({
    where: {
      periodId_reportCode_filterHash: {
        periodId: period.id,
        reportCode: REPORT_CODE,
        filterHash,
      },
    },
    update: {
      branchId,
      filterJson: serializeFilterHashInput(filters),
      mode: "SNAPSHOT",
      status: "READY",
      asOfAt: new Date(),
      summaryJson,
      detailJson,
      rowCount: payload.transactions.length,
      createdById: userId,
    },
    create: {
      branchId,
      periodId: period.id,
      reportCode: REPORT_CODE,
      filterHash,
      filterJson: serializeFilterHashInput(filters),
      mode: "SNAPSHOT",
      status: "READY",
      asOfAt: new Date(),
      summaryJson,
      detailJson,
      rowCount: payload.transactions.length,
      createdById: userId,
    },
  });

  return {
    id: snapshot.id,
    periodKey,
    asOfAt: snapshot.asOfAt,
    payload,
  };
}
