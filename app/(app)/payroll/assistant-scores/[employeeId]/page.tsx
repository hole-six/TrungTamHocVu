import { redirect } from "next/navigation";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AssistantScoreDetailPage({
  params,
  searchParams,
}: {
  params: { employeeId: string };
  searchParams: { month?: string };
}) {
  const month = searchParams.month || currentMonth();
  redirect(`/payroll?period=${month}&employeeId=${params.employeeId}`);
}
