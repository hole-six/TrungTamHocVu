"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import InvoiceDocument, { type InvoiceChargeData, type PaymentProfileData } from "@/components/tuition/InvoiceDocument";
import QuickPaymentButton from "@/components/tuition/QuickPaymentButton";
import DetailTabs from "@/components/ui/DetailTabs";

type BatchCharge = InvoiceChargeData & {
  enrollmentId: string | null;
  currentEnrollmentBillingModel: string;
  classEndedThisPeriod: boolean;
};

const BILLING_MODEL_LABEL: Record<string, string> = {
  PERIOD: "Theo tháng",
  COURSE: "Trọn khóa",
};

function formatVnd(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

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

function getChargeCollectionMeta(totalAmount: number, paidAmount: number) {
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);

  if (paidAmount <= 0) {
    return {
      remainingAmount,
      paymentLabel: "Chưa thu",
      paymentClassName: "bg-[#f0f3f7] text-[#5f6f84]",
      regenLabel: "Được sinh lại",
      regenClassName: "bg-[#e8f8f1] text-[#149b66]",
      regenHint: "Chưa có tiền thu thực tế nên có thể đổi kiểu thu hoặc sinh lại phiếu.",
      rowClassName: "bg-[#f1fbf7] hover:bg-[#ecfaf4]",
    };
  }

  if (paidAmount < totalAmount) {
    return {
      remainingAmount,
      paymentLabel: "Đã thu một phần",
      paymentClassName: "bg-[#fff8e8] text-[#c76700]",
      regenLabel: "Khóa sinh lại",
      regenClassName: "bg-red-100 text-red-700",
      regenHint: `Đã thu ${formatVnd(paidAmount)} nên không được sinh đè để tránh lệch công nợ.`,
      rowClassName: "bg-[#fff8e8] hover:bg-[#fff4d6]",
    };
  }

  return {
    remainingAmount,
    paymentLabel: "Đã thu hết",
    paymentClassName: "bg-[#e8f8f1] text-[#149b66]",
    regenLabel: "Khóa sinh lại",
    regenClassName: "bg-red-100 text-red-700",
    regenHint: "Phiếu này đã thu xong nên không được sinh lại.",
    rowClassName: "bg-[#e8f8f1] hover:bg-[#ecfaf4]",
  };
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
            return !hasBillingMismatch(charge) && charge.totalAmount - paid > 0;
          })
          .map((charge) => charge.id),
      ),
  );
  const [onlyEndedCourses, setOnlyEndedCourses] = useState(false);
  const [search, setSearch] = useState("");
  const [billingModelFilter, setBillingModelFilter] = useState<"ALL" | "PERIOD" | "COURSE">("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<"ALL" | "UNPAID" | "SELECTED">("ALL");
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
  const [exporting, setExporting] = useState(false);

  const visibleCharges = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return charges.filter((charge) => {
      const effectiveBillingModel = getEffectiveBillingModel(charge);
      const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
      const remaining = Math.max(charge.totalAmount - paid, 0);

      if (onlyEndedCourses && charge.billingModel === "COURSE" && !charge.classEndedThisPeriod) return false;
      if (billingModelFilter !== "ALL" && effectiveBillingModel !== billingModelFilter) return false;

      if (visibilityFilter === "UNPAID" && remaining <= 0) return false;
      if (visibilityFilter === "SELECTED" && !selected.has(charge.id)) return false;

      if (!keyword) return true;
      return (
        charge.student.fullName.toLowerCase().includes(keyword) ||
        charge.student.studentCode.toLowerCase().includes(keyword) ||
        charge.class.className.toLowerCase().includes(keyword)
      );
    });
  }, [billingModelFilter, charges, onlyEndedCourses, search, selected, visibilityFilter]);

  const selectedCharges = visibleCharges.filter((charge) => selected.has(charge.id));
  const allVisibleSelected = visibleCharges.length > 0 && visibleCharges.every((charge) => selected.has(charge.id));

  const stats = useMemo(() => {
    const totalAmount = visibleCharges.reduce((sum, charge) => sum + charge.totalAmount, 0);
    const totalSelectedAmount = selectedCharges.reduce((sum, charge) => sum + charge.totalAmount, 0);
    const unpaidCount = visibleCharges.filter((charge) => charge.totalAmount - charge.allocations.reduce((s, item) => s + item.amount, 0) > 0).length;
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
        if (charge.totalAmount - paid > 0) next.add(charge.id);
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
      setProfileMessage("Ảnh QR cần là PNG/JPG/WEBP và không quá 2MB.");
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
    setProfileMessage(response.ok ? "Đã lưu cấu hình thanh toán cho toàn bộ phiếu." : data.error ?? "Không thể lưu cấu hình thanh toán.");
  }

  async function switchBillingModel(charge: BatchCharge, nextBillingModel: "PERIOD" | "COURSE") {
    if (!charge.enrollmentId) {
      setActionMessage("Không tìm thấy ghi danh đang hoạt động để đổi kiểu thu.");
      return;
    }

    const nextLabel = nextBillingModel === "COURSE" ? "thu trọn khóa" : "thu theo tháng";
    const confirmed = window.confirm(
      `Xác nhận chuyển học viên ${charge.student.fullName} sang ${nextLabel}?\n\nPhiếu hiện tại chỉ được thay thế khi chưa thu tiền. Nếu phiếu này đã phát sinh thu thực tế, hệ thống sẽ tự chặn để tránh lệch công nợ.`,
    );
    if (!confirmed) return;

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
      setActionMessage(data.error ?? "Không thể đổi kiểu thu.");
      return;
    }

    setActionMessage(nextBillingModel === "COURSE" ? "Đã chuyển sang thu trọn khóa và sinh lại phiếu phù hợp." : "Đã chuyển sang thu theo tháng và làm mới charge của kỳ này.");
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
        throw new Error(data.error ?? "Không tải được file phiếu học phí.");
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
          ? `Đã tải file PDF gộp ${selectedCharges.length} phiếu.`
          : `Đã tải file ZIP chứa ${selectedCharges.length} phiếu riêng.`,
      );
    } catch (exportError) {
      setActionMessage(exportError instanceof Error ? exportError.message : "Không tải được file phiếu học phí.");
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">{embedded ? "Vận hành chính" : "Khu xuất phiếu"}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{embedded ? `Danh sách thu kỳ ${periodName}` : "Phiếu học phí hàng loạt"}</h1>
              <p className="mt-2 max-w-[34rem] text-sm leading-6 text-ink-muted80">
                {embedded
                  ? "Lọc đúng nhóm học viên cần xử lý, thu tiền ngay trên từng dòng hoặc in phiếu hàng loạt khi cần."
                  : "Chốt cấu hình một lần, chọn đúng danh sách cần gửi, rồi in hoặc lưu PDF hàng loạt cho phụ huynh."}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Kỳ đang xuất</p>
                <p className="mt-2 text-lg font-semibold text-ink">{periodName}</p>
              </div>
              <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Đã chọn</p>
                <p className="mt-2 text-lg font-semibold text-ink">{stats.selectedCount}/{stats.visibleCount} phiếu</p>
              </div>
              <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Tổng tiền chọn</p>
                <p className="mt-2 text-lg font-semibold text-ink">{formatVnd(stats.totalSelectedAmount)}</p>
              </div>
              <div className="rounded-2xl border border-[#dfe8f2] bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Còn nợ</p>
                <p className="mt-2 text-lg font-semibold text-red-600">{stats.unpaidCount} học viên</p>
              </div>
              <div className="rounded-2xl border border-[#f6d67b] bg-[#fff8e8] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c76700]">Lệch kiểu thu</p>
                <p className="mt-2 text-lg font-semibold text-[#c76700]">{stats.mismatchCount} phiếu</p>
              </div>
            </div>

            <div className="mt-4">
              <DetailTabs
                tabs={[
                  {
                    key: "filter",
                    label: "Lọc danh sách",
                    content: (
                      <div className="rounded-2xl border border-[#bfe3fb] bg-gradient-to-b from-[#f7fcff] to-[#f3f9ff] p-4">
                        <label className="block">
                          <span className="text-xs font-medium text-ink-muted48">Tìm học viên / lớp</span>
                          <input className="input mt-1" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên học viên, mã học viên, lớp..." />
                        </label>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Kiểu thu hiện tại</span>
                            <select className="input mt-1" value={billingModelFilter} onChange={(event) => setBillingModelFilter(event.target.value as "ALL" | "PERIOD" | "COURSE")}>
                              <option value="ALL">Tất cả</option>
                              <option value="PERIOD">Đang thu theo tháng</option>
                              <option value="COURSE">Đang thu theo khóa</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Danh sách hiển thị</span>
                            <select className="input mt-1" value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as "ALL" | "UNPAID" | "SELECTED")}>
                              <option value="ALL">Tất cả</option>
                              <option value="UNPAID">Chỉ còn nợ</option>
                              <option value="SELECTED">Chỉ mục đã chọn</option>
                            </select>
                          </label>
                        </div>

                        <label className="mt-3 flex items-start gap-3 text-sm text-ink-muted80">
                          <input type="checkbox" checked={onlyEndedCourses} onChange={(event) => setOnlyEndedCourses(event.target.checked)} className="mt-1" />
                          <span>Chỉ lấy khóa thu trọn gói đã kết thúc trong kỳ này.</span>
                        </label>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={selectOnlyUnpaid} className="btn-primary-sm">
                            Chọn người còn nợ
                          </button>
                          <button type="button" onClick={() => toggleAll(true)} className="btn-secondary">
                            Chọn tất cả đang thấy
                          </button>
                          <button type="button" onClick={clearVisibleSelection} className="btn-ghost">
                            Bỏ chọn
                          </button>
                        </div>

                        {actionMessage ? <p className="mt-3 text-sm text-ink-muted80">{actionMessage}</p> : null}
                      </div>
                    ),
                  },
                  {
                    key: "export",
                    label: "Xuất phiếu",
                    content: (
                      <div className="rounded-2xl border border-hairline bg-white p-4">
                        <div className="space-y-3">
                          <label className="block">
                            <span className="text-xs font-medium text-ink-muted48">Chế độ xuất</span>
                            <select className="input mt-1 w-full" value={exportMode} onChange={(event) => setExportMode(event.target.value as "MERGED" | "SEPARATE")}>
                              <option value="MERGED">1 file PDF gộp nhiều phiếu</option>
                              <option value="SEPARATE">Nhiều file PDF riêng (gói ZIP)</option>
                            </select>
                          </label>
                          <button onClick={handleExport} disabled={selectedCharges.length === 0 || exporting} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
                            {exporting
                              ? "Đang tạo file..."
                              : exportMode === "MERGED"
                                ? `Tải PDF gộp ${selectedCharges.length} phiếu`
                                : `Tải ZIP ${selectedCharges.length} phiếu riêng`}
                          </button>
                          <p className="text-sm text-ink-muted48">
                            {exportMode === "MERGED"
                              ? "Mỗi phiếu sẽ nằm trên 1 trang A4 trong cùng file PDF."
                              : "Mỗi phiếu sẽ là 1 file PDF riêng, tự tải về dưới dạng file ZIP."}
                          </p>
                          <p className="text-sm text-ink-muted48">
                            Đang chọn {stats.selectedCount}/{stats.visibleCount} phiếu · tổng {formatVnd(stats.totalSelectedAmount)}
                          </p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "payment-profile",
                    label: "Chuyển khoản / QR",
                    content: (
                      <div className="rounded-2xl border border-hairline bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Dùng chung cho toàn bộ phiếu</p>
                          </div>
                          <button type="button" onClick={savePaymentProfile} disabled={savingProfile} className="btn-primary">
                            {savingProfile ? "Đang lưu..." : "Lưu cấu hình"}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                          <label className="form-group">
                            <span className="label-sm">Ngân hàng</span>
                            <input
                              className="input-sm"
                              value={paymentProfile.bankName ?? ""}
                              onChange={(event) => setPaymentProfile((current) => ({ ...current, bankName: event.target.value }))}
                              placeholder="Ví dụ: Vietcombank"
                            />
                          </label>
                          <label className="form-group">
                            <span className="label-sm">Số tài khoản</span>
                            <input
                              className="input-sm"
                              value={paymentProfile.accountNumber ?? ""}
                              onChange={(event) => setPaymentProfile((current) => ({ ...current, accountNumber: event.target.value }))}
                            />
                          </label>
                          <label className="form-group">
                            <span className="label-sm">Chủ tài khoản</span>
                            <input
                              className="input-sm"
                              value={paymentProfile.accountHolder ?? ""}
                              onChange={(event) => setPaymentProfile((current) => ({ ...current, accountHolder: event.target.value }))}
                            />
                          </label>
                          <label className="form-group">
                            <span className="label-sm">Ảnh QR</span>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadQr(event.target.files?.[0])} className="block w-full text-xs" />
                          </label>
                        </div>

                        <label className="form-group mt-3">
                          <span className="label-sm">Ghi chú / hướng dẫn gửi phụ huynh</span>
                          <textarea
                            className="input-sm min-h-[88px]"
                            value={paymentProfile.paymentInstruction ?? ""}
                            onChange={(event) => setPaymentProfile((current) => ({ ...current, paymentInstruction: event.target.value }))}
                            placeholder="Ví dụ: Sau khi chuyển khoản, phụ huynh gửi xác nhận cho giáo vụ."
                          />
                        </label>

                        {profileMessage ? <p className={`mt-3 text-sm ${profileMessage.startsWith("Đã lưu") ? "text-emerald-700" : "text-red-600"}`}>{profileMessage}</p> : null}
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted48">Danh sách xuất</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">Chọn đúng học viên trước khi in</h2>
              <p className="mt-1 text-sm text-ink-muted80">{stats.visibleCount} phiếu đang hiển thị · tổng {formatVnd(stats.totalAmount)}</p>
            </div>
            {!embedded ? (
              <Link href="/tuition" className="text-sm font-medium text-primary hover:underline">
                ← Quay lại workspace học phí
              </Link>
            ) : null}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-hairline">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-hairline bg-white">
                  <tr className="text-xs uppercase tracking-wide text-ink-muted48">
                    <th className="px-4 py-3">
                      <input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleAll(event.target.checked)} />
                    </th>
                    <th className="px-4 py-3 font-medium">Học viên</th>
                    <th className="px-4 py-3 font-medium">Lớp / kỳ</th>
                    <th className="px-4 py-3 font-medium">Kiểu thu</th>
                    <th className="px-4 py-3 font-medium">Số tiền</th>
                    <th className="px-4 py-3 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCharges.map((charge) => {
                    const paid = charge.allocations.reduce((sum, item) => sum + item.amount, 0);
                    const meta = getChargeCollectionMeta(charge.totalAmount, paid);
                    const remaining = meta.remainingAmount;
                    const billingMismatch = hasBillingMismatch(charge);
                    const effectiveBillingModel = getEffectiveBillingModel(charge);

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
                            <span>Kỳ {charge.billingPeriod.periodName}</span>
                            <span>•</span>
                            <span>{charge.invoice?.invoiceNo ?? "Chưa có số"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            <span className={`badge ${effectiveBillingModel === "COURSE" ? "bg-[#f3efff] text-[#7b4df5]" : "bg-[#e5f4ff] text-[#0a80c8]"}`}>
                              {BILLING_MODEL_LABEL[effectiveBillingModel] ?? effectiveBillingModel}
                            </span>
                            <span className={`badge ${meta.paymentClassName}`}>{meta.paymentLabel}</span>
                            {billingMismatch ? (
                              <span className="badge bg-[#fff8e8] text-[#c76700]">Phiếu lệch kiểu thu</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 text-sm">
                            <div className="font-semibold text-ink">{formatVnd(charge.totalAmount)}</div>
                            <div className="text-red-600">Còn {formatVnd(remaining)}</div>
                            {paid > 0 ? <div className="text-emerald-600">Đã thu {formatVnd(paid)}</div> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/students/${charge.student.id}?tab=hocphi`}
                              className="inline-flex h-10 items-center justify-center rounded-full border border-[#b7dff8] bg-[#f6fcff] px-4 text-sm font-semibold text-[#077dc8] transition hover:border-[#8fcdf3] hover:bg-[#eaf7ff]"
                            >
                              Học phí HV
                            </Link>
                            {remaining > 0 ? (
                              <a
                                href={`/api/invoices/${charge.id}/pdf`}
                                className="inline-flex h-10 items-center justify-center rounded-full border border-[#dfe8f2] bg-white px-4 text-sm font-semibold text-[#6f7f94] transition hover:border-[#cad8e8] hover:text-primary"
                              >
                                Tải phiếu
                              </a>
                            ) : null}
                            {canManageTuition && remaining > 0 ? <QuickPaymentButton studentId={charge.student.id ?? ""} suggestedAmount={remaining} /> : null}
                          </div>
                          {billingMismatch && paid <= 0 ? (
                            <p className="mt-2 max-w-[240px] text-xs leading-5 text-amber-800">
                              Phiếu hiện tại đang là {BILLING_MODEL_LABEL[charge.billingModel] ?? charge.billingModel}, cần làm mới trước khi in.
                            </p>
                          ) : null}
                          {canManageTuition && paid <= 0 && charge.enrollmentId ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {charge.currentEnrollmentBillingModel !== "PERIOD" ? (
                                <button
                                  type="button"
                                  onClick={() => switchBillingModel(charge, "PERIOD")}
                                  disabled={switchingKey === `${charge.id}:PERIOD`}
                                  className="rounded-full border border-[#b7dff8] bg-[#f6fcff] px-3 py-1 text-xs font-semibold text-[#077dc8] transition hover:border-[#8fcdf3] hover:bg-[#eaf7ff] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {switchingKey === `${charge.id}:PERIOD` ? "Đang chuyển..." : "Chuyển thu tháng"}
                                </button>
                              ) : null}
                              {charge.currentEnrollmentBillingModel !== "COURSE" ? (
                                <button
                                  type="button"
                                  onClick={() => switchBillingModel(charge, "COURSE")}
                                  disabled={switchingKey === `${charge.id}:COURSE`}
                                  className="rounded-full border border-[#d8ccff] bg-[#f3efff] px-3 py-1 text-xs font-semibold text-[#7b4df5] transition hover:border-[#c3aeff] hover:bg-[#ebe3ff] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {switchingKey === `${charge.id}:COURSE` ? "Đang chuyển..." : "Chuyển thu khóa"}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}

                  {visibleCharges.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-ink-muted48">
                        Không có học viên nào khớp bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}
