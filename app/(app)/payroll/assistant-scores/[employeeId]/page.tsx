import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, Award, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeAssistantScorecard } from "@/lib/server/assistant-score-rules";
import AssistantScoreForm from "@/components/payroll/AssistantScoreForm";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("vi-VN");
}

export default async function AssistantScoreDetailPage({
  params,
  searchParams,
}: {
  params: { employeeId: string };
  searchParams: { month?: string };
}) {
  const user = await getCurrentUser();
  const month = searchParams.month || currentMonth();

  const employee = await prisma.employee.findUnique({ where: { id: params.employeeId } });
  if (!employee) notFound();

  const [card, branches] = await Promise.all([
    computeAssistantScorecard(employee.id, month),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/payroll/assistant-scores"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#6b7280] transition-colors hover:text-[#f97316]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
            Quay lại
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{employee.fullName}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-ink-muted48">
            <Calendar className="h-4 w-4" strokeWidth={2} />
            <span>Tháng {month}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tổng ca */}
        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Tổng ca</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
              <Calendar className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <p className="text-3xl font-black text-[#111827]">{card.totalShifts}</p>
        </div>

        {/* Ca tính điểm */}
        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Ca tính điểm</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600">
              <Award className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <p className="text-3xl font-black text-[#111827]">{card.countedShifts}</p>
        </div>

        {/* Trừ / Cộng */}
        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Trừ / Cộng</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600">
              <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-600">{card.totalDeducted}</span>
            <span className="text-lg font-bold text-[#9ca3af]">/</span>
            <span className="text-2xl font-black text-emerald-600">{card.totalAdded}</span>
          </div>
        </div>

        {/* Tỉ lệ A */}
        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Tỉ lệ A (tham khảo)</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c]">
              <TrendingDown className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <p className="text-3xl font-black text-[#111827]">
            {card.ratio === null ? "—" : `${card.ratio.toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Table - Theo cơ sở */}
      <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white overflow-hidden">
        <div className="border-b-2 border-[#f3f4f6] bg-gradient-to-r from-[#fafafa] to-white px-6 py-4">
          <h2 className="text-lg font-bold text-[#111827]">Theo cơ sở</h2>
          <div className="mt-1 flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#f97316]" strokeWidth={2} />
            <p className="text-sm text-[#6b7280]">
              Chỉ số A và % thưởng tính riêng cho từng cơ sở — đây là số dùng để quyết định thưởng/phạt thực tế.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#f3f4f6] bg-[#fafafa]">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  Cơ sở
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  Số ca
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  Ca bổ trợ
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  Ca tính điểm
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  Điểm trừ
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  Điểm cộng
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  Tỉ lệ A
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-[#6b7280]">
                  % Thưởng
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {card.byBranch.map((b) => (
                <tr key={b.branchId} className="transition-colors hover:bg-[#fafafa]">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-[#111827]">{b.branchName}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-semibold text-[#111827]">{b.shifts}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-[#9ca3af]">{b.substituteShifts || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-semibold text-[#111827]">{b.countedShifts}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-red-600">{b.deducted || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-emerald-600">{b.added || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-[#111827]">
                      {b.ratio === null ? "—" : `${b.ratio.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {b.bonus ? (
                      <span className="inline-flex items-center rounded-lg bg-[#f97316] px-3 py-1 text-sm font-bold text-white">
                        {(b.bonus.bonusPercent * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-sm text-[#9ca3af]">Chưa nhập</span>
                    )}
                  </td>
                </tr>
              ))}
              {card.byBranch.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#9ca3af]">
                    Không có ca làm trong tháng này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lịch sử điểm trừ/cộng */}
      <div className="rounded-2xl border-2 border-[#e5e7eb] bg-white px-6 py-5">
        <h2 className="text-lg font-bold text-[#111827]">Lịch sử điểm trừ/cộng</h2>
        <div className="mt-4 space-y-2">
          {card.scoreEvents.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-xl border-2 border-[#f3f4f6] bg-[#fafafa] px-4 py-3 transition-all hover:border-[#f97316] hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    e.type === "DEDUCT"
                      ? "bg-red-100 text-red-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {e.type === "DEDUCT" ? (
                    <TrendingDown className="h-5 w-5" strokeWidth={2.5} />
                  ) : (
                    <TrendingUp className="h-5 w-5" strokeWidth={2.5} />
                  )}
                </div>
                <div>
                  <span className={`text-lg font-bold ${e.type === "DEDUCT" ? "text-red-600" : "text-emerald-600"}`}>
                    {e.type === "DEDUCT" ? "-" : "+"}
                    {e.points}
                  </span>
                  <span className="ml-2 font-medium text-[#111827]">{(e as any).branch?.name}</span>
                  {e.reason && <span className="ml-2 text-sm text-[#6b7280]">— {e.reason}</span>}
                </div>
              </div>
              <span className="text-sm text-[#9ca3af]">{formatDate(e.eventDate)}</span>
            </div>
          ))}
          {card.scoreEvents.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-[#e5e7eb] bg-[#fafafa] px-6 py-8 text-center">
              <p className="text-[#9ca3af]">Chưa có điểm trừ/cộng nào tháng này.</p>
            </div>
          )}
        </div>
      </div>

      {/* Forms */}
      <AssistantScoreForm
        employeeId={employee.id}
        month={month}
        branches={branches}
        bonusByBranch={Object.fromEntries(card.byBranch.map((b) => [b.branchId, b.bonus?.bonusPercent ?? null]))}
      />
    </div>
  );
}
