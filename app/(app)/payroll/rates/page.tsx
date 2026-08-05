import { redirect } from "next/navigation";

export default function PayrollRatesPage() {
  redirect("/payroll?filter=missing-rate");
}
