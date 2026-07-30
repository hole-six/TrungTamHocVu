import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/current-user";
import { computeAssistantScorecard } from "@/lib/server/assistant-score-rules";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AssistantScoresPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await getCurrentUser();
  const month = searchParams.month || currentMonth();

  const assistants = await prisma.employee.findMany({
    where: {
      ...(user?.branchId ? { branchId: user.branchId } : {}),
      sessionAssignments: { some: { role: { in: ["ASSISTANT", "ASSISTANT2"] } } },
    },
    orderBy: { fullName: "asc" },
  });

  const scorecards = await Promise.all(
    assistants.map(async (e) => ({ employee: e, card: await computeAssistantScorecard(e.id, month) }))
  );
  const withActivity = scorecards.filter((s) => s.card.totalShifts > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Đánh giá điểm trợ giảng</h1>
          <p className="mt-1 text-sm text-ink-muted48">Tổng hợp ca làm, điểm trừ/cộng theo cơ sở — nguồn "Tổng hợp đánh giá điểm trợ giảng".</p>
        </div>
        <form className="flex items-center gap-2">
          <input type="month" name="month" defaultValue={month} className="input" />
          <button type="submit" className="btn-ghost">
            Xem
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="py-2 font-medium">Trợ giảng</th>
              <th className="py-2 font-medium">Tổng ca</th>
              <th className="py-2 font-medium">Ca bổ trợ</th>
              <th className="py-2 font-medium">Ca tính điểm</th>
              <th className="py-2 font-medium">Tổng trừ</th>
              <th className="py-2 font-medium">Tổng cộng</th>
              <th className="py-2 font-medium">Tỉ lệ A</th>
              <th className="py-2 font-medium">% Thưởng</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {withActivity.map(({ employee, card }) => (
              <tr key={employee.id} className="border-b border-hairline last:border-0">
                <td className="py-2 font-medium">{employee.fullName}</td>
                <td className="py-2">{card.totalShifts}</td>
                <td className="py-2 text-ink-muted48">{card.totalSubstituteShifts || "—"}</td>
                <td className="py-2">{card.countedShifts}</td>
                <td className="py-2 text-red-600">{card.totalDeducted || "—"}</td>
                <td className="py-2 text-emerald-600">{card.totalAdded || "—"}</td>
                <td className="py-2">{card.ratio === null ? "—" : `${card.ratio.toFixed(1)}%`}</td>
                <td className="py-2">
                  {card.bonus ? (
                    <span className="badge bg-primary/10 text-primary">{(card.bonus.bonusPercent * 100).toFixed(0)}%</span>
                  ) : (
                    <span className="text-xs text-ink-muted48">Chưa nhập</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <Link href={`/payroll/assistant-scores/${employee.id}?month=${month}`} className="text-xs text-primary">
                    Chi tiết →
                  </Link>
                </td>
              </tr>
            ))}
            {withActivity.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-ink-muted48">
                  Không có trợ giảng nào có ca làm trong tháng {month}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-muted48">
        Tỉ lệ A = (Tổng điểm trừ − Tổng điểm cộng) / Số ca tính điểm × 100%. Mức % thưởng do nhân sự tự nhập sau khi xem tỉ lệ A —
        hệ thống không tự suy ra mức thưởng vì quy tắc quy đổi cụ thể chưa được xác nhận.
      </p>
    </div>
  );
}
