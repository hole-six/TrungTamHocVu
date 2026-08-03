import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/server/tuition-rules";

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function PayrollRunDetailRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    select: { id: true, periodName: true },
  });

  if (!run) {
    redirect("/payroll");
  }

  const range = monthRange(run.periodName);
  redirect(`/payroll?fromDate=${toYmd(range.start)}&toDate=${toYmd(range.end)}&runId=${run.id}#payroll-run-detail`);
}
