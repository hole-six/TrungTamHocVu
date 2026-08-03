import { redirect } from "next/navigation";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthToRange(month: string) {
  const [year, monthValue] = month.split("-").map(Number);
  const start = new Date(year, (monthValue || 1) - 1, 1);
  const end = new Date(year, monthValue || 1, 0);
  const toYmd = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { fromDate: toYmd(start), toDate: toYmd(end) };
}

export default function AssistantScoresPage({ searchParams }: { searchParams: { month?: string } }) {
  const month = searchParams.month || currentMonth();
  const range = monthToRange(month);
  redirect(`/payroll?fromDate=${range.fromDate}&toDate=${range.toDate}#employee-detail`);
}
