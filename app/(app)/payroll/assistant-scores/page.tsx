import { redirect } from "next/navigation";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AssistantScoresPage({ searchParams }: { searchParams: { month?: string } }) {
  const month = searchParams.month || currentMonth();
  redirect(`/payroll?period=${month}`);
}
