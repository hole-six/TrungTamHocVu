import Link from "next/link";
import { notFound } from "next/navigation";
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
    <div className="space-y-6">
      <div>
        <Link href="/payroll/assistant-scores" className="text-sm text-primary">
          ← Quay lại đánh giá điểm trợ giảng
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
        <p className="mt-1 text-sm text-ink-muted48">Tháng {month}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Tổng ca</p>
          <p className="mt-1 font-display text-xl font-semibold">{card.totalShifts}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Ca tính điểm</p>
          <p className="mt-1 font-display text-xl font-semibold">{card.countedShifts}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Trừ / Cộng</p>
          <p className="mt-1 font-display text-xl font-semibold">
            <span className="text-red-600">{card.totalDeducted}</span> / <span className="text-emerald-600">{card.totalAdded}</span>
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted48">Tỉ lệ A</p>
          <p className="mt-1 font-display text-xl font-semibold">{card.ratio === null ? "—" : `${card.ratio.toFixed(1)}%`}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-display text-lg font-semibold tracking-tight">Theo cơ sở</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
            <tr>
              <th className="py-2 font-medium">Cơ sở</th>
              <th className="py-2 font-medium">Số ca</th>
              <th className="py-2 font-medium">Ca bổ trợ</th>
              <th className="py-2 font-medium">Điểm trừ</th>
              <th className="py-2 font-medium">Điểm cộng</th>
            </tr>
          </thead>
          <tbody>
            {card.byBranch.map((b) => (
              <tr key={b.branchId} className="border-b border-hairline last:border-0">
                <td className="py-2 font-medium">{b.branchName}</td>
                <td className="py-2">{b.shifts}</td>
                <td className="py-2 text-ink-muted48">{b.substituteShifts || "—"}</td>
                <td className="py-2 text-red-600">{b.deducted || "—"}</td>
                <td className="py-2 text-emerald-600">{b.added || "—"}</td>
              </tr>
            ))}
            {card.byBranch.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ink-muted48">
                  Không có ca làm trong tháng này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold tracking-tight">Lịch sử điểm trừ/cộng</h2>
        <div className="mt-3 space-y-2">
          {card.scoreEvents.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm">
              <div>
                <span className={e.type === "DEDUCT" ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>
                  {e.type === "DEDUCT" ? "-" : "+"}
                  {e.points}
                </span>
                <span className="ml-2 text-ink-muted80">{(e as any).branch?.name}</span>
                {e.reason && <span className="ml-2 text-ink-muted48">— {e.reason}</span>}
              </div>
              <span className="text-xs text-ink-muted48">{formatDate(e.eventDate)}</span>
            </div>
          ))}
          {card.scoreEvents.length === 0 && <p className="text-sm text-ink-muted48">Chưa có điểm trừ/cộng nào tháng này.</p>}
        </div>
      </div>

      <AssistantScoreForm
        employeeId={employee.id}
        month={month}
        branches={branches}
        currentBonus={card.bonus?.bonusPercent ?? null}
      />
    </div>
  );
}
