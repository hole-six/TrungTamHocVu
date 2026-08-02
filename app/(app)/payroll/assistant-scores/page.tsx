import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBranchId } from "@/lib/branch-filter";
import { computeAssistantScorecard } from "@/lib/server/assistant-score-rules";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AssistantScoresPage({ searchParams }: { searchParams: { month?: string } }) {
  const activeBranchId = await getCurrentBranchId();
  const month = searchParams.month || currentMonth();

  const employees = await prisma.employee.findMany({
    where: {
      ...(activeBranchId ? { branchId: activeBranchId } : {}),
      sessionAssignments: { some: { role: { in: ["TEACHER", "ASSISTANT", "ASSISTANT2"] } } },
    },
    orderBy: { fullName: "asc" },
  });

  const scorecards = await Promise.all(
    employees.map(async (e) => ({ employee: e, card: await computeAssistantScorecard(e.id, month) }))
  );
  const withActivity = scorecards.filter((s) => s.card.totalShifts > 0);

  // Tính tổng các chỉ số
  const totalShifts = withActivity.reduce((sum, s) => sum + s.card.totalShifts, 0);
  const totalCounted = withActivity.reduce((sum, s) => sum + s.card.countedShifts, 0);
  const totalDeducted = withActivity.reduce((sum, s) => sum + s.card.totalDeducted, 0);
  const totalAdded = withActivity.reduce((sum, s) => sum + s.card.totalAdded, 0);
  const avgRatio = withActivity.length > 0
    ? withActivity.reduce((sum, s) => sum + (s.card.ratio ?? 0), 0) / withActivity.length
    : 0;

  return (
    <div className="min-h-screen space-y-6 pb-20">
      {/* Hero Header */}
      <section className="overflow-hidden rounded-[32px] border-2 border-[#fed7aa] bg-gradient-to-r from-[#fff7ed] via-[#ffedd5] to-[#fed7aa] px-6 py-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#ea580c] bg-[#ea580c] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
              Đánh giá giảng viên
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
              Điểm giảng viên & trợ giảng
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#78716c]">
              Tổng hợp ca làm, điểm trừ/cộng theo cơ sở. Bấm "Chi tiết" để xem tỉ lệ A và % thưởng riêng từng cơ sở.
            </p>
          </div>

          <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-2xl border-2 border-white bg-white px-4 py-3 shadow-md">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <input
                type="month"
                name="month"
                defaultValue={month}
                className="w-36 border-0 bg-transparent p-0 text-sm font-bold text-[#111827] outline-none"
              />
            </div>
            <button type="submit" className="btn-primary">
              Xem tháng
            </button>
          </form>
        </div>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Giảng viên</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-black text-[#111827]">{withActivity.length}</p>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Tổng ca</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-black text-[#111827]">{totalShifts}</p>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Ca tính điểm</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-black text-[#111827]">{totalCounted}</p>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">Điểm trừ/cộng</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-600">{totalDeducted}</span>
            <span className="text-lg font-bold text-[#9ca3af]">/</span>
            <span className="text-2xl font-black text-emerald-600">{totalAdded}</span>
          </div>
        </div>

        <div className="group rounded-2xl border-2 border-[#e5e7eb] bg-white px-5 py-4 transition-all hover:border-[#f97316] hover:shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">TB tỉ lệ A</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-black text-[#111827]">{avgRatio.toFixed(1)}%</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 px-5 py-4">
        <div className="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p className="text-sm font-medium leading-6 text-amber-900">
            <strong>Công thức:</strong> Tỉ lệ A = (Tổng điểm trừ − Tổng điểm cộng) / Số ca tính điểm × 100%, tính riêng theo từng cơ sở.
            Cột "Tỉ lệ A" ở bảng chỉ là số gộp toàn hệ thống để tham khảo nhanh.
            Mức % thưởng do nhân sự nhập tay sau khi xem chi tiết từng cơ sở.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border-2 border-[#e5e7eb] bg-white shadow-md">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full min-w-[900px]">
            <thead className="border-b-2 border-[#f3f4f6] bg-gradient-to-r from-[#fafafa] to-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Giảng viên/Trợ giảng
                </th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Tổng ca
                </th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Ca bổ trợ
                </th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Ca tính điểm
                </th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Điểm trừ
                </th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Điểm cộng
                </th>
                <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Tỉ lệ A
                </th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6b7280]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {withActivity.map(({ employee, card }) => (
                <tr key={employee.id} className="transition-colors hover:bg-[#fafafa]">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-sm font-black text-white">
                        {employee.fullName.charAt(0)}
                      </div>
                      <span className="font-bold text-[#111827]">{employee.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-[#111827]">{card.totalShifts}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-[#9ca3af]">{card.totalSubstituteShifts || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-[#111827]">{card.countedShifts}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-red-600">{card.totalDeducted || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-emerald-600">{card.totalAdded || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center rounded-lg bg-[#f97316] px-3 py-1 text-sm font-bold text-white">
                      {card.ratio === null ? "—" : `${card.ratio.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/payroll/assistant-scores/${employee.id}?month=${month}`}
                      className="inline-flex items-center gap-2 rounded-xl border-2 border-[#fed7aa] bg-white px-4 py-2 text-sm font-bold text-[#f97316] transition-all hover:bg-[#fff7ed] hover:shadow-md"
                    >
                      Chi tiết
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
              {withActivity.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3f4f6]">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-[#6b7280]">
                        Không có giảng viên/trợ giảng nào có ca làm trong tháng {month}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
