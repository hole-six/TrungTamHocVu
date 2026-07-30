"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/server/lead-rules";
import {
  getCreateSnapshotButtonLabel,
  getLiveFallbackLabel,
  getReportEffectiveBadge,
  getReportModeLabel,
  getSnapshotTimestampLabel,
} from "@/lib/reporting-ui";
import { exportSectionsToExcel } from "@/lib/export-utils";

type ReportsResponse = {
  meta: {
    requestedMode: "live" | "snapshot";
    effectiveMode: "live" | "snapshot";
    filters: {
      mode: "live" | "snapshot";
      periodKey: string | null;
      keyword: string | null;
      timePreset: string;
    };
    snapshotReady: boolean;
    snapshotId: string | null;
    snapshotAt: string | null;
    periodKey: string | null;
  };
  dashboard: {
    studentActive: number;
    studentLeft: number;
    totalLeads: number;
    conversionRate: number;
    leadPipeline: Record<string, number>;
    revenueByPeriod: Array<{ period: string; billed: number; collected: number }>;
    debtors: Array<{
      id: string;
      fullName: string;
      studentCode: string;
      studentDisplayId?: string | null;
      outstanding: number;
      guardianName?: string | null;
      guardianPhone?: string | null;
      guardianPortalEmail?: string | null;
      guardianPortalActive?: boolean;
      leadCode?: string | null;
      className?: string | null;
    }>;
    portalCoverageCount: number;
    studentsWithoutPortal: number;
    convertedStudentsWithoutPortal: number;
    qualifiedLeadsWithoutClass: number;
    materialsTotal: number;
    bookRanking: Array<{ name: string; total: number }>;
    payrollByPeriod: Array<{ period: string; total: number }>;
    totalThu: number;
    totalChi: number;
    birthdayThisMonth: Array<{ id: string; fullName: string; studentCode: string; studentDisplayId?: string | null; dob: string | null }>;
    tuitionByClass: Array<{
      className: string;
      sessionCount: number;
      tuitionTotal: number;
      materialsTotal: number;
      billed: number;
      collected: number;
    }>;
    payrollBreakdown: null | {
      periodName: string;
      teachers: Array<{ name: string; hours: number; amount: number }>;
      assistants: Array<{ name: string; hours: number; amount: number }>;
    };
  };
  reportHs: {
    activeStudents: number;
    leftStudents: number;
    newEnrollments: number;
    totalStudents: number;
    classes: Array<{ classCode: string; className: string; activeCount: number; leftCount: number; totalCount: number }>;
  };
  reportHp: null | {
    periodName: string | null;
    totals: {
      sessionCount: number;
      materialsAmount: number;
      openingBalance: number;
      tuitionAmount: number;
      billedAmount: number;
      collectedAmount: number;
      remainingAmount: number;
    };
    classes: Array<{
      classCode: string;
      className: string;
      sessionCount: number;
      materialsAmount: number;
      openingBalance: number;
      tuitionAmount: number;
      billedAmount: number;
      collectedAmount: number;
      remainingAmount: number;
      studentCount: number;
    }>;
  };
};

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function formatStudentRef(student: { fullName: string; studentCode: string; studentDisplayId?: string | null }) {
  return `${student.fullName} (${student.studentDisplayId ?? student.studentCode})`;
}

