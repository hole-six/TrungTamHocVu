import { PrismaClient } from "@prisma/client";
import { computeTotalAmount } from "../lib/server/tuition-rules";

const prisma = new PrismaClient();

type CreditState = {
  id: string;
  remainingAmount: number;
  createdAt: Date;
  usedAt: Date | null;
};

function getChargeAnchorDate(charge: {
  billingModel: string;
  createdAt: Date;
  billingPeriod: { startDate: Date };
}) {
  return charge.billingModel === "COURSE" ? charge.createdAt : charge.billingPeriod.startDate;
}

async function main() {
  const students = await prisma.student.findMany({
    where: { charges: { some: {} } },
    select: { id: true, studentCode: true, fullName: true },
    orderBy: { studentCode: "asc" },
  });

  let studentCount = 0;
  let updatedChargeCount = 0;
  let updatedCreditCount = 0;
  const samples: Array<{
    studentCode: string;
    fullName: string;
    changedCharges: Array<{
      chargeId: string;
      periodName: string;
      billingModel: string;
      fromOpeningBalance: number;
      toOpeningBalance: number;
      fromTotalAmount: number;
      toTotalAmount: number;
    }>;
  }> = [];

  for (const student of students) {
    const [charges, credits] = await Promise.all([
      prisma.charge.findMany({
        where: { studentId: student.id },
        include: {
          billingPeriod: { select: { id: true, periodName: true, startDate: true } },
          allocations: {
            include: {
              payment: { select: { paidDate: true, status: true } },
            },
          },
        },
        orderBy: [{ billingPeriod: { startDate: "asc" } }, { createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.creditBalance.findMany({
        where: { studentId: student.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);

    if (charges.length === 0) continue;
    studentCount += 1;

    const creditPool: CreditState[] = credits.map((credit) => ({
      id: credit.id,
      remainingAmount: credit.amount,
      createdAt: credit.createdAt,
      usedAt: null,
    }));

    const changedCharges: Array<{
      chargeId: string;
      periodName: string;
      billingModel: string;
      fromOpeningBalance: number;
      toOpeningBalance: number;
      fromTotalAmount: number;
      toTotalAmount: number;
    }> = [];

    const groups = new Map<string, typeof charges>();
    for (const charge of charges) {
      const key = `${charge.billingPeriod.id}:${getChargeAnchorDate(charge).toISOString()}`;
      groups.set(key, [...(groups.get(key) ?? []), charge]);
    }

    const orderedGroupKeys = [...groups.keys()].sort((left, right) => left.localeCompare(right));

    for (const groupKey of orderedGroupKeys) {
      const groupCharges = (groups.get(groupKey) ?? []).sort((left, right) => {
        const leftBase = left.tuitionAmount + left.materialsAmount;
        const rightBase = right.tuitionAmount + right.materialsAmount;
        if (rightBase !== leftBase) return rightBase - leftBase;
        return left.createdAt.getTime() - right.createdAt.getTime();
      });

      const anchorDate = getChargeAnchorDate(groupCharges[0]);
      const priorCharges = charges.filter((item) => getChargeAnchorDate(item) < anchorDate);
      const billedBefore = priorCharges.reduce((sum, item) => sum + item.tuitionAmount + item.materialsAmount, 0);
      const allocatedBefore = priorCharges.reduce((sum, item) => {
        const paidBefore = item.allocations
          .filter(
            (allocation) =>
              allocation.payment.status !== "VOIDED" &&
              allocation.payment.status !== "REFUNDED" &&
              allocation.payment.paidDate < anchorDate,
          )
          .reduce((allocationSum, allocation) => allocationSum + allocation.amount, 0);
        return sum + paidBefore;
      }, 0);

      const debtBeforeCredits = billedBefore - allocatedBefore;
      const availableCredits = creditPool.filter((credit) => credit.createdAt < anchorDate && credit.remainingAmount > 0);
      const availableCreditAmount = availableCredits.reduce((sum, credit) => sum + credit.remainingAmount, 0);
      const anchorBaseAmount = groupCharges[0].tuitionAmount + groupCharges[0].materialsAmount;
      const creditToApply = Math.min(Math.max(debtBeforeCredits + anchorBaseAmount, 0), availableCreditAmount);
      const anchorOpeningBalance = debtBeforeCredits - creditToApply;

      for (const charge of groupCharges) {
        const openingBalance = charge.id === groupCharges[0].id ? anchorOpeningBalance : 0;
        const totalAmount = computeTotalAmount(charge.tuitionAmount, charge.materialsAmount, openingBalance);

        if (openingBalance !== charge.openingBalance || totalAmount !== charge.totalAmount) {
          await prisma.charge.update({
            where: { id: charge.id },
            data: { openingBalance, totalAmount },
          });
          updatedChargeCount += 1;
          changedCharges.push({
            chargeId: charge.id,
            periodName: charge.billingPeriod.periodName,
            billingModel: charge.billingModel,
            fromOpeningBalance: charge.openingBalance,
            toOpeningBalance: openingBalance,
            fromTotalAmount: charge.totalAmount,
            toTotalAmount: totalAmount,
          });
        }
      }

      let remainingCreditToApply = creditToApply;
      for (const credit of availableCredits) {
        if (remainingCreditToApply <= 0) break;
        const consumed = Math.min(credit.remainingAmount, remainingCreditToApply);
        credit.remainingAmount -= consumed;
        if (credit.remainingAmount === 0) {
          credit.usedAt = groupCharges[0].createdAt;
        }
        remainingCreditToApply -= consumed;
      }
    }

    for (const credit of creditPool) {
      const source = credits.find((item) => item.id === credit.id);
      if (!source) continue;

      if (source.amount === credit.remainingAmount && String(source.usedAt) === String(credit.usedAt)) {
        continue;
      }

      await prisma.creditBalance.update({
        where: { id: credit.id },
        data: {
          amount: credit.remainingAmount,
          usedAt: credit.usedAt,
        },
      });
      updatedCreditCount += 1;
    }

    if (changedCharges.length > 0) {
      samples.push({
        studentCode: student.studentCode,
        fullName: student.fullName,
        changedCharges,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        studentCount,
        updatedChargeCount,
        updatedCreditCount,
        changedStudentCount: samples.length,
        samples: samples.slice(0, 10),
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
