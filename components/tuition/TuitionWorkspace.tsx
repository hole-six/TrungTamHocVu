"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import NewPeriodForm from "@/components/tuition/NewPeriodForm";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import FormGuide from "@/components/ui/FormGuide";
import { BILLING_PERIOD_STATUS_LABEL } from "@/lib/server/tuition-rules";
import {
  getCreateSnapshotButtonLabel,
  getLiveFallbackLabel,
  getReportEffectiveBadge,
  getReportModeLabel,
  getSnapshotTimestampLabel,
} from "@/lib/reporting-ui";
import { exportSectionsToExcel } from "@/lib/export-utils";

const DEBTOR_DETAIL_GUIDE_SECTIONS = [
  {
    title: "Drawer n�y d�ng d? l�m g�?",
    items: [
      "D�ng d? d?c m?t d�ng c�ng n? th?t k? tru?c khi g?i ph? huynh, thu ti?p ho?c m? h? so 360 c?a h?c vi�n.",
      "M?c ti�u l� cho ngu?i v?n h�nh hi?u v� sao h?c vi�n dang n?, n? ph?n n�o v� ph? huynh hi?n dang ? tr?ng th�i n�o.",
      "��y l� noi d?c ng? c?nh c�ng n?, kh�ng ph?i noi ch?nh c?u tr�c h?c ph� c?a h?c vi�n.",
    ],
    tone: "info" as const,
  },
  {
    title: "C�ch d?c c�c kh?i s? li?u",
    items: [
      "T?ng quan kho?n thu cho bi?t t?ng d�ng ph� n�y, d� thu bao nhi�u v� c�n n? bao nhi�u.",
      "H?c ph� bu?i h?c l� ph?n ti?n d?n t? s? bu?i th?c t? c?a k? d�.",
      "Gi�o tr�nh / ph�t sinh l� ph?n h?c li?u ho?c ph�t sinh th�m ngo�i h?c ph� bu?i h?c.",
      "T?n d?u k? l� s? n? ho?c s? du du?c k�o t? tru?c sang k? hi?n t?i.",
    ],
    tone: "success" as const,
  },
  {
    title: "H�nh d?ng d�ng sau khi d?c",
    items: [
      "N?u ch? c�n n? ti?n v� ph? huynh s?n s�ng n?p, d�ng n�t thu ti?n ngay trong drawer.",
      "N?u th?y c?u ph?n n? b?t thu?ng, m? h? so 360 d? ki?m tra chi ti?t hon tru?c khi thu.",
      "N?u ph? huynh ho?c portal dang thi?u th�ng tin, n�n x? l� ph?n li�n h? tru?c khi d?y m?nh thu ti?p.",
    ],
    tone: "warning" as const,
  },
];

