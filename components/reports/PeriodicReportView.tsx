"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo } from "react";
import type { PeriodicReport } from "@/lib/server/periodic-report";
import { exportSectionsToExcel } from "@/lib/export-utils";

// Ngày trong CSDL là UTC-nửa-đêm đại diện đúng ngày lịch VN — định dạng theo UTC để
// không lệch ngày khi máy xem ở múi giờ khác.
function dm(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}
function dmy(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}
function money(value: number) {
  return value.toLocaleString("vi-VN");
}
function monthLabel(periodName: string) {
  const [y, m] = periodName.split("-");
  return `${Number(m)}/${y}`;
}

// Số âm = tiền dư (phụ huynh đóng trước) → hiện chữ xám; số dương ở cột nợ → đậm.
function Amount({ value, strong, debt }: { value: number; strong?: boolean; debt?: boolean }) {
  const tone = value < 0 ? "text-[#64748b]" : debt && value > 0 ? "text-[#b91c1c]" : "text-[#0f1729]";
  return <span className={`tabular-nums ${tone} ${strong ? "font-bold" : ""}`}>{value === 0 ? "0" : money(value)}</span>;
}

function SectionTitle({ index, title, hint }: { index: string; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-[#0f1729] pb-2">
      <span className="text-sm font-black tabular-nums text-[#0f1729]">{index}</span>
      <h2 className="text-base font-black uppercase tracking-wide text-[#0f1729]">{title}</h2>
      {hint ? <span className="text-xs text-[#64748b]">{hint}</span> : null}
    </div>
  );
}

function SubTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-bold text-[#0f1729]">
      {children}
      {count != null ? <span className="rounded-md bg-[#0f1729] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">{count}</span> : null}
    </h3>
  );
}

const TH = "border-b border-[#cbd5e1] bg-[#f1f5f9] px-2.5 py-2 text-left text-[11px] font-bold uppercase leading-4 tracking-wide text-[#334155] print:py-1.5 print:text-[9px]";
const THR = `${TH} text-right`;
const TD = "border-b border-[#e2e8f0] px-2.5 py-1.5 align-top text-[13px] leading-5 text-[#0f1729] print:py-1 print:text-[11px] print:leading-4";
const TDR = `${TD} text-right tabular-nums`;
const TFOOT = "border-t-2 border-[#0f1729] bg-[#f8fafc] px-2.5 py-2 text-[13px] font-bold print:py-1 print:text-[11px]";

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#e2e8f0] print:overflow-visible">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-[#cbd5e1] px-4 py-3 text-sm text-[#64748b]">{children}</p>;
}

