"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import InvoiceDocument, { type InvoiceChargeData, type PaymentProfileData } from "@/components/tuition/InvoiceDocument";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import DetailTabs from "@/components/ui/DetailTabs";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { chargeOwnDueAmount } from "@/lib/server/tuition-rules";
import { formatVnd } from "@/lib/export-utils";
import StudentLink from "@/components/students/StudentLink";
import BackButton from "@/components/ui/BackButton";

type BatchCharge = InvoiceChargeData & {
  enrollmentId: string | null;
  currentEnrollmentBillingModel: string;
  classEndedThisPeriod: boolean;
};

const BILLING_MODEL_LABEL: Record<string, string> = {
  PERIOD: "Theo thÃ¡ng",
  COURSE: "Trá»n khÃ³a",
};

function getEffectiveBillingModel(charge: BatchCharge) {
  return charge.currentEnrollmentBillingModel || charge.billingModel;
}

function getDownloadFileName(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  return plainMatch?.[1] ?? fallback;
}

function hasBillingMismatch(charge: BatchCharge) {
  return Boolean(charge.currentEnrollmentBillingModel) && charge.currentEnrollmentBillingModel !== charge.billingModel;
}

// TÃ­nh toÃ n bá»™ giÃ¡ trá»‹ dáº«n xuáº¥t cá»§a 1 charge (Ä‘Ã£ thu, cÃ²n ná»£, kiá»ƒu thu hiá»‡u lá»±c,
// lá»‡ch kiá»ƒu thu) Má»˜T Láº¦N duy nháº¥t â€” dÃ¹ng chung cho cáº£ báº£n desktop vÃ  báº£n mobile
// bÃªn dÆ°á»›i, Ä‘á»ƒ 2 layout khÃ´ng bao giá» tÃ­nh lá»‡ch nhau do sá»­a 1 nÆ¡i quÃªn sá»­a nÆ¡i kia.
function deriveChargeView(charge: BatchCharge) {
  const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
  const meta = getChargeCollectionMeta(chargeOwnDueAmount(charge), paid);
  const billingMismatch = hasBillingMismatch(charge);
  const effectiveBillingModel = getEffectiveBillingModel(charge);
  return { paid, meta, remaining: meta.remainingAmount, billingMismatch, effectiveBillingModel };
}

function getChargeCollectionMeta(totalAmount: number, paidAmount: number) {
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);

  if (paidAmount <= 0) {
    return {
      remainingAmount,
      paymentLabel: "ChÆ°a thu",
      paymentClassName: "bg-[#f0f3f7] text-[#5f6f84]",
      regenLabel: "ÄÆ°á»£c sinh láº¡i",
      regenClassName: "bg-[#e8f8f1] text-[#149b66]",
      regenHint: "ChÆ°a cÃ³ tiá»n thu thá»±c táº¿ nÃªn cÃ³ thá»ƒ Ä‘á»•i kiá»ƒu thu hoáº·c sinh láº¡i phiáº¿u.",
      rowClassName: "bg-[#f1fbf7] hover:bg-[#ecfaf4]",
    };
  }

  if (paidAmount < totalAmount) {
    return {
      remainingAmount,
      paymentLabel: "ÄÃ£ thu má»™t pháº§n",
      paymentClassName: "bg-[#fff8e8] text-[#c76700]",
      regenLabel: "KhÃ³a sinh láº¡i",
      regenClassName: "bg-red-100 text-red-700",
      regenHint: `ÄÃ£ thu ${formatVnd(paidAmount)} nÃªn khÃ´ng Ä‘Æ°á»£c sinh Ä‘Ã¨ Ä‘á»ƒ trÃ¡nh lá»‡ch cÃ´ng ná»£.`,
      rowClassName: "bg-[#fff8e8] hover:bg-[#fff4d6]",
    };
  }

  return {
    remainingAmount,
    paymentLabel: "ÄÃ£ thu háº¿t",
    paymentClassName: "bg-[#e8f8f1] text-[#149b66]",
    regenLabel: "KhÃ³a sinh láº¡i",
    regenClassName: "bg-red-100 text-red-700",
    regenHint: "Phiáº¿u nÃ y Ä‘Ã£ thu xong nÃªn khÃ´ng Ä‘Æ°á»£c sinh láº¡i.",
    rowClassName: "bg-[#e8f8f1] hover:bg-[#ecfaf4]",
  };
}