type TuitionSummaryResponse = {
  meta: {
    requestedMode: "live" | "snapshot";
    effectiveMode: "live" | "snapshot";
    filters: {
      mode: "live" | "snapshot";
      periodKey: string | null;
    };
    snapshotReady: boolean;
    snapshotId: string | null;
    snapshotAt: string | null;
    periodKey: string | null;
  };
  periods: Array<{
    id: string;
    periodName: string;
    status: string;
    chargeCount: number;
    total: number;
    paid: number;
    debt: number;
  }>;
  totals: {
    totalBilled: number;
    totalPaid: number;
    totalDebt: number;
  };
  selectedPeriod: {
    id: string;
    periodName: string;
    status: string;
    debtors: Array<{
      chargeId: string;
      studentId: string;
      studentName: string;
      studentCode: string;
      leadCode: string | null;
      className: string;
      currentClassName: string;
      guardianName: string | null;
      guardianPhone: string | null;
      guardianPortalEmail: string | null;
      guardianPortalActive: boolean;
      sessionCount: number;
      absentCount: number;
      deductedCount: number;
      unitPrice: number;
      tuitionAmount: number;
      materialsAmount: number;
      openingBalance: number;
      totalAmount: number;
      paidAmount: number;
      remainingAmount: number;
      totalOutstanding: number;
    }>;
  } | null;
  latestSummary: {
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
  return `${n.toLocaleString("vi-VN")}d`;
}

function getDefaultPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type DebtorRow = {
  chargeId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  leadCode: string | null;
  className: string;
  currentClassName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianPortalEmail: string | null;
  guardianPortalActive: boolean;
  sessionCount: number;
  absentCount: number;
  deductedCount: number;
  unitPrice: number;
  tuitionAmount: number;
  materialsAmount: number;
  openingBalance: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  totalOutstanding: number;
};

type StudentFinanceSnapshot = {
  item: {
    payments: Array<{
      id: string;
      paymentNo: string;
      paidDate: string;
      amount: number;
      method: string | null;
      notes: string | null;
      status: string;
    }>;
  };
  outstanding: number;
};

export default function TuitionWorkspace({ canManageTuition }: { canManageTuition: boolean }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [data, setData] = useState<TuitionSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debtorKeyword, setDebtorKeyword] = useState("");
  const [debtorFilter, setDebtorFilter] = useState<"all" | "has_debt" | "missing_portal" | "inactive_portal" | "high_debt">("all");
  const [debtorTab, setDebtorTab] = useState<"period_debt" | "portfolio_debt" | "ready" | "missing_portal">("period_debt");
  const [debtorSort, setDebtorSort] = useState<"period_debt_desc" | "total_debt_desc" | "student_asc" | "class_asc" | "guardian_asc">("period_debt_desc");
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorRow | null>(null);
  const [studentFinance, setStudentFinance] = useState<StudentFinanceSnapshot | null>(null);
  const [studentFinanceLoading, setStudentFinanceLoading] = useState(false);

  const [mode, setMode] = useState<"live" | "snapshot">((searchParams.get("mode") as "live" | "snapshot") ?? "live");
  const [periodKey, setPeriodKey] = useState(searchParams.get("periodKey") ?? getDefaultPeriodKey());

  const queryString = useMemo(() => searchParams.toString(), [searchParams]);
  const board = useMemo(() => {
    if (!data) return null;
    const debtors = data.selectedPeriod?.debtors ?? [];
    const portalMissingCount = debtors.filter((item) => !item.guardianPortalEmail).length;
    const portalInactiveCount = debtors.filter((item) => item.guardianPortalEmail && !item.guardianPortalActive).length;
    const heavyDebtors = [...debtors].sort((a, b) => b.totalOutstanding - a.totalOutstanding).slice(0, 5);
    const debtByClass = [...data.latestSummary.classes].sort((a, b) => b.remainingAmount - a.remainingAmount);
    return {
      debtorCount: debtors.length,
      portalMissingCount,
      portalInactiveCount,
      heavyDebtors,
      debtByClass,
      classWithDebtCount: debtByClass.filter((item) => item.remainingAmount > 0).length,
      averageDebt: debtors.length ? Math.round(debtors.reduce((sum, item) => sum + item.totalOutstanding, 0) / debtors.length) : 0,
    };
  }, [data]);
  const selectedPeriodSummary = useMemo(() => {
    if (!data) return null;
    if (data.selectedPeriod?.id) {
      return data.periods.find((item) => item.id === data.selectedPeriod?.id) ?? null;
    }
    const key = data.meta.periodKey ?? periodKey;
    return data.periods.find((item) => item.periodName === key) ?? null;
  }, [data, periodKey]);
  const portfolioTotals = useMemo(() => {
    if (!data) return null;
    return {
      billed: data.totals.totalBilled,
      paid: data.totals.totalPaid,
      debt: data.totals.totalDebt,
      periodCount: data.periods.length,
    };
  }, [data]);
  const selectedDebtors = data?.selectedPeriod?.debtors ?? [];
  const debtorTabCounts = useMemo(() => {
    const base = selectedDebtors;
    return {
      period_debt: base.filter((item) => item.remainingAmount > 0).length,
      portfolio_debt: base.filter((item) => item.totalOutstanding > 0).length,
      ready: base.filter((item) => item.remainingAmount <= 0 && item.guardianPortalEmail && item.guardianPortalActive).length,
      missing_portal: base.filter((item) => !item.guardianPortalEmail || !item.guardianPortalActive).length,
    };
  }, [selectedDebtors]);
  const carryForwardCount = useMemo(
    () => selectedDebtors.filter((item) => item.remainingAmount > 0 && item.openingBalance > 0).length,
    [selectedDebtors],
  );
  const materialsPendingCount = useMemo(
    () => selectedDebtors.filter((item) => item.remainingAmount > 0 && item.materialsAmount > 0).length,
    [selectedDebtors],
  );
  const getDebtorReason = (item: (typeof selectedDebtors)[number]) => {
    const reasons: string[] = [];
    if (item.remainingAmount > 0) reasons.push("Chua thu d? k? n�y");
    if (item.totalOutstanding > item.remainingAmount) reasons.push("C� n? cu k�o sang");
    if (item.materialsAmount > 0) reasons.push("C� ti?n gi�o tr�nh / ph�t sinh");
    if (item.openingBalance > 0) reasons.push("C� t?n d?u k?");
    if (!item.guardianPortalEmail) reasons.push("Chua c� portal ph? huynh");
    else if (!item.guardianPortalActive) reasons.push("Portal ph? huynh chua k�ch ho?t");
    if (item.currentClassName !== item.className) reasons.push("L?p thu ph� kh�c l?p dang h?c");
    return reasons.length ? reasons.join(" � ") : "�� d? di?u ki?n, ch? c?n theo d�i";
  };
  const filteredDebtors = useMemo(() => {
    const keyword = debtorKeyword.trim().toLowerCase();
    const items = selectedDebtors.filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.studentName.toLowerCase().includes(keyword) ||
        item.studentCode.toLowerCase().includes(keyword) ||
        item.className.toLowerCase().includes(keyword) ||
        (item.guardianName ?? "").toLowerCase().includes(keyword) ||
        (item.guardianPhone ?? "").toLowerCase().includes(keyword);

      if (!matchesKeyword) return false;

      switch (debtorTab) {
        case "period_debt":
          if (!(item.remainingAmount > 0)) return false;
          break;
        case "portfolio_debt":
          if (!(item.totalOutstanding > 0)) return false;
          break;
        case "ready":
          if (!(item.remainingAmount <= 0 && item.guardianPortalEmail && item.guardianPortalActive)) return false;
          break;
        case "missing_portal":
          if (!(!item.guardianPortalEmail || !item.guardianPortalActive)) return false;
          break;
        default:
          break;
      }

      switch (debtorFilter) {
        case "missing_portal":
          return !item.guardianPortalEmail;
        case "inactive_portal":
          return Boolean(item.guardianPortalEmail) && !item.guardianPortalActive;
        case "high_debt":
          return item.totalOutstanding >= 1000000;
        case "has_debt":
          return item.remainingAmount > 0;
        default:
          return true;
      }
    });
    return [...items].sort((left, right) => {
      switch (debtorSort) {
        case "total_debt_desc":
          return right.totalOutstanding - left.totalOutstanding;
        case "student_asc":
          return left.studentName.localeCompare(right.studentName, "vi");
        case "class_asc":
          return left.className.localeCompare(right.className, "vi");
        case "guardian_asc":
          return (left.guardianName ?? "").localeCompare(right.guardianName ?? "", "vi");
        case "period_debt_desc":
        default:
          return right.remainingAmount - left.remainingAmount;
      }
    });
  }, [debtorFilter, debtorKeyword, debtorSort, debtorTab, selectedDebtors]);
  const collectionProgress = useMemo(() => {
    const billed = selectedPeriodSummary?.total ?? 0;
    const paid = selectedPeriodSummary?.paid ?? 0;
    const ratio = billed > 0 ? Math.min(100, Math.round((paid / billed) * 100)) : 0;
    return { billed, paid, ratio, debt: selectedPeriodSummary?.debt ?? 0 };
  }, [selectedPeriodSummary]);
  const feeComposition = useMemo(() => {
    return selectedDebtors.reduce(
      (sum, item) => {
        sum.tuitionAmount += item.tuitionAmount;
        sum.materialsAmount += item.materialsAmount;
        sum.openingBalance += item.openingBalance;
        sum.paidAmount += item.paidAmount;
        sum.remainingAmount += item.remainingAmount;
        return sum;
      },
      { tuitionAmount: 0, materialsAmount: 0, openingBalance: 0, paidAmount: 0, remainingAmount: 0 },
    );
  }, [selectedDebtors]);
  const drawerPayments = studentFinance?.item.payments.slice(0, 8) ?? [];

  useEffect(() => {
    setMode((searchParams.get("mode") as "live" | "snapshot") ?? "live");
    setPeriodKey(searchParams.get("periodKey") ?? getDefaultPeriodKey());
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/tuition/summary?${queryString}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Kh�ng t?i du?c d? li?u h?c ph�.");
        }
        return response.json();
      })
      .then((payload: TuitionSummaryResponse) => setData(payload))
      .catch((fetchError: Error) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [queryString]);

  useEffect(() => {
    if (!selectedDebtor?.studentId) {
      setStudentFinance(null);
      return;
    }

    const controller = new AbortController();
    setStudentFinanceLoading(true);

    fetch(`/api/students/${selectedDebtor.studentId}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Kh�ng t?i du?c l?ch s? thu ti?n.");
        }
        return response.json();
      })
      .then((payload: StudentFinanceSnapshot) => setStudentFinance(payload))
      .catch((fetchError: Error) => {
        if (fetchError.name !== "AbortError") setStudentFinance(null);
      })
      .finally(() => setStudentFinanceLoading(false));

    return () => controller.abort();
  }, [selectedDebtor?.studentId]);

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", mode);
    next.set("periodKey", periodKey);
    next.set("timePreset", mode === "snapshot" ? "current_period" : "this_month");
    router.push(`${pathname}?${next.toString()}`);
  };

  const createSnapshot = async () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", "snapshot");
    next.set("periodKey", periodKey);
    next.set("timePreset", "current_period");

    setCreatingSnapshot(true);
    setError(null);
    try {
      const response = await fetch(`/api/tuition/summary?${next.toString()}`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Kh�ng ch?t du?c d? li?u h?c ph� k? n�y.");
      router.push(`${pathname}?${next.toString()}`);
      router.refresh();
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Kh�ng ch?t du?c d? li?u h?c ph� k? n�y.");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    exportSectionsToExcel(
      [
        {
          title: "T?ng quan h?c ph�",
          columns: [
            { key: "metric", label: "Ch? s?" },
            { key: "value", label: "Gi� tr?" },
          ],
          rows: [
            { metric: "K? b�o c�o", value: data.meta.periodKey ?? periodKey },
            { metric: "Ch? d? d? li?u", value: data.meta.effectiveMode === "snapshot" ? "K? d� ch?t" : "D? li?u hi?n t?i" },
            { metric: "T?ng ph?i thu", value: formatVnd(data.totals.totalBilled) },
            { metric: "�� thu", value: formatVnd(data.totals.totalPaid) },
            { metric: "C�n n?", value: formatVnd(data.totals.totalDebt) },
          ],
        },
        {
          title: "Danh s�ch k? h?c ph�",
          columns: [
            { key: "periodName", label: "K?" },
            { key: "status", label: "Tr?ng th�i" },
            { key: "chargeCount", label: "S? kho?n thu" },
            { key: "total", label: "Ph?i thu" },
            { key: "paid", label: "�� thu" },
            { key: "debt", label: "C�n n?" },
          ],
          rows: data.periods.map((item) => ({
            ...item,
            total: formatVnd(item.total),
            paid: formatVnd(item.paid),
            debt: formatVnd(item.debt),
          })),
        },
        {
          title: "T?ng h?p h?c ph� theo l?p",
          columns: [
            { key: "classCode", label: "M� l?p" },
            { key: "className", label: "T�n l?p" },
            { key: "studentCount", label: "S? HV" },
            { key: "sessionCount", label: "S? bu?i" },
            { key: "openingBalance", label: "T?n d?u k?" },
            { key: "tuitionAmount", label: "H?c ph�" },
            { key: "materialsAmount", label: "Gi�o tr�nh" },
            { key: "billedAmount", label: "Ph?i thu" },
            { key: "collectedAmount", label: "�� thu" },
            { key: "remainingAmount", label: "C�n n?" },
          ],
          rows: data.latestSummary.classes.map((item) => ({
            ...item,
            openingBalance: formatVnd(item.openingBalance),
            tuitionAmount: formatVnd(item.tuitionAmount),
            materialsAmount: formatVnd(item.materialsAmount),
            billedAmount: formatVnd(item.billedAmount),
            collectedAmount: formatVnd(item.collectedAmount),
            remainingAmount: formatVnd(item.remainingAmount),
          })),
        },
        {
          title: "C�ng n? c?n x? l�",
          columns: [
            { key: "studentName", label: "H?c vi�n" },
            { key: "studentCode", label: "M� HV" },
            { key: "leadCode", label: "M� lead" },
            { key: "className", label: "L?p thu ph�" },
            { key: "guardianName", label: "Ph? huynh ch�nh" },
            { key: "guardianPhone", label: "S�T PH" },
            { key: "guardianPortalEmail", label: "Portal PH" },
            { key: "remainingAmount", label: "N? k? n�y" },
            { key: "totalOutstanding", label: "T?ng n?" },
          ],
          rows: (data.selectedPeriod?.debtors ?? []).map((item) => ({
            ...item,
            remainingAmount: formatVnd(item.remainingAmount),
            totalOutstanding: formatVnd(item.totalOutstanding),
          })),
        },
      ],
      `hoc-phi_${data.meta.periodKey ?? periodKey}_${data.meta.effectiveMode}`,
      "HocPhi",
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-[#0f1729]">Thu h?c ph�</h1>
            <p className="mt-1 text-xs sm:text-sm text-[#64748b]">Ch?n k?, xem d�ng ngu?i c�n ph?i thu v� thao t�c ngay tr�n m?t m�n.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageTuition ? <NewPeriodForm /> : null}
            {data?.selectedPeriod ? (
              <Link href={`/invoices/batch/${data.selectedPeriod.id}`} className="btn-360 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5">
                <span className="hidden sm:inline">Xu?t phi?u k? n�y</span>
                <span className="sm:hidden">Phi?u</span>
              </Link>
            ) : null}
            <button onClick={handleExport} disabled={!data} className="btn-ghost text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5">
              <span className="hidden sm:inline">Xu?t Excel</span>
              <span className="sm:hidden">Excel</span>
            </button>
            {canManageTuition ? (
              <button onClick={createSnapshot} disabled={creatingSnapshot} className="btn-ghost text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5">
                <span className="hidden sm:inline">{getCreateSnapshotButtonLabel("tuition", creatingSnapshot)}</span>
                <span className="sm:hidden">Ch?t</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[10px] sm:text-xs font-medium text-ink-muted48">Ngu?n d? li?u</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as "live" | "snapshot")} className="input h-10 sm:h-11 text-sm">
              <option value="live">{getReportModeLabel("live")}</option>
              <option value="snapshot">{getReportModeLabel("snapshot")}</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] sm:text-xs font-medium text-ink-muted48">K? c?n thu</span>
            <input type="month" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} className="input h-10 sm:h-11 text-sm" />
          </label>
          <div className="flex items-end">
            <button onClick={applyFilters} className="btn-primary w-full h-10 sm:h-11 text-sm sm:text-base">Xem d? li?u</button>
          </div>
        </div>

        {data?.meta ? (
          <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
            <span className={`badge ${data.meta.effectiveMode === "snapshot" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
              {getReportEffectiveBadge(data.meta.effectiveMode, "tuition")}
            </span>
            <span className="badge bg-ink/5 text-ink-muted80">K?: {data.meta.periodKey ?? periodKey}</span>
            {data.meta.snapshotAt ? (
              <span className="badge bg-emerald-100 text-emerald-700">{getSnapshotTimestampLabel("tuition", data.meta.snapshotAt)}</span>
            ) : (
              <span className="badge bg-ink/5 text-ink-muted80">{getLiveFallbackLabel("tuition")}</span>
            )}
          </div>
        ) : null}

        {error ? <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-red-600">{error}</p> : null}
      </div>

      {loading || !data ? (
        <div className="card p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-ink-muted48">�ang t?i d? li?u h?c ph�...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="stat-card p-4 sm:p-5">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-ink-muted48">Ph?i thu</p>
              <p className="mt-1 font-display text-xl sm:text-2xl font-semibold tracking-tight">{formatVnd(selectedPeriodSummary?.total ?? 0)}</p>
              <p className="mt-1 text-[10px] sm:text-xs text-ink-muted48">{selectedPeriodSummary?.chargeCount ?? 0} kho?n</p>
            </div>
            <div className="stat-card p-4 sm:p-5">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-ink-muted48">�� thu</p>
              <p className="mt-1 font-display text-xl sm:text-2xl font-semibold tracking-tight text-emerald-600">{formatVnd(selectedPeriodSummary?.paid ?? 0)}</p>
              <p className="mt-1 text-[10px] sm:text-xs text-ink-muted48">K? xem</p>
            </div>
            <div className="stat-card-accent p-4 sm:p-5">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-white/70">C�n n?</p>
              <p className="mt-1 font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">{formatVnd(selectedPeriodSummary?.debt ?? 0)}</p>
              <p className="mt-1 text-[10px] sm:text-xs text-white/75">X? l� tru?c</p>
            </div>
            <div className="stat-card p-4 sm:p-5">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-ink-muted48">HV c?n thu</p>
              <p className="mt-1 font-display text-xl sm:text-2xl font-semibold tracking-tight">{board?.debtorCount ?? 0}</p>
              <p className="mt-1 text-[10px] sm:text-xs text-ink-muted48 truncate">K? {data.selectedPeriod?.periodName ?? data.meta.periodKey ?? periodKey}</p>
            </div>
            <div className="stat-card p-4 sm:p-5">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-ink-muted48">N? cu/s�ch</p>
              <p className="mt-1 font-display text-xl sm:text-2xl font-semibold tracking-tight">{carryForwardCount + materialsPendingCount}</p>
              <p className="mt-1 text-[10px] sm:text-xs text-ink-muted48">{carryForwardCount} cu � {materialsPendingCount} s�ch</p>
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-display font-semibold tracking-tight">Ti?n d? k? {selectedPeriodSummary?.periodName ?? data.meta.periodKey ?? periodKey}</h2>
                <p className="mt-1 text-xs sm:text-sm text-ink-muted48">�� thu bao nhi�u v� c�n bao nhi�u c?n x? l�.</p>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                <span className="font-semibold text-ink">{collectionProgress.ratio}% ho�n th�nh</span>
                <span className="hidden sm:inline ml-2 text-ink-muted48">� �� thu {formatVnd(collectionProgress.paid)} / {formatVnd(collectionProgress.billed)}</span>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <div className="h-3 sm:h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#22c55e_0%,#16a34a_50%,#0ea5e9_100%)] transition-all"
                  style={{ width: `${collectionProgress.ratio}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-3">
                <div className="rounded-xl sm:rounded-2xl border border-hairline bg-canvas-parchment/50 p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">�� thu</p>
                  <p className="mt-1 sm:mt-2 text-base sm:text-lg font-semibold text-emerald-600">{formatVnd(collectionProgress.paid)}</p>
                </div>
                <div className="rounded-xl sm:rounded-2xl border border-hairline bg-canvas-parchment/50 p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">C�n n?</p>
                  <p className="mt-1 sm:mt-2 text-base sm:text-lg font-semibold text-red-600">{formatVnd(collectionProgress.debt)}</p>
                </div>
                <div className="rounded-xl sm:rounded-2xl border border-hairline bg-canvas-parchment/50 p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Ph?i thu k? n�y</p>
                  <p className="mt-1 sm:mt-2 text-base sm:text-lg font-semibold text-ink">{formatVnd(collectionProgress.billed)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-display font-semibold tracking-tight">Ti?n trong k? n�y g?m</h2>
                <p className="mt-1 text-xs sm:text-sm text-ink-muted48">T�ch ri�ng h?c ph�, s�ch v� n? cu d? thu cho d�ng.</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5">
              <div className="rounded-xl sm:rounded-2xl border border-hairline bg-canvas-parchment/50 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">HP bu?i h?c</p>
                <p className="mt-1 sm:mt-2 text-sm sm:text-base md:text-lg font-semibold text-ink">{formatVnd(feeComposition.tuitionAmount)}</p>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-hairline bg-canvas-parchment/50 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">GT/ph�t sinh</p>
                <p className="mt-1 sm:mt-2 text-sm sm:text-base md:text-lg font-semibold text-ink">{formatVnd(feeComposition.materialsAmount)}</p>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-hairline bg-canvas-parchment/50 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">T?n d?u k?</p>
                <p className="mt-1 sm:mt-2 text-sm sm:text-base md:text-lg font-semibold text-ink">{formatVnd(feeComposition.openingBalance)}</p>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-hairline bg-canvas-parchment/50 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">�� thu</p>
                <p className="mt-1 sm:mt-2 text-sm sm:text-base md:text-lg font-semibold text-emerald-600">{formatVnd(feeComposition.paidAmount)}</p>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-hairline bg-canvas-parchment/50 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">C�n n?</p>
                <p className="mt-1 sm:mt-2 text-sm sm:text-base md:text-lg font-semibold text-red-600">{formatVnd(feeComposition.remainingAmount)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
              <div className="card overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold tracking-tight">T?ng h?p theo l?p</h2>
                    <p className="mt-1 text-sm text-ink-muted48">Nh�n l?p n�o c�n n? d? x? l� nhanh.</p>
                  </div>
                </div>
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                    <tr>
                      <th className="py-2 font-medium">L?p</th>
                      <th className="py-2 font-medium">HV</th>
                      <th className="py-2 font-medium">Bu?i</th>
                      <th className="py-2 font-medium">T?n d?u</th>
                      <th className="py-2 font-medium">H?c ph� + ph�t sinh</th>
                      <th className="py-2 font-medium">�� thu</th>
                      <th className="py-2 font-medium">C�n n?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(board?.debtByClass ?? data.latestSummary.classes).map((item) => (
                      <tr key={`${item.classCode}-${item.className}`} className="border-b border-hairline last:border-0">
                        <td className="py-2 font-medium">
                          <div>{item.className}</div>
                          <div className="text-xs text-ink-muted48">{item.classCode}</div>
                        </td>
                        <td className="py-2 text-ink-muted80">{item.studentCount}</td>
                        <td className="py-2 text-ink-muted80">{item.sessionCount}</td>
                        <td className="py-2 text-ink-muted80">{formatVnd(item.openingBalance)}</td>
                        <td className="py-2 text-ink-muted80">{formatVnd(item.billedAmount)}</td>
                        <td className="py-2 text-emerald-600 font-medium">{formatVnd(item.collectedAmount)}</td>
                        <td className={`py-2 font-medium ${item.remainingAmount > 0 ? "text-red-600" : "text-ink-muted80"}`}>{formatVnd(item.remainingAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Danh s�ch c?n thu</h2>
                <p className="mt-1 text-sm text-ink-muted48">
                      Ch? gi? d�ng ngu?i dang c?n thao t�c trong k? {data.selectedPeriod?.periodName ?? data.meta.periodKey ?? periodKey}.
                </p>
              </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-ink-muted48">T�m h?c vi�n / l?p / ph? huynh</span>
                    <input
                      className="input"
                      value={debtorKeyword}
                      onChange={(event) => setDebtorKeyword(event.target.value)}
                      placeholder="Nh?p t�n h?c vi�n, m� HV, l?p, ph? huynh, s? di?n tho?i..."
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-ink-muted48">L?c</span>
                    <select className="input" value={debtorFilter} onChange={(event) => setDebtorFilter(event.target.value as typeof debtorFilter)}>
                      <option value="all">T?t c? dang hi?n</option>
                      <option value="has_debt">Ch? c�n n?</option>
                      <option value="missing_portal">Thi?u portal</option>
                      <option value="inactive_portal">Portal chua k�ch ho?t</option>
                      <option value="high_debt">N? cao t? 1.000.000d</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-ink-muted48">S?p x?p</span>
                    <select className="input" value={debtorSort} onChange={(event) => setDebtorSort(event.target.value as typeof debtorSort)}>
                      <option value="period_debt_desc">N? k? n�y gi?m d?n</option>
                      <option value="total_debt_desc">T?ng n? gi?m d?n</option>
                      <option value="student_asc">T�n h?c vi�n A ? Z</option>
                      <option value="class_asc">T�n l?p A ? Z</option>
                      <option value="guardian_asc">T�n ph? huynh A ? Z</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[ 
                    { key: "period_debt", label: "N? k? n�y", count: debtorTabCounts.period_debt },
                    { key: "portfolio_debt", label: "C�n n?", count: debtorTabCounts.portfolio_debt },
                    { key: "ready", label: "�� d?", count: debtorTabCounts.ready },
                    { key: "missing_portal", label: "Portal", count: debtorTabCounts.missing_portal },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setDebtorTab(tab.key as typeof debtorTab)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        debtorTab === tab.key ? "bg-primary text-white shadow-sm" : "border border-hairline bg-white text-ink-muted80 hover:border-primary/30 hover:text-primary"
                      }`}
                    >
                      {tab.label} {tab.count}
                    </button>
                  ))}
                </div>

                <div className="mt-3 rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-sm text-ink-muted80">
                  <p>
                    <strong className="text-ink">{filteredDebtors.length}</strong> h?c vi�n kh?p � dang xem{" "}
                    <strong className="text-ink">{debtorTab === "period_debt" ? "N? k? n�y" : debtorTab === "portfolio_debt" ? "C�n n?" : debtorTab === "ready" ? "�� d?" : "Portal"}</strong>
                  </p>
                </div>

                <div className="mt-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <table className="w-full min-w-[1080px] text-left text-sm">
                    <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted48">
                      <tr>
                        <th className="py-3 font-medium">H?c vi�n / l?p</th>
                        <th className="py-3 font-medium">Ng? c?nh</th>
                        <th className="py-3 font-medium">N? k? n�y</th>
                        <th className="py-3 font-medium">T?ng n?</th>
                        <th className="py-3 font-medium">Portal</th>
                        <th className="py-3 font-medium text-right">Thao t�c</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDebtors.map((debtor) => (
                        <tr key={debtor.chargeId} className="border-b border-hairline last:border-0">
                          <td className="py-3 align-top">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/students/${debtor.studentId}`} className="font-medium text-primary hover:underline">
                                {debtor.studentName}
                              </Link>
                              <span className="text-xs text-ink-muted48">({debtor.studentCode})</span>
                            </div>
                            <p className="font-medium text-ink">{debtor.className}</p>
                            <p className="mt-1 text-xs text-ink-muted48">{debtor.guardianName ?? "Chua g?n PH"} � {debtor.guardianPhone ?? "Chua c� S�T"}</p>
                          </td>
                          <td className="py-3 align-top">
                            <p className="text-sm text-ink">{getDebtorReason(debtor)}</p>
                            <p className="mt-1 text-xs text-ink-muted48">
                              HP {formatVnd(debtor.tuitionAmount)} � S�ch {formatVnd(debtor.materialsAmount)} � N? cu {formatVnd(debtor.openingBalance)}
                            </p>
                          </td>
                          <td className="py-3 align-top">
                            <p className="font-semibold text-red-600">{formatVnd(debtor.remainingAmount)}</p>
                            <p className="mt-1 text-xs text-ink-muted48">�� thu {formatVnd(debtor.paidAmount)}</p>
                          </td>
                          <td className="py-3 align-top">
                            <p className="font-medium text-ink">{formatVnd(debtor.totalOutstanding)}</p>
                            {debtor.currentClassName !== debtor.className ? <p className="mt-1 text-xs text-sky-700">�ang h?c: {debtor.currentClassName}</p> : null}
                          </td>
                          <td className="py-3 align-top">
                            {!debtor.guardianPortalEmail ? (
                              <span className="badge bg-amber-100 text-amber-700">Thi?u portal</span>
                            ) : debtor.guardianPortalActive ? (
                              <span className="badge bg-emerald-100 text-emerald-700">Portal ho?t d?ng</span>
                            ) : (
                              <span className="badge bg-amber-100 text-amber-700">Portal chua k�ch ho?t</span>
                            )}
                            {debtor.guardianPortalEmail ? <p className="mt-1 text-xs text-ink-muted48">{debtor.guardianPortalEmail}</p> : null}
                          </td>
                          <td className="py-3 align-top">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button type="button" onClick={() => setSelectedDebtor(debtor)} className="btn-ghost">
                                Chi ti?t
                              </button>
                              {canManageTuition ? <QuickPaymentButton studentId={debtor.studentId} suggestedAmount={debtor.remainingAmount} /> : null}
                              <Link href={`/students/${debtor.studentId}?tab=hocphi`} className="btn-360">
                                H? so ph�
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(data.selectedPeriod?.debtors.length ?? 0) === 0 ? (
                    <p className="text-sm text-ink-muted48">Kh�ng c� c�ng n? m? trong k? dang xem.</p>
                  ) : null}
                  {(data.selectedPeriod?.debtors.length ?? 0) > 0 && filteredDebtors.length === 0 ? (
                    <p className="pt-4 text-sm text-ink-muted48">Kh�ng c� h?c vi�n n�o kh?p b? l?c dang ch?n.</p>
                  ) : null}
                </div>
              </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>K?</th>
                  <th>S? kho?n thu</th>
                  <th>Ph?i thu</th>
                  <th>�� thu</th>
                  <th>C�n n?</th>
                  <th>Tr?ng th�i</th>
                </tr>
              </thead>
              <tbody>
                {data.periods.map((period) => (
                  <tr key={period.id}>
                    <td>
                      <Link href={`/tuition/${period.id}`} className="font-medium text-primary hover:underline">
                        {period.periodName}
                      </Link>
                    </td>
                    <td className="text-ink-muted80">{period.chargeCount}</td>
                    <td className="text-ink-muted80">{formatVnd(period.total)}</td>
                    <td className="text-emerald-600 font-medium">{formatVnd(period.paid)}</td>
                    <td className={`font-medium ${period.debt > 0 ? "text-red-600" : "text-ink-muted80"}`}>{formatVnd(period.debt)}</td>
                    <td><span className="badge-gray">{BILLING_PERIOD_STATUS_LABEL[period.status] ?? period.status}</span></td>
                  </tr>
                ))}
                {data.periods.length === 0 && (
                  <tr className="table-empty">
                    <td colSpan={6}>
                      <div className="empty-state">
                        <p className="empty-state-title">Chua c� k? thu n�o</p>
                        <p className="empty-state-desc">T?o k? thu d? b?t d?u v?n h�nh h?c ph� chu?n theo k?.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <ResponsiveDrawer 
            open={Boolean(selectedDebtor)}
            onClose={() => setSelectedDebtor(null)}
            widthClassName="max-w-3xl"
            title={selectedDebtor ? `Chi ti?t c�ng n? � ${selectedDebtor.studentName}` : "Chi ti?t c�ng n?"}
            description={
              selectedDebtor
                ? "Xem d?y d? c?u ph?n ph�, l� do c�ng n?, t�nh tr?ng ph? huynh v� c�c phi?u thu g?n nh?t c?a h?c vi�n n�y."
                : undefined
            }
            guide={<FormGuide title="Hu?ng d?n d?c chi ti?t c�ng n?" summary="Drawer n�y gi�p ngu?i v?n h�nh hi?u r� m?t h?c vi�n dang n? v� l� do g�, n? ? c?u ph?n n�o v� bu?c ti?p theo n�n l� thu ti?p, g?i ph? huynh hay m? h? so 360." sections={DEBTOR_DETAIL_GUIDE_SECTIONS} position="inline" />}
          >
            {selectedDebtor ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">H?c vi�n / l?p thu ph�</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{selectedDebtor.studentName}</p>
                    <p className="mt-1 text-sm text-ink-muted48">
                      {selectedDebtor.studentCode} {selectedDebtor.leadCode ? `� Lead ${selectedDebtor.leadCode}` : ""}
                    </p>
                    <p className="mt-3 text-sm text-ink">
                      L?p thu ph�: <strong>{selectedDebtor.className}</strong>
                    </p>
                    <p className="mt-1 text-sm text-ink-muted48">
                      {selectedDebtor.currentClassName !== selectedDebtor.className
                        ? `�ang h?c th?c t?: ${selectedDebtor.currentClassName}`
                        : "L?p thu ph� tr�ng l?p dang h?c"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-hairline bg-canvas-parchment/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Ph? huynh / portal</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{selectedDebtor.guardianName ?? "Chua g?n ph? huynh ch�nh"}</p>
                    <p className="mt-1 text-sm text-ink-muted48">{selectedDebtor.guardianPhone ?? "Chua c� s? di?n tho?i"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!selectedDebtor.guardianPortalEmail ? (
                        <span className="badge bg-amber-100 text-amber-700">Thi?u portal</span>
                      ) : selectedDebtor.guardianPortalActive ? (
                        <span className="badge bg-emerald-100 text-emerald-700">Portal ho?t d?ng</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-700">Portal chua k�ch ho?t</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-ink-muted48">{selectedDebtor.guardianPortalEmail ?? "Chua c� email portal"}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#dbe7ff] bg-[#f8fbff] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">T?ng quan kho?n thu c?a d�ng n�y</p>
                      <p className="mt-2 text-2xl font-semibold text-ink">{formatVnd(selectedDebtor.totalAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-600">�� thu {formatVnd(selectedDebtor.paidAmount)}</p>
                      <p className="mt-1 text-lg font-semibold text-red-600">C�n n? {formatVnd(selectedDebtor.remainingAmount)}</p>
                      <p className="mt-1 text-xs text-ink-muted48">T?ng n? h?c vi�n: {formatVnd(selectedDebtor.totalOutstanding)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-hairline p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">H?c ph� bu?i h?c</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{formatVnd(selectedDebtor.tuitionAmount)}</p>
                    <p className="mt-2 text-xs text-ink-muted48">
                      {selectedDebtor.sessionCount} bu?i � ngh? {selectedDebtor.absentCount} � tr? {selectedDebtor.deductedCount} � don gi� {formatVnd(selectedDebtor.unitPrice)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-hairline p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Gi�o tr�nh / ph�t sinh</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{formatVnd(selectedDebtor.materialsAmount)}</p>
                    <p className="mt-2 text-xs text-ink-muted48">Kho?n n�y thu?ng d?n t? gi�o tr�nh ho?c ph�t sinh h?c li?u trong k?.</p>
                  </div>
                  <div className="rounded-2xl border border-hairline p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">T?n d?u k?</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{formatVnd(selectedDebtor.openingBalance)}</p>
                    <p className="mt-2 text-xs text-ink-muted48">��y l� ph?n n? cu ho?c s? du du?c k�o sang d?u k? hi?n t?i.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-hairline p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">K?t lu?n v?n h�nh cho d�ng n�y</p>
                  <p className="mt-2 text-sm leading-7 text-ink">{getDebtorReason(selectedDebtor)}</p>
                </div>

                <div className="rounded-2xl border border-hairline p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">Phi?u thu g?n nh?t c?a h?c vi�n</p>
                      <p className="mt-1 text-xs text-ink-muted48">Hi?n th? c�c phi?u thu m?i nh?t d? d?i chi?u nhanh tru?c khi g?i ph? huynh ho?c thu ti?p.</p>
                    </div>
                    {studentFinanceLoading ? <span className="text-xs text-ink-muted48">�ang t?i...</span> : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {drawerPayments.map((payment) => (
                      <div key={payment.id} className="rounded-2xl border border-hairline bg-canvas-parchment/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">{payment.paymentNo}</p>
                            <p className="mt-1 text-xs text-ink-muted48">
                              {new Date(payment.paidDate).toLocaleDateString("vi-VN")} � {payment.method ?? "Chua ghi h�nh th?c"} � {payment.status}
                            </p>
                            {payment.notes ? <p className="mt-2 text-xs text-ink-muted48">{payment.notes}</p> : null}
                          </div>
                          <p className="text-sm font-semibold text-ink">{formatVnd(payment.amount)}</p>
                        </div>
                      </div>
                    ))}
                    {!studentFinanceLoading && drawerPayments.length === 0 ? <p className="text-sm text-ink-muted48">Chua c� phi?u thu n�o c?a h?c vi�n n�y.</p> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline pt-4">
                  {canManageTuition ? <QuickPaymentButton studentId={selectedDebtor.studentId} suggestedAmount={selectedDebtor.remainingAmount} /> : null}
                  <Link href={`/students/${selectedDebtor.studentId}`} className="btn-360">
                    M? h? so 360
                  </Link>
                  <button type="button" onClick={() => setSelectedDebtor(null)} className="btn-ghost">
                    ��ng
                  </button>
                </div>
              </div>
            ) : null}
          </ResponsiveDrawer>
        </>
      )}
    </div>
  );
}
