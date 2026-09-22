import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CreditSnapshot = {
  id: string;
  amount: number;
  createdAt: Date;
  usedAt: Date | null;
};

export async function computeBalanceSnapshot(
  studentId: string,
  beforeDate: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const [chargeComponents, allocatedTotal, availableCredits] = await Promise.all([
    tx.charge.aggregate({
      where: { studentId, billingPeriod: { startDate: { lt: beforeDate } } },
      _sum: { tuitionAmount: true, materialsAmount: true },
    }),
    tx.paymentAllocation.aggregate({
      where: {
        charge: { studentId, billingPeriod: { startDate: { lt: beforeDate } } },
        payment: {
          paidDate: { lt: beforeDate },
          status: { notIn: ["VOIDED", "REFUNDED"] },
        },
      },
      _sum: { amount: true },
    }),
    tx.creditBalance.findMany({
      where: {
        studentId,
        createdAt: { lt: beforeDate },
        OR: [{ usedAt: null }, { usedAt: { gte: beforeDate } }],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const debtBeforeCredits =
    (chargeComponents._sum.tuitionAmount ?? 0) +
    (chargeComponents._sum.materialsAmount ?? 0) -
    (allocatedTotal._sum.amount ?? 0);
  const availableCreditAmount = availableCredits.reduce((sum, credit) => sum + credit.amount, 0);

  return {
    debtBeforeCredits,
    availableCredits,
    availableCreditAmount,
    openingBalance: debtBeforeCredits - availableCreditAmount,
    unusedCreditIds: availableCredits.map((credit) => credit.id),
  };
}

export async function computeOpeningBalance(
  studentId: string,
  beforeDate: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const snapshot = await computeBalanceSnapshot(studentId, beforeDate, tx);
  return { openingBalance: snapshot.openingBalance, unusedCreditIds: snapshot.unusedCreditIds };
}

export async function consumeCreditBalances(
  credits: CreditSnapshot[],
  amountToConsume: number,
  consumeAt: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  let remaining = Math.max(0, amountToConsume);

  for (const credit of credits) {
    if (remaining <= 0) break;

    if (credit.amount <= remaining) {
      await tx.creditBalance.update({
        where: { id: credit.id },
        data: { usedAt: consumeAt },
      });
      remaining -= credit.amount;
      continue;
    }

    await tx.creditBalance.update({
      where: { id: credit.id },
      data: { amount: credit.amount - remaining },
    });
    remaining = 0;
  }

  return amountToConsume - remaining;
}

export async function computeOutstandingBalance(
  studentId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const [chargeComponents, allocatedTotal, unusedCredits] = await Promise.all([
    tx.charge.aggregate({ where: { studentId }, _sum: { tuitionAmount: true, materialsAmount: true } }),
    tx.paymentAllocation.aggregate({
      where: {
        charge: { studentId },
        payment: {
          status: { notIn: ["VOIDED", "REFUNDED"] },
        },
      },
      _sum: { amount: true },
    }),
    tx.creditBalance.findMany({ where: { studentId, usedAt: null } }),
  ]);
  const creditAmount = unusedCredits.reduce((sum, credit) => sum + credit.amount, 0);
  return (
    (chargeComponents._sum.tuitionAmount ?? 0) +
    (chargeComponents._sum.materialsAmount ?? 0) -
    (allocatedTotal._sum.amount ?? 0) -
    creditAmount
  );
}

export type OutstandingBreakdown = {
  tuitionOutstanding: number;
  materialsOutstanding: number;
  discountableOutstanding: number;
  outstanding: number;
  creditAmount: number;
};

export async function computeOutstandingBreakdown(
  studentId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<OutstandingBreakdown> {
  const [charges, unusedCredits] = await Promise.all([
    tx.charge.findMany({
      where: { studentId },
      select: {
        id: true,
        tuitionAmount: true,
        materialsAmount: true,
        allocations: {
          where: { payment: { status: { notIn: ["VOIDED", "REFUNDED"] } } },
          select: { amount: true },
        },
      },
    }),
    tx.creditBalance.findMany({ where: { studentId, usedAt: null }, select: { amount: true } }),
  ]);

  let tuitionOutstanding = 0;
  let materialsOutstanding = 0;

  for (const charge of charges) {
    const paid = charge.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    const materialsDue = Math.max(0, charge.materialsAmount - Math.min(charge.materialsAmount, paid));
    const paidAfterMaterials = Math.max(0, paid - charge.materialsAmount);
    const tuitionDue = Math.max(0, charge.tuitionAmount - paidAfterMaterials);
    tuitionOutstanding += tuitionDue;
    materialsOutstanding += materialsDue;
  }

  const creditAmount = unusedCredits.reduce((sum, credit) => sum + credit.amount, 0);
  let remainingCredit = creditAmount;
  const creditForTuition = Math.min(tuitionOutstanding, remainingCredit);
  tuitionOutstanding -= creditForTuition;
  remainingCredit -= creditForTuition;
  const creditForMaterials = Math.min(materialsOutstanding, remainingCredit);
  materialsOutstanding -= creditForMaterials;

  const outstanding = tuitionOutstanding + materialsOutstanding;

  return {
    tuitionOutstanding,
    materialsOutstanding,
    discountableOutstanding: tuitionOutstanding,
    outstanding,
    creditAmount,
  };
}
