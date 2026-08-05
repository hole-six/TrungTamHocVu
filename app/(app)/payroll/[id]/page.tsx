import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function PayrollRunDetailRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    select: { periodName: true },
  });

  if (!run) {
    redirect("/payroll");
  }

  redirect(`/payroll?period=${run.periodName}`);
}