function Bar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 min-w-[80px] flex-1 overflow-hidden rounded-full bg-[#e2e8f0]">
        <div className="h-full rounded-full bg-[#0f1729]" style={{ width: `${pct}%` }} />
      </div>
      {label ? <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[#334155]">{label}</span> : null}
    </div>
  );
}

export default function PeriodicReportView({ report }: { report: PeriodicReport }) {
  const router = useRouter();
  const { range, tuition, tests, movement, cashFlow, forecast } = report;
  const isWeek = range.kind === "week";
  const title = isWeek ? `Báo cáo tuần ${range.weekNumber}` : `Báo cáo tháng ${monthLabel(range.periodName)}`;
  const tuitionMonth = monthLabel(range.periodName);
  const collectRate = tuition.totals.tuitionTotal > 0 ? Math.round((tuition.totals.paid / tuition.totals.tuitionTotal) * 100) : 0;
  const maxActive = Math.max(1, ...movement.activeByClass.map((row) => row.count));
  const maxExpenseCat = Math.max(1, ...cashFlow.expenseByCategory.map((row) => row.amount));

  const forecastGroups = useMemo(() => {
    if (!forecast) return [];
    const groups = new Map<string, typeof forecast.rows>();
    for (const row of forecast.rows) groups.set(row.classCode, [...(groups.get(row.classCode) ?? []), row]);
    return [...groups.entries()];
  }, [forecast]);

  function go(kind: "week" | "month", at?: string) {
    const search = new URLSearchParams({ kind });
    if (at) search.set("at", at);
    router.push(`/reports/periodic?${search.toString()}`);
  }

  function exportExcel() {
    const sections = [
      {
        title: `1. Học phí tháng ${tuitionMonth} (nộp tính từ ${dm(range.tuitionMonthStart)} – ${dm(range.paidTo)})`,
        columns: [
          { key: "lop", label: "Tên lớp" },
          { key: "buoi", label: "Số buổi trong tháng" },
          { key: "gt", label: "Giáo trình" },
          { key: "ton", label: "HP tồn tháng trước" },
          { key: "hp", label: "Tổng học phí" },
          { key: "nop", label: "Tiền đã nộp" },
          { key: "con", label: "Còn lại" },
          { key: "cd", label: "Cộng dồn" },
        ],
        rows: [
          ...tuition.rows.map((row) => ({ lop: row.classCode, buoi: row.sessionsInMonth, gt: row.materials, ton: row.carriedBalance, hp: row.tuitionTotal, nop: row.paid, con: row.remaining, cd: row.cumulative })),
          { lop: "Tổng cộng", buoi: tuition.totals.sessionsInMonth, gt: tuition.totals.materials, ton: tuition.totals.carriedBalance, hp: tuition.totals.tuitionTotal, nop: tuition.totals.paid, con: tuition.totals.remaining, cd: tuition.totals.cumulative },
        ],
      },
      {
        title: "2A. Danh sách test",
        columns: [
          { key: "gap", label: "Ngày gặp" },
          { key: "ten", label: "Họ tên HV" },
          { key: "sinh", label: "Ngày sinh" },
          { key: "tuoi", label: "Tuổi" },
          { key: "truong", label: "Lớp ở trường" },
          { key: "me", label: "Phụ huynh" },
          { key: "sdt", label: "Sđt" },
          { key: "test", label: "Ngày hẹn test" },
          { key: "lop", label: "Lớp dự kiến" },
          { key: "dukien", label: "Ngày dự kiến đi học" },
          { key: "nhaphoc", label: "Ngày nhập học thực tế" },
          { key: "ma", label: "Mã số đi học" },
          { key: "ghichu", label: "Ghi chú" },
        ],
        rows: tests.map((t) => ({ gap: dmy(t.meetDate), ten: t.fullName, sinh: dmy(t.dob), tuoi: t.age ?? "", truong: t.schoolGrade ?? "", me: t.guardianName ?? "", sdt: t.phone ?? "", test: dmy(t.testDate), lop: t.expectedClass ?? "", dukien: dmy(t.expectedStartDate), nhaphoc: dmy(t.actualEnrollDate), ma: t.studentCode ?? "", ghichu: t.notes ?? "" })),
      },
      {
        title: "2B. Số lượng HV đang học",
        columns: [{ key: "lop", label: "Lớp" }, { key: "sl", label: "SL HV đang theo học" }],
        rows: [...movement.activeByClass.map((row) => ({ lop: row.classCode, sl: row.count })), { lop: "Tổng cộng", sl: movement.activeByClass.reduce((s, r) => s + r.count, 0) }],
      },
      {
        title: "Số lượng HV nhập học",
        columns: [{ key: "ngay", label: "Ngày" }, { key: "hv", label: "Học viên" }, { key: "lop", label: "Lớp" }],
        rows: movement.newEnrollments.map((row) => ({ ngay: dmy(row.date), hv: `${row.fullName} (${row.studentCode})`, lop: row.classCode })),
      },
      {
        title: "Số lượng HV nghỉ học",
        columns: [{ key: "ngay", label: "Ngày" }, { key: "hv", label: "Học viên" }, { key: "lop", label: "Lớp" }],
        rows: movement.left.map((row) => ({ ngay: dmy(row.date), hv: `${row.fullName} (${row.studentCode})`, lop: row.classCode })),
      },
      {
        title: `3. Mục chi (tổng ${money(cashFlow.expenseTotal)})`,
        columns: [{ key: "ngay", label: "Ngày tháng" }, { key: "loai", label: "Tên loại chi" }, { key: "ct", label: "Chi tiết" }, { key: "dg", label: "Diễn giải" }, { key: "tien", label: "Số tiền chi" }, { key: "nguoi", label: "Người thu/chi" }],
        rows: cashFlow.expenseRows.map((row) => ({ ngay: dmy(row.date), loai: row.category, ct: row.categoryDetail, dg: row.description, tien: row.amount, nguoi: row.handler })),
      },
      {
        title: `Mục thu học phí (tổng ${money(cashFlow.incomeTotal)})`,
        columns: [{ key: "ngay", label: "Ngày" }, { key: "phieu", label: "Phiếu thu" }, { key: "hv", label: "Học viên" }, { key: "ht", label: "Hình thức" }, { key: "nguoi", label: "Người thu" }, { key: "tien", label: "Số tiền" }],
        rows: cashFlow.incomeRows.map((row) => ({ ngay: dmy(row.date), phieu: row.paymentNo, hv: row.student, ht: row.method, nguoi: row.receiver, tien: row.amount })),
      },
      ...(forecast
        ? [
            {
              title: `4. Dự kiến thu tháng ${monthLabel(forecast.periodName)}`,
              columns: [
                { key: "lop", label: "Tên lớp" },
                { key: "hv", label: "Tên HV" },
                { key: "buoi", label: "Số buổi" },
                { key: "du", label: "Buổi dư trừ" },
                { key: "dk", label: "HP đầu kỳ" },
                { key: "hb", label: "Học bổng (%)" },
                { key: "hp", label: "HP tháng" },
                { key: "gt", label: "Tiền giáo trình" },
                { key: "tong", label: "Tổng phải nộp" },
              ],
              rows: [
                ...forecast.rows.map((row) => ({ lop: row.classCode, hv: `${row.studentName}.${row.studentCode}`, buoi: row.sessions, du: row.carried, dk: row.opening, hb: row.scholarshipPct || "", hp: row.tuition, gt: row.materials, tong: row.total })),
                { lop: "Tổng cộng", hv: `${forecast.totals.students} học viên`, buoi: "", du: "", dk: forecast.totals.opening, hb: "", hp: forecast.totals.tuition, gt: forecast.totals.materials, tong: forecast.totals.total },
              ],
            },
          ]
        : []),
    ];
    const fileName = isWeek ? `bao-cao-tuan-${range.weekNumber}-${range.param}` : `bao-cao-thang-${range.periodName}`;
    exportSectionsToExcel(sections, fileName, title);
  }

  const kpis = [
    { label: `Học phí tháng ${tuitionMonth}`, value: money(tuition.totals.tuitionTotal), sub: `${tuition.rows.length} lớp · ${tuition.totals.studentCount} phiếu` },
    { label: "Đã nộp", value: money(tuition.totals.paid), sub: `${collectRate}% học phí tháng`, bar: collectRate },
    { label: "Cộng dồn còn phải thu", value: money(tuition.totals.cumulative), sub: "gồm tồn tháng trước", debt: tuition.totals.cumulative > 0 },
    { label: "HV đang theo học", value: String(movement.activeStudentTotal), sub: `+${movement.newEnrollments.length} nhập học · −${movement.left.length} nghỉ` },
    { label: "Lead / test mới", value: String(tests.length), sub: `${tests.filter((t) => t.studentCode).length} đã thành học viên` },
    { label: "Thu − Chi", value: money(cashFlow.incomeTotal - cashFlow.expenseTotal), sub: `Thu ${money(cashFlow.incomeTotal)} · Chi ${money(cashFlow.expenseTotal)}` },
  ];

  return (
    <div className="space-y-5">
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } .report-sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; } }`}</style>

      {/* Thanh điều khiển — không in */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <Link href="/reports" className="text-sm font-semibold text-[#64748b] hover:text-[#0f1729]">
          ← Báo cáo tổng quan
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#e2e8f0] bg-white p-0.5">
            {(["week", "month"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => go(kind)}
                className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${range.kind === kind ? "bg-[#0f1729] text-white" : "text-[#0f1729] hover:bg-[#f1f5f9]"}`}
              >
                {kind === "week" ? "Tuần" : "Tháng"}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(range.kind, range.prevParam)} className="btn-ghost-sm" aria-label="Kỳ trước">
            ←
          </button>
          {isWeek ? (
            <input
              type="date"
              className="input h-9 w-auto"
              value={range.param}
              onChange={(event) => event.target.value && go("week", event.target.value)}
              aria-label="Chọn ngày trong tuần"
            />
          ) : (
            <input
              type="month"
              className="input h-9 w-auto"
              value={range.param}
              onChange={(event) => event.target.value && go("month", event.target.value)}
              aria-label="Chọn tháng"
            />
          )}
          <button type="button" onClick={() => go(range.kind, range.nextParam)} className="btn-ghost-sm" aria-label="Kỳ sau">
            →
          </button>
          <button type="button" onClick={exportExcel} className="btn-ghost-sm">
            Xuất Excel
          </button>
          <button type="button" onClick={() => window.print()} className="btn-primary-sm">
            In / Lưu PDF
          </button>
        </div>
      </div>

      <article className="print-area report-sheet mx-auto max-w-[1200px] rounded-xl border border-[#e2e8f0] bg-white px-5 py-6 shadow-sm sm:px-8">
        {/* Tiêu đề */}
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e2e8f0] pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#64748b]">{report.branchName}</p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-[#0f1729] sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-[#475569]">
              {isWeek ? `Từ ${dmy(range.start)} đến ${dmy(range.end)}` : `Từ ${dmy(range.start)} đến ${dmy(range.end)}`}
            </p>
          </div>
          <p className="text-xs text-[#64748b]">Lập lúc {new Date(report.generatedAt).toLocaleString("vi-VN")}</p>
        </header>

        {/* Tổng quan */}
        <section className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#e2e8f0] md:grid-cols-3 xl:grid-cols-6 print:grid-cols-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white px-3.5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">{kpi.label}</p>
              <p className={`mt-1 text-xl font-black tabular-nums ${kpi.debt ? "text-[#b91c1c]" : "text-[#0f1729]"}`}>{kpi.value}</p>
              {kpi.bar != null ? (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div className="h-full bg-[#0f1729]" style={{ width: `${Math.min(100, kpi.bar)}%` }} />
                </div>
              ) : null}
              <p className="mt-1 text-[11px] text-[#64748b]">{kpi.sub}</p>
            </div>
          ))}
        </section>

        {/* 1. HỌC PHÍ */}
        <section className="mt-8">
          <SectionTitle index="1." title={`Học phí tháng ${tuitionMonth}`} hint={`Tiền nộp tính từ ${dm(range.tuitionMonthStart)} – ${dm(range.paidTo)}`} />
          {tuition.rows.length === 0 ? (
            <Empty>Chưa có phiếu học phí tháng {tuitionMonth}.</Empty>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th className={TH}>Tên lớp</th>
                  <th className={THR}>Số buổi trong tháng</th>
                  <th className={THR}>Giáo trình</th>
                  <th className={THR}>HP tồn tháng trước</th>
                  <th className={THR}>Tổng học phí</th>
                  <th className={THR}>Tiền đã nộp</th>
                  <th className={THR}>Còn lại</th>
                  <th className={THR}>Cộng dồn</th>
                  <th className={`${TH} w-[150px] print:w-[110px]`}>Tiến độ thu</th>
                </tr>
              </thead>
              <tbody>
                {tuition.rows.map((row) => {
                  const rate = row.tuitionTotal > 0 ? Math.round((row.paid / row.tuitionTotal) * 100) : row.paid > 0 ? 100 : 0;
                  return (
                    <tr key={row.classId} className="break-inside-avoid">
                      <td className={TD}>
                        <span className="font-bold">{row.classCode}</span>
                        <span className="block text-[11px] text-[#64748b]">{row.className}</span>
                      </td>
                      <td className={TDR}>{row.sessionsInMonth}</td>
                      <td className={TDR}><Amount value={row.materials} /></td>
                      <td className={TDR}><Amount value={row.carriedBalance} debt /></td>
                      <td className={TDR}><Amount value={row.tuitionTotal} /></td>
                      <td className={TDR}><Amount value={row.paid} /></td>
                      <td className={TDR}><Amount value={row.remaining} debt /></td>
                      <td className={TDR}><Amount value={row.cumulative} debt strong /></td>
                      <td className={TD}><Bar value={row.paid} max={row.tuitionTotal || row.paid} label={`${Math.min(rate, 999)}%`} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tbody>
                <tr>
                  <td className={TFOOT}>Tổng cộng</td>
                  <td className={`${TFOOT} text-right tabular-nums`}>{tuition.totals.sessionsInMonth}</td>
                  <td className={`${TFOOT} text-right`}><Amount value={tuition.totals.materials} strong /></td>
                  <td className={`${TFOOT} text-right`}><Amount value={tuition.totals.carriedBalance} strong debt /></td>
                  <td className={`${TFOOT} text-right`}><Amount value={tuition.totals.tuitionTotal} strong /></td>
                  <td className={`${TFOOT} text-right`}><Amount value={tuition.totals.paid} strong /></td>
                  <td className={`${TFOOT} text-right`}><Amount value={tuition.totals.remaining} strong debt /></td>
                  <td className={`${TFOOT} text-right`}><Amount value={tuition.totals.cumulative} strong debt /></td>
                  <td className={TFOOT}><Bar value={tuition.totals.paid} max={tuition.totals.tuitionTotal || tuition.totals.paid} label={`${collectRate}%`} /></td>
                </tr>
              </tbody>
            </TableWrap>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-[#64748b]">
            Còn lại = Tổng học phí − Tiền đã nộp. Cộng dồn = HP tồn tháng trước + Còn lại. Số âm (chữ xám) là tiền phụ huynh đóng dư / đóng trước. Mỗi học viên tính về 1 lớp chính.
          </p>
        </section>

        {/* 2. BIẾN ĐỘNG HỌC SINH */}
        <section className="mt-8 break-before-page">
          <SectionTitle index="2." title={`Biến động học sinh trong ${isWeek ? "tuần" : "tháng"}`} />

          <SubTitle count={tests.length}>A. Danh sách test</SubTitle>
          {tests.length === 0 ? (
            <Empty>Không có lead / lịch gặp mới trong kỳ.</Empty>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th className={TH}>Ngày gặp</th>
                  <th className={TH}>Họ tên HV</th>
                  <th className={TH}>Ngày sinh</th>
                  <th className={THR}>Tuổi</th>
                  <th className={TH}>Lớp ở trường</th>
                  <th className={TH}>Phụ huynh</th>
                  <th className={TH}>Sđt</th>
                  <th className={TH}>Hẹn test</th>
                  <th className={TH}>Lớp dự kiến</th>
                  <th className={TH}>Dự kiến đi học</th>
                  <th className={TH}>Nhập học thực tế</th>
                  <th className={TH}>Mã số đi học</th>
                  <th className={`${TH} min-w-[220px]`}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className="break-inside-avoid">
                    <td className={`${TD} whitespace-nowrap`}>{dmy(t.meetDate)}</td>
                    <td className={`${TD} font-semibold`}>{t.fullName}</td>
                    <td className={`${TD} whitespace-nowrap`}>{dmy(t.dob)}</td>
                    <td className={TDR}>{t.age ?? "—"}</td>
                    <td className={TD}>{t.schoolGrade ?? "—"}</td>
                    <td className={TD}>{t.guardianName ?? "—"}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>{t.phone ?? "—"}</td>
                    <td className={`${TD} whitespace-nowrap`}>{dmy(t.testDate)}</td>
                    <td className={TD}>{t.expectedClass ?? "—"}</td>
                    <td className={`${TD} whitespace-nowrap`}>{dmy(t.expectedStartDate)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{dmy(t.actualEnrollDate)}</td>
                    <td className={`${TD} font-mono text-[12px]`}>{t.studentCode ?? "—"}</td>
                    <td className={`${TD} text-[12px] leading-snug text-[#334155]`}>{t.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}

          <SubTitle>B. Biến động học sinh</SubTitle>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] print:grid-cols-[1.4fr_1fr]">
            <div className="rounded-lg border border-[#e2e8f0] p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-[#334155]">Số lượng HV đang học</p>
                <p className="text-2xl font-black tabular-nums text-[#0f1729]">
                  {movement.activeByClass.reduce((s, r) => s + r.count, 0)}
                  <span className="ml-1 text-xs font-semibold text-[#64748b]">lượt · {movement.activeStudentTotal} HV</span>
                </p>
              </div>
              {movement.activeByClass.length === 0 ? (
                <Empty>Chưa có học viên đang học.</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {movement.activeByClass.map((row) => (
                    <li key={row.classId} className="grid grid-cols-[110px_1fr] items-center gap-3 break-inside-avoid">
                      <span className="truncate text-[13px] font-bold text-[#0f1729]" title={row.className}>{row.classCode}</span>
                      <Bar value={row.count} max={maxActive} label={String(row.count)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              {[
                { label: "Số HS nhập học", rows: movement.newEnrollments.map((r) => ({ key: `${r.studentCode}-${r.date}`, name: r.fullName, code: r.studentCode, cls: r.classCode, date: r.date })), byClass: movement.newByClass },
                { label: "Số HS nghỉ học", rows: movement.left.map((r) => ({ key: `${r.studentCode}-${r.date}`, name: r.fullName, code: r.studentCode, cls: r.classCode, date: r.date })), byClass: movement.leftByClass },
              ].map((block) => (
                <div key={block.label} className="rounded-lg border border-[#e2e8f0] p-4 break-inside-avoid">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#334155]">{block.label}</p>
                    <p className="text-2xl font-black tabular-nums text-[#0f1729]">{block.rows.length}</p>
                  </div>
                  {block.byClass.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {block.byClass.map((row) => (
                        <span key={row.classId} className="rounded-md border border-[#e2e8f0] px-2 py-0.5 text-[12px] font-semibold text-[#0f1729]">
                          {row.classCode} <span className="tabular-nums text-[#64748b]">· {row.count}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {block.rows.length > 0 ? (
                    <ul className="mt-2 divide-y divide-[#f1f5f9] text-[12px]">
                      {block.rows.map((row) => (
                        <li key={row.key} className="flex justify-between gap-2 py-1">
                          <span className="text-[#0f1729]">
                            {row.name} <span className="font-mono text-[#64748b]">{row.code}</span>
                          </span>
                          <span className="whitespace-nowrap text-[#64748b]">{row.cls} · {dm(row.date)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[12px] text-[#94a3b8]">Không có.</p>
                  )}
                </div>
              ))}
              {movement.transfers.length > 0 ? (
                <div className="rounded-lg border border-[#e2e8f0] p-4 break-inside-avoid">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#334155]">Chuyển lớp</p>
                    <p className="text-2xl font-black tabular-nums text-[#0f1729]">{movement.transfers.length}</p>
                  </div>
                  <ul className="mt-2 divide-y divide-[#f1f5f9] text-[12px]">
                    {movement.transfers.map((row) => (
                      <li key={`${row.studentCode}-${row.date}`} className="flex justify-between gap-2 py-1">
                        <span>{row.fullName}</span>
                        <span className="whitespace-nowrap text-[#64748b]">{row.fromClass} → {row.toClass} · {dm(row.date)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* 3. THU – CHI */}
        <section className="mt-8 break-before-page">
          <SectionTitle index="3." title="Thu – chi" />
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#e2e8f0]">
            {[
              { label: "Tổng thu học phí", value: cashFlow.incomeTotal },
              { label: "Tổng chi", value: cashFlow.expenseTotal },
              { label: "Chênh lệch", value: cashFlow.incomeTotal - cashFlow.expenseTotal },
            ].map((item) => (
              <div key={item.label} className="bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">{item.label}</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-[#0f1729]">{money(item.value)}</p>
              </div>
            ))}
          </div>

          <SubTitle>Mục chi</SubTitle>
          {cashFlow.expenseRows.length === 0 ? (
            <Empty>{isWeek ? `Tuần ${range.weekNumber}` : `Tháng ${tuitionMonth}`}: không có khoản chi.</Empty>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
                <TableWrap>
                  <thead>
                    <tr>
                      <th className={TH}>Tuần → loại chi → chi tiết</th>
                      <th className={THR}>Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow.expenseByWeek.map((week) => (
                      <Fragment key={week.week}>
                        <tr className="bg-[#f1f5f9]">
                          <td className={`${TD} font-black`}>Tuần {week.week}</td>
                          <td className={`${TDR} font-black`}>{money(week.total)}</td>
                        </tr>
                        {week.categories.map((cat) => (
                          <Fragment key={cat.label}>
                            <tr>
                              <td className={`${TD} pl-5 font-semibold`}>{cat.label}</td>
                              <td className={`${TDR} font-semibold`}>{money(cat.amount)}</td>
                            </tr>
                            {cat.details.map((detail) => (
                              <tr key={detail.label}>
                                <td className={`${TD} pl-9 text-[#475569]`}>{detail.label}</td>
                                <td className={`${TDR} text-[#475569]`}>{money(detail.amount)}</td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                  <tbody>
                    <tr>
                      <td className={TFOOT}>Tổng cộng</td>
                      <td className={`${TFOOT} text-right tabular-nums`}>{money(cashFlow.expenseTotal)}</td>
                    </tr>
                  </tbody>
                </TableWrap>

                <div className="space-y-4">
                  <div className="rounded-lg border border-[#e2e8f0] p-4 break-inside-avoid">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#334155]">Theo loại chi</p>
                    <ul className="space-y-1.5">
                      {cashFlow.expenseByCategory.map((row) => (
                        <li key={row.label} className="grid grid-cols-[140px_1fr_90px] items-center gap-2 text-[13px]">
                          <span className="truncate font-semibold">{row.label}</span>
                          <Bar value={row.amount} max={maxExpenseCat} />
                          <span className="text-right tabular-nums">{money(row.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-[#e2e8f0] p-4 break-inside-avoid">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#334155]">Theo người thu/chi</p>
                    <ul className="divide-y divide-[#f1f5f9] text-[13px]">
                      {cashFlow.expenseByHandler.map((row) => (
                        <li key={row.label} className="flex justify-between py-1">
                          <span>{row.label}</span>
                          <span className="font-semibold tabular-nums">{money(row.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <TableWrap>
                  <thead>
                    <tr>
                      <th className={TH}>Ngày tháng</th>
                      <th className={TH}>Tên loại chi</th>
                      <th className={TH}>Chi tiết các loại</th>
                      <th className={TH}>Diễn giải</th>
                      <th className={THR}>Số tiền chi</th>
                      <th className={TH}>Người thu/chi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow.expenseRows.map((row, index) => (
                      <tr key={index} className="break-inside-avoid">
                        <td className={`${TD} whitespace-nowrap`}>{dmy(row.date)}</td>
                        <td className={TD}>{row.category}</td>
                        <td className={TD}>{row.categoryDetail}</td>
                        <td className={TD}>{row.description}</td>
                        <td className={TDR}>{money(row.amount)}</td>
                        <td className={TD}>{row.handler}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tbody>
                    <tr>
                      <td className={TFOOT} colSpan={4}>Tổng chi</td>
                      <td className={`${TFOOT} text-right tabular-nums`}>{money(cashFlow.expenseTotal)}</td>
                      <td className={TFOOT} />
                    </tr>
                  </tbody>
                </TableWrap>
              </div>
            </>
          )}

          <SubTitle>Mục thu</SubTitle>
          {cashFlow.incomeRows.length === 0 ? (
            <Empty>Không có phiếu thu học phí trong kỳ.</Empty>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr] print:grid-cols-2">
              <TableWrap>
                <thead>
                  <tr>
                    <th className={TH}>Tuần → người thu</th>
                    {cashFlow.incomeMethods.map((method) => (
                      <th key={method} className={THR}>{method}</th>
                    ))}
                    <th className={THR}>Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.incomeByWeek.map((week) => (
                    <Fragment key={week.week}>
                      <tr className="bg-[#f1f5f9]">
                        <td className={`${TD} font-black`}>Tuần {week.week}</td>
                        {cashFlow.incomeMethods.map((method) => (
                          <td key={method} className={`${TDR} font-black`}>{week.byMethod[method] ? money(week.byMethod[method]) : ""}</td>
                        ))}
                        <td className={`${TDR} font-black`}>{money(week.total)}</td>
                      </tr>
                      {week.receivers.map((receiver) => (
                        <tr key={receiver.receiver}>
                          <td className={`${TD} pl-5`}>{receiver.receiver}</td>
                          {cashFlow.incomeMethods.map((method) => (
                            <td key={method} className={TDR}>{receiver.byMethod[method] ? money(receiver.byMethod[method]) : ""}</td>
                          ))}
                          <td className={TDR}>{money(receiver.total)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                <tbody>
                  <tr>
                    <td className={TFOOT}>Tổng cộng</td>
                    {cashFlow.incomeMethods.map((method) => (
                      <td key={method} className={`${TFOOT} text-right tabular-nums`}>
                        {money(cashFlow.incomeByMethod.find((row) => row.label === method)?.amount ?? 0)}
                      </td>
                    ))}
                    <td className={`${TFOOT} text-right tabular-nums`}>{money(cashFlow.incomeTotal)}</td>
                  </tr>
                </tbody>
              </TableWrap>

              <div className="rounded-lg border border-[#e2e8f0] p-4 break-inside-avoid">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#334155]">Theo hình thức</p>
                <div className="flex h-3 overflow-hidden rounded-full bg-[#e2e8f0]">
                  {cashFlow.incomeByMethod.map((row, index) => (
                    <div
                      key={row.label}
                      className={index === 0 ? "bg-[#0f1729]" : index === 1 ? "bg-[#64748b]" : "bg-[#cbd5e1]"}
                      style={{ width: `${(row.amount / Math.max(1, cashFlow.incomeTotal)) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="mt-3 space-y-1 text-[13px]">
                  {cashFlow.incomeByMethod.map((row, index) => (
                    <li key={row.label} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-sm ${index === 0 ? "bg-[#0f1729]" : index === 1 ? "bg-[#64748b]" : "bg-[#cbd5e1]"}`} />
                        {row.label}
                      </span>
                      <span className="tabular-nums">
                        <strong>{money(row.amount)}</strong>{" "}
                        <span className="text-[#64748b]">({Math.round((row.amount / Math.max(1, cashFlow.incomeTotal)) * 100)}%)</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-[#64748b]">{cashFlow.incomeRows.length} phiếu thu học phí trong kỳ.</p>
              </div>
            </div>
          )}
          {cashFlow.otherIncome.length > 0 ? (
            <>
              <SubTitle count={cashFlow.otherIncome.length}>Thu khác (ngoài học phí)</SubTitle>
              <TableWrap>
                <thead>
                  <tr>
                    <th className={TH}>Ngày</th>
                    <th className={TH}>Loại thu</th>
                    <th className={TH}>Diễn giải</th>
                    <th className={THR}>Số tiền</th>
                    <th className={TH}>Người thu</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.otherIncome.map((row, index) => (
                    <tr key={index}>
                      <td className={`${TD} whitespace-nowrap`}>{dmy(row.date)}</td>
                      <td className={TD}>{row.category}</td>
                      <td className={TD}>{row.description}</td>
                      <td className={TDR}>{money(row.amount)}</td>
                      <td className={TD}>{row.handler}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </>
          ) : null}
        </section>

        {/* 4. DỰ KIẾN THU THÁNG SAU */}
        {forecast ? (
          <section className="mt-8 break-before-page">
            <SectionTitle
              index="4."
              title={`Dự kiến thu tháng ${monthLabel(forecast.periodName)}`}
              hint="Phiếu tháng sau đã lập thì lấy đúng phiếu; chưa lập thì ước tính theo lịch lớp, ví buổi học và số buổi khóa còn lại"
            />
            {forecast.rows.length === 0 ? (
              <Empty>Không có học viên đang học để dự kiến.</Empty>
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th className={TH}>Tên lớp</th>
                    <th className={TH}>Tên HV</th>
                    <th className={THR}>Số buổi</th>
                    <th className={THR}>Buổi dư trừ</th>
                    <th className={THR}>HP đầu kỳ</th>
                    <th className={THR}>Học bổng</th>
                    <th className={THR}>HP tháng</th>
                    <th className={THR}>Tiền giáo trình</th>
                    <th className={THR}>Tổng phải nộp</th>
                  </tr>
                  <tr>
                    <th className={`${TD} bg-[#0f1729] font-bold text-white`} colSpan={2}>
                      {forecast.totals.students} học viên
                    </th>
                    <th className={`${TD} bg-[#0f1729]`} colSpan={2} />
                    <th className={`${TDR} bg-[#0f1729] font-bold text-white`}>{money(forecast.totals.opening)}</th>
                    <th className={`${TD} bg-[#0f1729]`} />
                    <th className={`${TDR} bg-[#0f1729] font-bold text-white`}>{money(forecast.totals.tuition)}</th>
                    <th className={`${TDR} bg-[#0f1729] font-bold text-white`}>{money(forecast.totals.materials)}</th>
                    <th className={`${TDR} bg-[#0f1729] text-base font-black text-white`}>{money(forecast.totals.total)}</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastGroups.map(([classCode, rows]) => {
                    const subtotal = rows.reduce((s, r) => s + r.total, 0);
                    return (
                      <Fragment key={classCode}>
                        {rows.map((row, index) => (
                          <tr key={`${row.studentCode}-${index}`} className="break-inside-avoid">
                            <td className={`${TD} font-bold`}>{index === 0 ? classCode : ""}</td>
                            <td className={TD}>
                              {row.studentName}
                              <span className="font-mono text-[11px] text-[#64748b]">.{row.studentCode}</span>
                              {row.billingModel !== "PERIOD" ? <span className="ml-1 text-[11px] text-[#64748b]">(trọn khóa)</span> : null}
                            </td>
                            <td className={TDR}>{row.sessions || "—"}</td>
                            <td className={TDR}>{row.carried || "—"}</td>
                            <td className={TDR}><Amount value={row.opening} debt /></td>
                            <td className={TDR}>{row.scholarshipPct ? `${row.scholarshipPct}%` : "—"}</td>
                            <td className={TDR}>
                              <Amount value={row.tuition} />
                              {!row.fromCharge && row.tuition > 0 ? <span className="ml-0.5 text-[10px] text-[#94a3b8]">ước</span> : null}
                            </td>
                            <td className={TDR}>{row.materials ? money(row.materials) : "—"}</td>
                            <td className={TDR}><Amount value={row.total} debt strong /></td>
                          </tr>
                        ))}
                        <tr className="bg-[#f8fafc]">
                          <td className={`${TD} text-[12px] text-[#64748b]`} colSpan={8}>
                            Cộng lớp {classCode} · {rows.length} học viên
                          </td>
                          <td className={`${TDR} font-bold`}>{money(subtotal)}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </TableWrap>
            )}
          </section>
        ) : null}
      </article>
    </div>
  );
}