function formatDebtorRef(student: ReportsResponse["dashboard"]["debtors"][number]) {
  const parts = [
    formatStudentRef(student),
    student.className ?? "Chưa có lớp",
    student.leadCode ? `Lead ${student.leadCode}` : null,
    student.guardianName ? `PH ${student.guardianName}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function getDefaultPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsWorkspace({ canAccessReports }: { canAccessReports: boolean }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"live" | "snapshot">((searchParams.get("mode") as "live" | "snapshot") ?? "live");
  const [periodKey, setPeriodKey] = useState(searchParams.get("periodKey") ?? getDefaultPeriodKey());
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");

  const queryString = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    setMode((searchParams.get("mode") as "live" | "snapshot") ?? "live");
    setPeriodKey(searchParams.get("periodKey") ?? getDefaultPeriodKey());
    setKeyword(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (!canAccessReports) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/reports/summary?${queryString}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Không tải được dữ liệu báo cáo.");
        }
        return response.json();
      })
      .then((payload: ReportsResponse) => setData(payload))
      .catch((fetchError: Error) => {
        if (fetchError.name !== "AbortError") {
          setError(fetchError.message);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [queryString, canAccessReports]);

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", mode);
    next.set("periodKey", periodKey);
    next.set("timePreset", mode === "snapshot" ? "current_period" : "this_month");
    if (keyword.trim()) next.set("q", keyword.trim());
    else next.delete("q");
    router.push(`${pathname}?${next.toString()}`);
  };

  const createSnapshot = async () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", "snapshot");
    next.set("periodKey", periodKey);
    next.set("timePreset", "current_period");

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/summary?${next.toString()}`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Không chốt được báo cáo kỳ này.");
      }
      router.push(`${pathname}?${next.toString()}`);
      router.refresh();
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Không chốt được báo cáo kỳ này.");
    } finally {
      setCreating(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const sections = [
      {
        title: "Tổng quan",
        columns: [
          { key: "metric", label: "Chỉ số" },
          { key: "value", label: "Giá trị" },
        ],
        rows: [
          { metric: "Kỳ báo cáo", value: data.meta.periodKey ?? periodKey },
          { metric: "Chế độ dữ liệu", value: data.meta.effectiveMode === "snapshot" ? "Kỳ đã chốt" : "Dữ liệu hiện tại" },
          { metric: "Học viên đang học", value: data.dashboard.studentActive },
          { metric: "Học viên nghỉ học", value: data.dashboard.studentLeft },
          { metric: "Tổng lead", value: data.dashboard.totalLeads },
          { metric: "Tỷ lệ chuyển đổi", value: `${data.dashboard.conversionRate}%` },
          { metric: "HV đã có portal PH", value: data.dashboard.portalCoverageCount },
          { metric: "HV chưa có portal PH", value: data.dashboard.studentsWithoutPortal },
          { metric: "Lead đủ điều kiện chưa xếp lớp", value: data.dashboard.qualifiedLeadsWithoutClass },
          { metric: "Tổng thu", value: formatVnd(data.dashboard.totalThu) },
          { metric: "Tổng chi", value: formatVnd(data.dashboard.totalChi) },
          { metric: "Tổng sách", value: data.dashboard.materialsTotal },
        ],
      },
      {
        title: "Pipeline lead",
        columns: [
          { key: "status", label: "Trạng thái" },
          { key: "count", label: "Số lượng" },
        ],
        rows: Object.entries(data.dashboard.leadPipeline).map(([status, count]) => ({
          status: LEAD_STATUS_LABEL[status as keyof typeof LEAD_STATUS_LABEL] ?? status,
          count,
        })),
      },
      {
        title: "Doanh thu theo kỳ",
        columns: [
          { key: "period", label: "Kỳ" },
          { key: "billed", label: "Phải thu" },
          { key: "collected", label: "Đã thu" },
        ],
        rows: data.dashboard.revenueByPeriod.map((item) => ({
          period: item.period,
          billed: formatVnd(item.billed),
          collected: formatVnd(item.collected),
        })),
      },
      {
        title: "Danh sách công nợ",
        columns: [
          { key: "student", label: "Học viên" },
          { key: "guardian", label: "Phụ huynh" },
          { key: "portal", label: "Portal" },
          { key: "outstanding", label: "Còn nợ" },
        ],
        rows: data.dashboard.debtors.map((item) => ({
          student: formatDebtorRef(item),
          guardian: item.guardianName ?? "",
          portal: item.guardianPortalEmail ?? "Chưa cấp",
          outstanding: formatVnd(item.outstanding),
        })),
      },
      {
        title: "Tổng hợp học sinh theo lớp",
        columns: [
          { key: "classCode", label: "Mã lớp" },
          { key: "className", label: "Tên lớp" },
          { key: "activeCount", label: "Đang học" },
          { key: "leftCount", label: "Nghỉ học" },
          { key: "totalCount", label: "Tổng" },
        ],
        rows: data.reportHs.classes,
      },
      {
        title: "Tổng hợp học phí theo lớp",
        columns: [
          { key: "classCode", label: "Mã lớp" },
          { key: "className", label: "Tên lớp" },
          { key: "sessionCount", label: "Số buổi" },
          { key: "studentCount", label: "Số HV" },
          { key: "tuitionAmount", label: "Học phí" },
          { key: "materialsAmount", label: "Giáo trình" },
          { key: "billedAmount", label: "Phải thu" },
          { key: "collectedAmount", label: "Đã thu" },
          { key: "remainingAmount", label: "Còn nợ" },
        ],
        rows: (data.reportHp?.classes ?? []).map((item) => ({
          ...item,
          tuitionAmount: formatVnd(item.tuitionAmount),
          materialsAmount: formatVnd(item.materialsAmount),
          billedAmount: formatVnd(item.billedAmount),
          collectedAmount: formatVnd(item.collectedAmount),
          remainingAmount: formatVnd(item.remainingAmount),
        })),
      },
      {
        title: "Xếp hạng sách",
        columns: [
          { key: "name", label: "Tên sách" },
          { key: "total", label: "Số lượng" },
        ],
        rows: data.dashboard.bookRanking,
      },
      {
        title: "Sinh nhật trong tháng",
        columns: [
          { key: "student", label: "Học viên" },
          { key: "dob", label: "Ngày sinh" },
        ],
        rows: data.dashboard.birthdayThisMonth.map((item) => ({
          student: formatStudentRef(item),
          dob: item.dob ?? "",
        })),
      },
    ];

    exportSectionsToExcel(
      sections,
      `bao-cao-tong-hop_${data.meta.periodKey ?? periodKey}_${data.meta.effectiveMode}`,
      "BaoCaoTongHop",
    );
  };

  if (!canAccessReports) {
    return (
      <div className="card">
        <h1 className="text-2xl font-semibold tracking-tight">Báo cáo</h1>
        <p className="mt-2 text-sm text-ink-muted48">Vai trò hiện tại không có quyền truy cập khu vực báo cáo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Báo cáo tổng hợp</h1>
            <p className="mt-1 text-sm text-ink-muted48">
              Chọn dữ liệu hiện tại hoặc bản đã chốt theo kỳ. Báo cáo chỉ để xem, lọc, export và chốt báo cáo kỳ — không sửa dữ liệu gốc.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExport} disabled={!data} className="btn-ghost">
              Xuất Excel
            </button>
            <button onClick={createSnapshot} disabled={creating} className="btn-primary">
              {getCreateSnapshotButtonLabel("report", creating)}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Chế độ dữ liệu</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as "live" | "snapshot")} className="input">
              <option value="live">{getReportModeLabel("live")}</option>
              <option value="snapshot">{getReportModeLabel("snapshot")}</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-ink-muted48">Kỳ báo cáo</span>
            <input type="month" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} className="input" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-ink-muted48">Tìm nhanh</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm theo mã, tên, SĐT, phụ huynh, lớp..."
                className="input"
              />
              <button onClick={applyFilters} className="btn-ghost whitespace-nowrap">
                Áp dụng
              </button>
            </div>
          </label>
        </div>

        {data?.meta ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className={`badge ${data.meta.effectiveMode === "snapshot" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
              {getReportEffectiveBadge(data.meta.effectiveMode, "report")}
            </span>
            <span className="badge bg-ink/5 text-ink-muted80">Kỳ: {data.meta.periodKey ?? periodKey}</span>
            {data.meta.snapshotAt ? (
              <span className="badge bg-emerald-100 text-emerald-700">{getSnapshotTimestampLabel("report", data.meta.snapshotAt)}</span>
            ) : (
              <span className="badge bg-ink/5 text-ink-muted80">{getLiveFallbackLabel("report")}</span>
            )}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      {loading || !data ? (
        <div className="card">
          <p className="text-sm text-ink-muted48">Đang tải báo cáo...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Học viên & tuyển sinh</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-ink-muted48">Đang học</p><p className="font-display text-xl font-semibold">{data.dashboard.studentActive}</p></div>
              <div><p className="text-ink-muted48">Đã nghỉ</p><p className="font-display text-xl font-semibold">{data.dashboard.studentLeft}</p></div>
              <div><p className="text-ink-muted48">Tổng lead</p><p className="font-display text-xl font-semibold">{data.dashboard.totalLeads}</p></div>
              <div><p className="text-ink-muted48">Tỷ lệ chuyển đổi</p><p className="font-display text-xl font-semibold">{data.dashboard.conversionRate}%</p></div>
            </div>
            <div className="mt-4 space-y-1">
              {LEAD_STATUSES.map((status) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted80">{LEAD_STATUS_LABEL[status]}</span>
                  <span className="font-medium">{data.dashboard.leadPipeline[status] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Cảnh báo vận hành</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-ink-muted48">HV đã có portal PH</p><p className="font-display text-xl font-semibold text-emerald-700">{data.dashboard.portalCoverageCount}</p></div>
              <div><p className="text-ink-muted48">HV chưa có portal PH</p><p className="font-display text-xl font-semibold text-amber-700">{data.dashboard.studentsWithoutPortal}</p></div>
              <div><p className="text-ink-muted48">Đã convert chưa có portal</p><p className="font-display text-xl font-semibold text-rose-700">{data.dashboard.convertedStudentsWithoutPortal}</p></div>
              <div><p className="text-ink-muted48">Lead đủ điều kiện chưa xếp lớp</p><p className="font-display text-xl font-semibold text-sky-700">{data.dashboard.qualifiedLeadsWithoutClass}</p></div>
            </div>
          </div>

          {data.reportHp && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold tracking-tight">Doanh thu học phí theo kỳ</h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                  <tr><th className="py-2 font-medium">Kỳ</th><th className="py-2 font-medium">Phải thu</th><th className="py-2 font-medium">Đã thu</th></tr>
                </thead>
                <tbody>
                  {data.dashboard.revenueByPeriod.map((period) => (
                    <tr key={period.period} className="border-b border-hairline last:border-0">
                      <td className="py-2"><Link href="/tuition" className="text-primary">{period.period}</Link></td>
                      <td className="py-2 text-ink-muted80">{formatVnd(period.billed)}</td>
                      <td className="py-2 font-medium">{formatVnd(period.collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.reportHp && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold tracking-tight">Công nợ cao nhất</h2>
              <div className="mt-3 space-y-2">
                {data.dashboard.debtors.map((student) => (
                  <div key={student.id} className="rounded-xl border border-hairline px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/students/${student.id}`} className="text-primary">{formatStudentRef(student)}</Link>
                      <span className="font-medium text-red-600">{formatVnd(student.outstanding)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted48">
                      {student.className ?? "Chưa có lớp"} · {student.leadCode ? `Lead ${student.leadCode}` : "Không gắn lead"}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted48">
                      {student.guardianName ?? "Chưa có phụ huynh"} · {student.guardianPortalEmail ?? "Chưa cấp portal"}
                    </p>
                  </div>
                ))}
                {data.dashboard.debtors.length === 0 && <p className="text-sm text-ink-muted48">Không có học viên nợ học phí.</p>}
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Giáo trình</h2>
            <p className="mt-1 text-sm text-ink-muted48">Tổng giá trị đã xuất: <strong>{formatVnd(data.dashboard.materialsTotal)}</strong></p>
            <div className="mt-3 space-y-2">
              {data.dashboard.bookRanking.map((book) => (
                <div key={book.name} className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted80">{book.name}</span>
                  <span className="font-medium">{formatVnd(book.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {data.dashboard.payrollBreakdown && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold tracking-tight">Công GV/TG — kỳ {data.dashboard.payrollBreakdown.periodName}</h2>
              <p className="mt-1 text-sm text-ink-muted48">Công dạy lấy từ buổi học đã phân công, không lấy từ chấm công ngày.</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Giáo viên</p>
                  <div className="mt-2 space-y-1.5">
                    {data.dashboard.payrollBreakdown.teachers.map((line) => (
                      <div key={line.name} className="flex items-center justify-between text-sm">
                        <span>{line.name}</span>
                        <span className="text-ink-muted48">{line.hours}h · {formatVnd(line.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted48">Trợ giảng</p>
                  <div className="mt-2 space-y-1.5">
                    {data.dashboard.payrollBreakdown.assistants.map((line) => (
                      <div key={line.name} className="flex items-center justify-between text-sm">
                        <span>{line.name}</span>
                        <span className="text-ink-muted48">{line.hours}h · {formatVnd(line.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Sinh nhật học viên tháng này</h2>
            <div className="mt-3 space-y-2">
              {data.dashboard.birthdayThisMonth.map((student) => (
                <div key={student.id} className="flex items-center justify-between text-sm">
                  <Link href={`/students/${student.id}`} className="text-primary">{formatStudentRef(student)}</Link>
                  <span className="text-ink-muted48">{new Date(student.dob!).getDate()}/{new Date(student.dob!).getMonth() + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {data.reportHp && (
            <div className="card overflow-x-auto">
              <h2 className="font-display text-lg font-semibold tracking-tight">Học phí theo lớp</h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                  <tr>
                    <th className="py-2 font-medium">Lớp</th>
                    <th className="py-2 font-medium">Buổi</th>
                    <th className="py-2 font-medium">Học phí</th>
                    <th className="py-2 font-medium">Giáo trình</th>
                    <th className="py-2 font-medium">Phải thu</th>
                    <th className="py-2 font-medium">Đã thu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dashboard.tuitionByClass.map((classRow) => (
                    <tr key={classRow.className} className="border-b border-hairline last:border-0">
                      <td className="py-2 font-medium">{classRow.className}</td>
                      <td className="py-2 text-ink-muted80">{classRow.sessionCount}</td>
                      <td className="py-2 text-ink-muted80">{formatVnd(classRow.tuitionTotal)}</td>
                      <td className="py-2 text-ink-muted80">{formatVnd(classRow.materialsTotal)}</td>
                      <td className="py-2 text-ink-muted80">{formatVnd(classRow.billed)}</td>
                      <td className="py-2 font-medium">{formatVnd(classRow.collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card">
            <h2 className="font-display text-lg font-semibold tracking-tight">Dòng tiền</h2>
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div><p className="text-ink-muted48">Tổng thu</p><p className="font-display text-xl font-semibold text-primary">{formatVnd(data.dashboard.totalThu)}</p></div>
              <div><p className="text-ink-muted48">Tổng chi</p><p className="font-display text-xl font-semibold">{formatVnd(data.dashboard.totalChi)}</p></div>
              <div><p className="text-ink-muted48">Số dư</p><p className="font-display text-xl font-semibold">{formatVnd(data.dashboard.totalThu - data.dashboard.totalChi)}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