// Khá»‘i nÃºt thao tÃ¡c cá»§a 1 dÃ²ng charge â€” dÃ¹ng chung cho cáº£ báº£n báº£ng desktop vÃ  báº£n
// card mobile bÃªn dÆ°á»›i, trÃ¡nh copy tay 2 láº§n cÃ¹ng 1 logic quan trá»ng (Ä‘á»•i kiá»ƒu thu,
// táº£i phiáº¿u, thu nhanh).
function ChargeActions({
  charge,
  meta,
  remaining,
  billingMismatch,
  paid,
  canManageTuition,
  switchingKey,
  onRequestSwitch,
}: {
  charge: BatchCharge;
  meta: ReturnType<typeof getChargeCollectionMeta>;
  remaining: number;
  billingMismatch: boolean;
  paid: number;
  canManageTuition: boolean;
  switchingKey: string | null;
  onRequestSwitch: (charge: BatchCharge, nextBillingModel: "PERIOD" | "COURSE") => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <StudentLink
          studentId={charge.student.id ?? ""}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[#b7dff8] bg-[#f6fcff] px-4 text-sm font-semibold text-[#077dc8] transition hover:border-[#8fcdf3] hover:bg-[#eaf7ff]"
        >
          Há»c phÃ­ HV
        </StudentLink>
        {remaining > 0 ? (
          <a
            href={`/api/invoices/${charge.id}/pdf`}
            className="inline-flex h-10 items-center justify-center rounded-full border border-[#dfe8f2] bg-white px-4 text-sm font-semibold text-[#6f7f94] transition hover:border-[#cad8e8] hover:text-primary"
          >
            Táº£i phiáº¿u
          </a>
        ) : null}
        {canManageTuition && remaining > 0 ? <QuickPaymentButton studentId={charge.student.id ?? ""} suggestedAmount={remaining} /> : null}
      </div>
      {billingMismatch && paid <= 0 ? (
        <p className="mt-2 max-w-[240px] text-xs leading-5 text-amber-800">
          Phiáº¿u hiá»‡n táº¡i Ä‘ang lÃ  {BILLING_MODEL_LABEL[charge.billingModel] ?? charge.billingModel}, cáº§n lÃ m má»›i trÆ°á»›c khi in.
        </p>
      ) : null}
      {canManageTuition && paid <= 0 && charge.enrollmentId ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {charge.currentEnrollmentBillingModel !== "PERIOD" ? (
            <button
              type="button"
              onClick={() => onRequestSwitch(charge, "PERIOD")}
              disabled={switchingKey === `${charge.id}:PERIOD`}
              className="rounded-full border border-[#b7dff8] bg-[#f6fcff] px-3 py-1 text-xs font-semibold text-[#077dc8] transition hover:border-[#8fcdf3] hover:bg-[#eaf7ff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {switchingKey === `${charge.id}:PERIOD` ? "Äang chuyá»ƒn..." : "Chuyá»ƒn thu thÃ¡ng"}
            </button>
          ) : null}
          {charge.currentEnrollmentBillingModel !== "COURSE" ? (
            <button
              type="button"
              onClick={() => onRequestSwitch(charge, "COURSE")}
              disabled={switchingKey === `${charge.id}:COURSE`}
              className="rounded-full border border-[#d8ccff] bg-[#f3efff] px-3 py-1 text-xs font-semibold text-[#7b4df5] transition hover:border-[#c3aeff] hover:bg-[#ebe3ff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {switchingKey === `${charge.id}:COURSE` ? "Äang chuyá»ƒn..." : "Chuyá»ƒn thu khÃ³a"}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// Badge kiá»ƒu thu + tráº¡ng thÃ¡i thu â€” dÃ¹ng chung cho cáº£ báº£ng desktop vÃ  card mobile.
function ChargeStatusBadges({ effectiveBillingModel, meta, billingMismatch }: { effectiveBillingModel: string; meta: ReturnType<typeof getChargeCollectionMeta>; billingMismatch: boolean }) {
  return (
    <div className="space-y-2">
      <span className={`badge ${effectiveBillingModel === "COURSE" ? "bg-[#f3efff] text-[#7b4df5]" : "bg-[#e5f4ff] text-[#0a80c8]"}`}>
        {BILLING_MODEL_LABEL[effectiveBillingModel] ?? effectiveBillingModel}
      </span>
      <span className={`badge ${meta.paymentClassName}`}>{meta.paymentLabel}</span>
      {billingMismatch ? <span className="badge bg-[#fff8e8] text-[#c76700]">Phiáº¿u lá»‡ch kiá»ƒu thu</span> : null}
    </div>
  );
}

export default function BatchInvoiceView({
  periodName,
  periodId,
  branchId,
  paymentProfile: initialPaymentProfile,
  charges,
  canManageTuition,
  embedded = false,
}: {
  periodName: string;
  periodId: string;
  branchId: string;
  paymentProfile: PaymentProfileData | null;
  charges: BatchCharge[];
  canManageTuition: boolean;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        charges
          .filter((charge) => {
            const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
            return !hasBillingMismatch(charge) && chargeOwnDueAmount(charge) - paid > 0;
          })
          .map((charge) => charge.id),
      ),
  );
  const [onlyEndedCourses, setOnlyEndedCourses] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [billingModelFilter, setBillingModelFilter] = useState<"ALL" | "PERIOD" | "COURSE">("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<"ALL" | "UNPAID" | "SELECTED">("ALL");
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
  const [exportMode, setExportMode] = useState<"MERGED" | "SEPARATE">("MERGED");
  const [paymentProfile, setPaymentProfile] = useState<PaymentProfileData>({
    bankName: initialPaymentProfile?.bankName ?? null,
    accountNumber: initialPaymentProfile?.accountNumber ?? null,
    accountHolder: initialPaymentProfile?.accountHolder ?? null,
    qrImageData: initialPaymentProfile?.qrImageData ?? null,
    paymentInstruction: initialPaymentProfile?.paymentInstruction ?? null,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [switchingKey, setSwitchingKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{ charge: BatchCharge; nextBillingModel: "PERIOD" | "COURSE" } | null>(null);
  const [exporting, setExporting] = useState(false);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const charge of charges) {
      const name = charge.class.className.trim();
      if (name) map.set(name, name);
    }
    return [...map.values()].sort((left, right) => left.localeCompare(right, "vi"));
  }, [charges]);

  const visibleCharges = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return charges.filter((charge) => {
      const effectiveBillingModel = getEffectiveBillingModel(charge);
      const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
      const remaining = Math.max(chargeOwnDueAmount(charge) - paid, 0);

      if (onlyEndedCourses && charge.billingModel === "COURSE" && !charge.classEndedThisPeriod) return false;
      if (billingModelFilter !== "ALL" && effectiveBillingModel !== billingModelFilter) return false;
      if (classFilter && charge.class.className !== classFilter) return false;

      if (visibilityFilter === "UNPAID" && remaining <= 0) return false;
      if (visibilityFilter === "SELECTED" && !selected.has(charge.id)) return false;

      if (amountFrom && charge.totalAmount < Number(amountFrom)) return false;
      if (amountTo && charge.totalAmount > Number(amountTo)) return false;

      if (!keyword) return true;
      return (
        charge.student.fullName.toLowerCase().includes(keyword) ||
        charge.student.studentCode.toLowerCase().includes(keyword)
      );
    });
  }, [amountFrom, amountTo, billingModelFilter, charges, classFilter, onlyEndedCourses, search, selected, visibilityFilter]);

  const selectedCharges = visibleCharges.filter((charge) => selected.has(charge.id));
  const allVisibleSelected = visibleCharges.length > 0 && visibleCharges.every((charge) => selected.has(charge.id));

  const stats = useMemo(() => {
    const totalAmount = visibleCharges.reduce((sum, charge) => sum + charge.totalAmount, 0);
    const totalSelectedAmount = selectedCharges.reduce((sum, charge) => sum + charge.totalAmount, 0);
    const unpaidCount = visibleCharges.filter((charge) => chargeOwnDueAmount(charge) - charge.allocations.reduce((s, item) => s + item.amount, 0) > 0).length;
    const mismatchCount = visibleCharges.filter((charge) => hasBillingMismatch(charge)).length;
    return {
      visibleCount: visibleCharges.length,
      selectedCount: selectedCharges.length,
      totalAmount,
      totalSelectedAmount,
      unpaidCount,
      mismatchCount,
    };
  }, [selectedCharges, visibleCharges]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      visibleCharges.forEach((charge) => {
        if (checked) next.add(charge.id);
        else next.delete(charge.id);
      });
      return next;
    });
  }

  function selectOnlyUnpaid() {
    setSelected((current) => {
      const next = new Set(current);
      visibleCharges.forEach((charge) => {
        const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
        if (chargeOwnDueAmount(charge) - paid > 0) next.add(charge.id);
        else next.delete(charge.id);
      });
      return next;
    });
  }

  function clearVisibleSelection() {
    setSelected((current) => {
      const next = new Set(current);
      visibleCharges.forEach((charge) => next.delete(charge.id));
      return next;
    });
  }

  async function uploadQr(file: File | undefined) {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp)$/) || file.size > 2_000_000) {
      setProfileMessage("áº¢nh QR cáº§n lÃ  PNG/JPG/WEBP vÃ  khÃ´ng quÃ¡ 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPaymentProfile((current) => ({ ...current, qrImageData: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function savePaymentProfile() {
    setSavingProfile(true);
    setProfileMessage(null);

    const response = await fetch(`/api/branches/${branchId}/payment-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentProfile),
    });

    const data = await response.json().catch(() => ({}));
    setSavingProfile(false);
    setProfileMessage(response.ok ? "ÄÃ£ lÆ°u cáº¥u hÃ¬nh thanh toÃ¡n cho toÃ n bá»™ phiáº¿u." : data.error ?? "KhÃ´ng thá»ƒ lÆ°u cáº¥u hÃ¬nh thanh toÃ¡n.");
  }

  function requestSwitchBillingModel(charge: BatchCharge, nextBillingModel: "PERIOD" | "COURSE") {
    if (!charge.enrollmentId) {
      setActionMessage("KhÃ´ng tÃ¬m tháº¥y ghi danh Ä‘ang hoáº¡t Ä‘á»™ng Ä‘á»ƒ Ä‘á»•i kiá»ƒu thu.");
      return;
    }
    setPendingSwitch({ charge, nextBillingModel });
  }

  async function switchBillingModel(charge: BatchCharge, nextBillingModel: "PERIOD" | "COURSE") {
    setSwitchingKey(`${charge.id}:${nextBillingModel}`);
    setActionMessage(null);

    const response = await fetch(`/api/enrollments/${charge.enrollmentId}/billing-model`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingModel: nextBillingModel, billingPeriodId: periodId }),
    });

    const data = await response.json().catch(() => ({}));
    setSwitchingKey(null);

    if (!response.ok) {
      setActionMessage(data.error ?? "KhÃ´ng thá»ƒ Ä‘á»•i kiá»ƒu thu.");
      setPendingSwitch(null);
      return;
    }

    setActionMessage(nextBillingModel === "COURSE" ? "ÄÃ£ chuyá»ƒn sang thu trá»n khÃ³a vÃ  sinh láº¡i phiáº¿u phÃ¹ há»£p." : "ÄÃ£ chuyá»ƒn sang thu theo thÃ¡ng vÃ  lÃ m má»›i charge cá»§a ká»³ nÃ y.");
    setPendingSwitch(null);
    router.refresh();
  }

  async function handleExport() {
    if (selectedCharges.length === 0) return;

    setExporting(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/invoices/batch/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId,
          chargeIds: selectedCharges.map((charge) => charge.id),
          mode: exportMode === "MERGED" ? "merged" : "separate",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "KhÃ´ng táº£i Ä‘Æ°á»£c file phiáº¿u há»c phÃ­.");
      }

      const blob = await response.blob();
      const fileName = getDownloadFileName(
        response.headers.get("content-disposition"),
        exportMode === "MERGED" ? `phieu-hoc-phi_${periodName}.pdf` : `phieu-hoc-phi_${periodName}.zip`,
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setActionMessage(
        exportMode === "MERGED"
          ? `ÄÃ£ táº£i file PDF gá»™p ${selectedCharges.length} phiáº¿u.`
          : `ÄÃ£ táº£i file ZIP chá»©a ${selectedCharges.length} phiáº¿u riÃªng.`,
      );
    } catch (exportError) {
      setActionMessage(exportError instanceof Error ? exportError.message : "KhÃ´ng táº£i Ä‘Æ°á»£c file phiáº¿u há»c phÃ­.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={embedded ? "space-y-6 print:p-0" : "mx-auto max-w-[1720px] space-y-6 p-6 print:max-w-none print:p-0"}>
      <div className="no-print grid gap-6 print:hidden xl:grid-cols-[620px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-[28px] border border-hairline bg-white p-6 shadow-[0_12px_34px_rgba(31,68,111,0.08)]">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">{embedded ? "Váº­n hÃ nh chÃ­nh" : "Khu xuáº¥t phiáº¿u"}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{embedded ? `Danh sÃ¡ch thu ká»³ ${periodName}` : "Phiáº¿u há»c phÃ­ hÃ ng loáº¡t"}</h1>
              <p className="mt-2 max-w-[34rem] text-sm leading-6 text-ink-muted80">
                {embedded
                  ? "Lá»c Ä‘Ãºng nhÃ³m há»c viÃªn cáº§n xá»­ lÃ½, thu tiá»n ngay trÃªn tá»«ng dÃ²ng hoáº·c in phiáº¿u hÃ ng loáº¡t khi cáº§n."
                  : "Chá»‘t cáº¥u hÃ¬nh má»™t láº§n, chá»n Ä‘Ãºng danh sÃ¡ch cáº§n gá»­i, rá»“i in hoáº·c lÆ°u PDF hÃ ng loáº¡t cho phá»¥ huynh."}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" data-tour="tuition-summary">
              <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Ká»³ Ä‘ang xuáº¥t</p>
                <p className="mt-2 text-lg font-semibold text-ink">{periodName}</p>
              </div>
              <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">ÄÃ£ chá»n</p>
                <p className="mt-2 text-lg font-semibold text-ink">{stats.selectedCount}/{stats.visibleCount} phiáº¿u</p>
              </div>
              <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Tá»•ng tiá»n chá»n</p>
                <p className="mt-2 text-lg font-semibold text-ink">{formatVnd(stats.totalSelectedAmount)}</p>
              </div>
              <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">CÃ²n ná»£</p>
                <p className="mt-2 text-lg font-semibold text-red-600">{stats.unpaidCount} há»c viÃªn</p>
              </div>
              <div className="rounded-2xl border border-[#f6d67b] bg-[#fff8e8] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c76700]">Lá»‡ch kiá»ƒu thu</p>
                <p className="mt-2 text-lg font-semibold text-[#c76700]">{stats.mismatchCount} phiáº¿u</p>
              </div>
            </div>

            <div className="mt-4" data-tour="tuition-tabs">
              <DetailTabs
                tabs={[
                  {
                    key: "filter",
                    label: "Lá»c danh sÃ¡ch",
                    content: (
                      <div className="rounded-2xl border border-[#bfe3fb] bg-gradient-to-b from-[#f7fcff] to-[#f3f9ff] p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Lớp</span>
                            <select className="input mt-1" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                              <option value="">Tất cả lớp</option>
                              {classOptions.map((className) => (
                                <option key={className} value={className}>
                                  {className}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Tìm học viên</span>
                            <input className="input mt-1" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên học viên, mã học viên..." />
                          </label>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Kiá»ƒu thu hiá»‡n táº¡i</span>
                            <select className="input mt-1" value={billingModelFilter} onChange={(event) => setBillingModelFilter(event.target.value as "ALL" | "PERIOD" | "COURSE")}>
                              <option value="ALL">Táº¥t cáº£</option>
                              <option value="PERIOD">Äang thu theo thÃ¡ng</option>
                              <option value="COURSE">Äang thu theo khÃ³a</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Danh sÃ¡ch hiá»ƒn thá»‹</span>
                            <select className="input mt-1" value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as "ALL" | "UNPAID" | "SELECTED")}>
                              <option value="ALL">Táº¥t cáº£</option>
                              <option value="UNPAID">Chá»‰ cÃ²n ná»£</option>
                              <option value="SELECTED">Chá»‰ má»¥c Ä‘Ã£ chá»n</option>
                            </select>
                          </label>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Sá»‘ tiá»n tá»«</span>
                            <input type="number" min={0} className="input mt-1" value={amountFrom} onChange={(event) => setAmountFrom(event.target.value)} placeholder="0" />
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Sá»‘ tiá»n Ä‘áº¿n</span>
                            <input type="number" min={0} className="input mt-1" value={amountTo} onChange={(event) => setAmountTo(event.target.value)} placeholder="KhÃ´ng giá»›i háº¡n" />
                          </label>
                        </div>

                        <label className="mt-3 flex items-start gap-3 text-sm text-ink-muted80">
                          <input type="checkbox" checked={onlyEndedCourses} onChange={(event) => setOnlyEndedCourses(event.target.checked)} className="mt-1" />
                          <span>Chá»‰ láº¥y khÃ³a thu trá»n gÃ³i Ä‘Ã£ káº¿t thÃºc trong ká»³ nÃ y.</span>
                        </label>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={selectOnlyUnpaid} className="btn-primary-sm">
                            Chá»n ngÆ°á»i cÃ²n ná»£
                          </button>
                          <button type="button" onClick={() => toggleAll(true)} className="btn-secondary">
                            Chá»n táº¥t cáº£ Ä‘ang tháº¥y
                          </button>
                          <button type="button" onClick={clearVisibleSelection} className="btn-ghost">
                            Bá» chá»n
                          </button>
                        </div>

                        {actionMessage ? <p className="mt-3 text-sm text-ink-muted80">{actionMessage}</p> : null}
                      </div>
                    ),
                  },
                  {
                    key: "export",
                    label: "Xuáº¥t phiáº¿u",
                    content: (
                      <div className="rounded-2xl border border-hairline bg-white p-4">
                        <div className="space-y-3">
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Cháº¿ Ä‘á»™ xuáº¥t</span>
                            <select className="input mt-1 w-full" value={exportMode} onChange={(event) => setExportMode(event.target.value as "MERGED" | "SEPARATE")}>
                              <option value="MERGED">1 file PDF gá»™p nhiá»u phiáº¿u</option>
                              <option value="SEPARATE">Nhiá»u file PDF riÃªng (gÃ³i ZIP)</option>
                            </select>
                          </label>
                          <button onClick={handleExport} disabled={selectedCharges.length === 0 || exporting} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
                            {exporting
                              ? "Äang táº¡o file..."
                              : exportMode === "MERGED"
                                ? `Táº£i PDF gá»™p ${selectedCharges.length} phiáº¿u`
                                : `Táº£i ZIP ${selectedCharges.length} phiáº¿u riÃªng`}
                          </button>
                          <p className="text-sm text-ink-muted48">
                            {exportMode === "MERGED"
                              ? "Má»—i phiáº¿u sáº½ náº±m trÃªn 1 trang A5 trong cÃ¹ng file PDF."
                              : "Má»—i phiáº¿u sáº½ lÃ  1 file PDF riÃªng, tá»± táº£i vá» dÆ°á»›i dáº¡ng file ZIP."}
                          </p>
                          <p className="text-sm text-ink-muted48">
                            Äang chá»n {stats.selectedCount}/{stats.visibleCount} phiáº¿u Â· tá»•ng {formatVnd(stats.totalSelectedAmount)}
                          </p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "payment-profile",
                    label: "Chuyá»ƒn khoáº£n / QR",
                    content: (
                      <div className="rounded-2xl border border-hairline bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">DÃ¹ng chung cho toÃ n bá»™ phiáº¿u</p>
                          </div>
                          <button type="button" onClick={savePaymentProfile} disabled={savingProfile} className="btn-primary">
                            {savingProfile ? "Äang lÆ°u..." : "LÆ°u cáº¥u hÃ¬nh"}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                          <label className="form-group">
                            <span className="label-sm">NgÃ¢n hÃ ng</span>
                            <input
                              className="input-sm"
                              value={paymentProfile.bankName ?? ""}
                              onChange={(event) => setPaymentProfile((current) => ({ ...current, bankName: event.target.value }))}
                              placeholder="VÃ­ dá»¥: Vietcombank"
                            />
                          </label>
                          <label className="form-group">
                            <span className="label-sm">Sá»‘ tÃ i khoáº£n</span>
                            <input
                              className="input-sm"
                              value={paymentProfile.accountNumber ?? ""}
                              onChange={(event) => setPaymentProfile((current) => ({ ...current, accountNumber: event.target.value }))}
                            />
                          </label>
                          <label className="form-group">
                            <span className="label-sm">Chá»§ tÃ i khoáº£n</span>
                            <input
                              className="input-sm"
                              value={paymentProfile.accountHolder ?? ""}
                              onChange={(event) => setPaymentProfile((current) => ({ ...current, accountHolder: event.target.value }))}
                            />
                          </label>
                          <label className="form-group">
                            <span className="label-sm">áº¢nh QR</span>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadQr(event.target.files?.[0])} className="block w-full text-xs" />
                          </label>
                        </div>

                        <label className="form-group mt-3">
                          <span className="label-sm">Ghi chÃº / hÆ°á»›ng dáº«n gá»­i phá»¥ huynh</span>
                          <textarea
                            className="input-sm min-h-[88px]"
                            value={paymentProfile.paymentInstruction ?? ""}
                            onChange={(event) => setPaymentProfile((current) => ({ ...current, paymentInstruction: event.target.value }))}
                            placeholder="VÃ­ dá»¥: Sau khi chuyá»ƒn khoáº£n, phá»¥ huynh gá»­i xÃ¡c nháº­n cho giÃ¡o vá»¥."
                          />
                        </label>

                        {profileMessage ? <p className={`mt-3 text-sm ${profileMessage.startsWith("ÄÃ£ lÆ°u") ? "text-emerald-700" : "text-red-600"}`}>{profileMessage}</p> : null}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </aside>

        <section className="rounded-[28px] border border-hairline bg-white p-6 shadow-[0_12px_34px_rgba(31,68,111,0.08)]">
          <div className="flex flex-col gap-4 border-b border-hairline pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Danh sÃ¡ch xuáº¥t</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">Chá»n Ä‘Ãºng há»c viÃªn trÆ°á»›c khi in</h2>
              <p className="mt-1 text-sm text-ink-muted80">{stats.visibleCount} phiáº¿u Ä‘ang hiá»ƒn thá»‹ Â· tá»•ng {formatVnd(stats.totalAmount)}</p>
            </div>
            {!embedded ? (
              <BackButton href="/tuition" className="text-sm font-medium text-primary hover:underline">
                â† Quay láº¡i workspace há»c phÃ­
              </BackButton>
            ) : null}
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-hairline lg:block" data-tour="tuition-table">
            <div className="max-h-[70vh] overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-hairline bg-white">
                  <tr className="text-xs uppercase tracking-wide text-ink-muted48">
                    <th className="px-4 py-3">
                      <input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleAll(event.target.checked)} />
                    </th>
                    <th className="px-4 py-3 font-medium">Há»c viÃªn</th>
                    <th className="px-4 py-3 font-medium">Lá»›p / ká»³</th>
                    <th className="px-4 py-3 font-medium" data-tour="tuition-billing-col">Kiá»ƒu thu</th>
                    <th className="px-4 py-3 font-medium">Sá»‘ tiá»n</th>
                    <th className="px-4 py-3 font-medium" data-tour="tuition-actions-col">Thao tÃ¡c</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCharges.map((charge) => {
                    const { paid, meta, remaining, billingMismatch, effectiveBillingModel } = deriveChargeView(charge);

                    return (
                      <tr key={charge.id} className={`border-b border-hairline last:border-0 ${meta.rowClassName}`}>
                        <td className="px-4 py-3 align-top">
                          <input type="checkbox" checked={selected.has(charge.id)} onChange={() => toggle(charge.id)} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{charge.student.fullName}</p>
                          <p className="mt-1 text-xs text-ink-muted48">{charge.student.studentCode}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{charge.class.className}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-muted48">
                            <span>Ká»³ {charge.billingPeriod.periodName}</span>
                            <span>â€¢</span>
                            <span>{charge.invoice?.invoiceNo ?? "ChÆ°a cÃ³ sá»‘"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ChargeStatusBadges effectiveBillingModel={effectiveBillingModel} meta={meta} billingMismatch={billingMismatch} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 text-sm">
                            <div className="font-semibold text-ink">{formatVnd(charge.totalAmount)}</div>
                            <div className="text-red-600">CÃ²n {formatVnd(remaining)}</div>
                            {paid > 0 ? <div className="text-emerald-600">ÄÃ£ thu {formatVnd(paid)}</div> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ChargeActions
                            charge={charge}
                            meta={meta}
                            remaining={remaining}
                            billingMismatch={billingMismatch}
                            paid={paid}
                            canManageTuition={canManageTuition}
                            switchingKey={switchingKey}
                            onRequestSwitch={requestSwitchBillingModel}
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {visibleCharges.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-ink-muted48">
                        KhÃ´ng cÃ³ há»c viÃªn nÃ o khá»›p bá»™ lá»c hiá»‡n táº¡i.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: card list â€” dÃ¹ng chung deriveChargeView/ChargeStatusBadges/ChargeActions
              vá»›i báº£n báº£ng desktop á»Ÿ trÃªn, chá»‰ khÃ¡c cÃ¡ch xáº¿p layout. */}
          <div className="mt-4 space-y-3 lg:hidden">
            <label className="flex items-center gap-2 rounded-xl border border-hairline bg-white px-4 py-3 text-sm font-medium text-ink-muted80">
              <input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleAll(event.target.checked)} />
              Chá»n táº¥t cáº£ Ä‘ang hiá»ƒn thá»‹
            </label>
            {visibleCharges.map((charge) => {
              const { paid, meta, remaining, billingMismatch, effectiveBillingModel } = deriveChargeView(charge);
              return (
                <div key={charge.id} className={`rounded-xl border border-hairline p-4 ${meta.rowClassName}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selected.has(charge.id)} onChange={() => toggle(charge.id)} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{charge.student.fullName}</p>
                      <p className="text-xs text-ink-muted48">{charge.student.studentCode}</p>
                      <p className="mt-1 text-sm text-ink-muted80">{charge.class.className}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-muted48">
                        <span>Ká»³ {charge.billingPeriod.periodName}</span>
                        <span>â€¢</span>
                        <span>{charge.invoice?.invoiceNo ?? "ChÆ°a cÃ³ sá»‘"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-hairline/70 pt-3">
                    <ChargeStatusBadges effectiveBillingModel={effectiveBillingModel} meta={meta} billingMismatch={billingMismatch} />
                    <div className="text-right text-sm">
                      <div className="font-semibold text-ink">{formatVnd(charge.totalAmount)}</div>
                      <div className="text-red-600">CÃ²n {formatVnd(remaining)}</div>
                      {paid > 0 ? <div className="text-emerald-600">ÄÃ£ thu {formatVnd(paid)}</div> : null}
                    </div>
                  </div>

                  <div className="mt-3 border-t border-hairline/70 pt-3">
                    <ChargeActions
                      charge={charge}
                      meta={meta}
                      remaining={remaining}
                      billingMismatch={billingMismatch}
                      paid={paid}
                      canManageTuition={canManageTuition}
                      switchingKey={switchingKey}
                      onRequestSwitch={requestSwitchBillingModel}
                    />
                  </div>
                </div>
              );
            })}
            {visibleCharges.length === 0 ? (
              <div className="rounded-xl border border-dashed border-hairline bg-white p-8 text-center text-sm text-ink-muted48">
                KhÃ´ng cÃ³ há»c viÃªn nÃ o khá»›p bá»™ lá»c hiá»‡n táº¡i.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="print-area hidden space-y-8 print:block">
        {selectedCharges.map((charge) => (
          <div key={charge.id} className="break-after-page">
            <InvoiceDocument charge={charge} paymentProfile={paymentProfile} />
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingSwitch}
        title="XÃ¡c nháº­n Ä‘á»•i kiá»ƒu thu há»c phÃ­?"
        description={
          pendingSwitch
            ? `Chuyá»ƒn há»c viÃªn ${pendingSwitch.charge.student.fullName} sang ${pendingSwitch.nextBillingModel === "COURSE" ? "thu trá»n khÃ³a" : "thu theo thÃ¡ng"}. Phiáº¿u hiá»‡n táº¡i chá»‰ Ä‘Æ°á»£c thay tháº¿ khi chÆ°a thu tiá»n â€” náº¿u Ä‘Ã£ phÃ¡t sinh thu thá»±c táº¿, há»‡ thá»‘ng sáº½ tá»± cháº·n Ä‘á»ƒ trÃ¡nh lá»‡ch cÃ´ng ná»£.`
            : undefined
        }
        confirmLabel="XÃ¡c nháº­n Ä‘á»•i"
        loading={!!pendingSwitch && switchingKey === `${pendingSwitch.charge.id}:${pendingSwitch.nextBillingModel}`}
        onConfirm={() => {
          if (pendingSwitch) void switchBillingModel(pendingSwitch.charge, pendingSwitch.nextBillingModel);
        }}
        onClose={() => setPendingSwitch(null)}
      />
    </div>
  );
}
