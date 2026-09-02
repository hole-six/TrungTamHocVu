"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";

type StudentHit = { id: string; fullName: string; studentCode: string };
type EnrollmentOption = { id: string; className: string };
type BillingPeriodOption = { id: string; periodName: string };

type StudentConfig = {
  enrollments: EnrollmentOption[];
  enrollmentId: string;
  billingPeriodId: string;
  loadingEnrollments: boolean;
};

type SubmitResult = { studentId: string; fullName: string; ok: boolean; message: string };

// Dùng theo 2 cách: (1) nút tự thân mở drawer rồi tự tìm học viên, chọn được NHIỀU
// học viên cùng lúc (trang Bổ trợ), hoặc (2) điều khiển từ ngoài — truyền sẵn
// `initialStudent` + `onClose` để mở thẳng vào đúng 1 học viên đó, bỏ qua bước tìm
// kiếm (dùng ở nút "Thêm bổ trợ" trên trang Học viên).
export default function AddPaidCatchupForm({
  initialStudent,
  onClose: externalOnClose,
}: {
  initialStudent?: StudentHit | null;
  onClose?: () => void;
} = {}) {
  const router = useRouter();
  const controlled = Boolean(initialStudent);
  const [open, setOpen] = useState(controlled);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<StudentHit[]>([]);
  const [configByStudent, setConfigByStudent] = useState<Record<string, StudentConfig>>({});
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodOption[]>([]);
  const [count, setCount] = useState("1");
  const [isFree, setIsFree] = useState(false);
  const [unitPrice, setUnitPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitOutcomes, setSubmitOutcomes] = useState<SubmitResult[] | null>(null);

  function reset() {
    setQ("");
    setResults([]);
    setSelectedStudents([]);
    setConfigByStudent({});
    setCount("1");
    setIsFree(false);
    setUnitPrice(0);
    setSubmitOutcomes(null);
  }

  // Luôn hiện sẵn 1 danh sách học viên duyệt được (không bắt buộc gõ tìm trước mới
  // thấy ai) — gõ vào ô tìm sẽ lọc lại danh sách này theo tên/mã, debounce 300ms.
  useEffect(() => {
    if (!open || selectedStudents.length > 0) return;
    let cancelled = false;
    setLoadingResults(true);
    const timer = setTimeout(async () => {
      const trimmed = q.trim();
      const response = await fetch(`/api/students?q=${encodeURIComponent(trimmed)}&status=ACTIVE&pageSize=30`);
      const result = await response.json().catch(() => ({}));
      if (!cancelled) {
        const items: StudentHit[] = result.items ?? [];
        // Không gõ gì (duyệt cả danh sách) thì xếp theo tên cho dễ tìm bằng mắt — API
        // trả về theo createdAt desc, không hợp để DUYỆT (mới tạo lên đầu).
        setResults(trimmed ? items : [...items].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi")));
        setLoadingResults(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, q, selectedStudents.length]);

  async function loadEnrollmentsFor(student: StudentHit) {
    setConfigByStudent((current) => ({
      ...current,
      [student.id]: { enrollments: [], enrollmentId: "", billingPeriodId: "", loadingEnrollments: true },
    }));
    const response = await fetch(`/api/students/${student.id}`);
    const data = await response.json().catch(() => ({}));
    const active: EnrollmentOption[] = (data.enrollments ?? [])
      .filter((item: { status: string }) => item.status === "ACTIVE")
      .map((item: { id: string; class: { className: string } }) => ({ id: item.id, className: item.class.className }));
    setConfigByStudent((current) => ({
      ...current,
      [student.id]: {
        enrollments: active,
        enrollmentId: active.length === 1 ? active[0].id : "",
        billingPeriodId: "",
        loadingEnrollments: false,
      },
    }));
  }

  function toggleStudent(student: StudentHit) {
    setSelectedStudents((current) => {
      const exists = current.some((item) => item.id === student.id);
      if (exists) {
        setConfigByStudent((configs) => {
          const next = { ...configs };
          delete next[student.id];
          return next;
        });
        return current.filter((item) => item.id !== student.id);
      }
      void loadEnrollmentsFor(student);
      return [...current, student];
    });
  }

  useEffect(() => {
    if (initialStudent) {
      setSelectedStudents([initialStudent]);
      void loadEnrollmentsFor(initialStudent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStudent?.id]);

  // Kỳ thu học phí — dùng chung cho toàn chi nhánh, tải 1 lần khi bắt đầu bước cấu
  // hình để mỗi học viên chọn đúng "thời điểm" cộng tiền bổ trợ vào, thay vì luôn
  // cộng vào kỳ đang mở hôm nay (dễ sai nếu bổ trợ bù cho tháng khác).
  useEffect(() => {
    if (selectedStudents.length === 0 || billingPeriods.length > 0) return;
    fetch("/api/billing-periods")
      .then((res) => res.json())
      .then((data) => setBillingPeriods((data.items ?? []).map((item: { id: string; periodName: string }) => ({ id: item.id, periodName: item.periodName }))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudents.length]);

  function closeDrawer() {
    if (controlled) {
      externalOnClose?.();
    } else {
      setOpen(false);
    }
  }

  function updateConfig(studentId: string, patch: Partial<StudentConfig>) {
    setConfigByStudent((current) => ({ ...current, [studentId]: { ...current[studentId], ...patch } }));
  }

  const readyToSubmit =
    selectedStudents.length > 0 &&
    selectedStudents.every((student) => Boolean(configByStudent[student.id]?.enrollmentId)) &&
    (isFree || unitPrice > 0);

  async function submit() {
    if (!readyToSubmit) return;
    setSubmitting(true);
    setSubmitOutcomes(null);

    const outcomes: SubmitResult[] = [];
    for (const student of selectedStudents) {
      const config = configByStudent[student.id];
      const response = await fetch(`/api/students/${student.id}/session-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: config.enrollmentId,
          count: Number(count),
          isFree,
          unitPrice,
          billingPeriodId: config.billingPeriodId || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        outcomes.push({ studentId: student.id, fullName: student.fullName, ok: false, message: data.error ?? "Không thể thêm bổ trợ." });
      } else {
        const chargeNote = !isFree ? (data.chargeUpdated ? " Đã cộng vào công nợ." : data.warning ? " Chưa cộng được vào công nợ." : "") : "";
        outcomes.push({ studentId: student.id, fullName: student.fullName, ok: true, message: `Đã thêm ${count} buổi.${chargeNote}` });
      }
    }

    setSubmitting(false);
    setSubmitOutcomes(outcomes);
    router.refresh();
  }

  return (
    <>
      {!controlled ? (
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="rounded-xl border border-[#dbe3ef] bg-white px-4 py-2 text-sm font-bold text-[#0f1729] hover:border-[#3b82f6]"
        >
          Thêm bổ trợ đầu khóa
        </button>
      ) : null}

      <ResponsiveDrawer
        open={open}
        onClose={closeDrawer}
        title="Thêm bổ trợ đầu khóa"
        description="Chọn một hoặc nhiều học viên đã ghi danh sẵn để đăng ký thêm buổi bổ trợ đầu khóa — có thể miễn phí hoặc tính phí, chọn đúng kỳ học phí để cộng tiền vào."
        widthClassName="max-w-2xl"
      >
        <div className="space-y-5">
          {selectedStudents.length === 0 ? (
            <>
              <input
                className="input"
                placeholder="Tìm theo tên hoặc mã học viên... (để trống để xem cả danh sách)"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                autoFocus
              />
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {loadingResults ? (
                  <p className="text-sm text-[#64748b]">Đang tải...</p>
                ) : results.length === 0 ? (
                  <p className="text-sm text-[#64748b]">Không tìm thấy học viên phù hợp.</p>
                ) : (
                  results.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleStudent(student)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#e5eaf7] bg-white px-4 py-3 text-left hover:border-[#3b82f6]"
                    >
                      <span className="font-bold text-[#0f1729]">{student.fullName}</span>
                      <span className="text-xs text-[#64748b]">{student.studentCode}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                {!controlled ? (
                  <div className="flex items-center justify-between">
                    <span className="label-sm">Đã chọn {selectedStudents.length} học viên</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudents([]);
                        setConfigByStudent({});
                      }}
                      className="text-xs font-bold text-[#1d4ed8] hover:underline"
                    >
                      Chọn lại
                    </button>
                  </div>
                ) : null}
                {selectedStudents.map((student) => {
                  const config = configByStudent[student.id];
                  return (
                    <div key={student.id} className="rounded-xl border border-[#dbeafe] bg-[#eff6ff] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#0f1729]">{student.fullName}</p>
                          <p className="text-xs text-[#64748b]">{student.studentCode}</p>
                        </div>
                        {!controlled ? (
                          <button type="button" onClick={() => toggleStudent(student)} className="text-xs font-bold text-red-600 hover:underline">
                            Bỏ chọn
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5 block">
                          <span className="label-sm">Lớp gắn bổ trợ</span>
                          {config?.loadingEnrollments ? (
                            <p className="text-xs text-[#64748b]">Đang tải...</p>
                          ) : !config || config.enrollments.length === 0 ? (
                            <p className="text-xs text-red-600">Chưa có ghi danh đang hoạt động.</p>
                          ) : (
                            <select
                              className="input"
                              value={config.enrollmentId}
                              onChange={(event) => updateConfig(student.id, { enrollmentId: event.target.value })}
                            >
                              {config.enrollments.length > 1 ? <option value="">Chọn lớp</option> : null}
                              {config.enrollments.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.className}
                                </option>
                              ))}
                            </select>
                          )}
                        </label>

                        <label className="space-y-1.5 block">
                          <span className="label-sm">Thời điểm học phí</span>
                          <select
                            className="input"
                            value={config?.billingPeriodId ?? ""}
                            onChange={(event) => updateConfig(student.id, { billingPeriodId: event.target.value })}
                          >
                            <option value="">Tự động (kỳ đang mở)</option>
                            {billingPeriods.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.periodName}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 border-t border-hairline pt-4">
                <label className="space-y-2">
                  <span className="label-sm">Số buổi bổ trợ (áp dụng cho tất cả)</span>
                  <input type="number" min="1" className="input" value={count} onChange={(event) => setCount(event.target.value)} />
                </label>

                <label className="flex items-end gap-2 pb-3.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#c8d5ec] text-primary"
                    checked={isFree}
                    onChange={(event) => setIsFree(event.target.checked)}
                  />
                  <span className="text-sm font-semibold text-ink">Miễn phí</span>
                </label>
              </div>

              {!isFree ? (
                <label className="space-y-2 block">
                  <span className="label-sm">Giá mỗi buổi</span>
                  <CurrencyInput value={unitPrice} onChange={setUnitPrice} />
                  {unitPrice > 0 ? (
                    <p className="text-xs text-ink-muted48">
                      Tổng mỗi học viên: {formatVnd(unitPrice * (Number(count) || 0))} · Tổng {selectedStudents.length} học viên:{" "}
                      {formatVnd(unitPrice * (Number(count) || 0) * selectedStudents.length)}
                    </p>
                  ) : null}
                </label>
              ) : null}

              {submitOutcomes ? (
                <div className="space-y-1 rounded-xl border border-[#e5eaf7] bg-white p-3">
                  {submitOutcomes.map((item) => (
                    <p key={item.studentId} className={`text-xs ${item.ok ? "text-emerald-700" : "text-red-600"}`}>
                      {item.ok ? "✓" : "✗"} {item.fullName}: {item.message}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-3 border-t border-hairline pt-4">
                <button type="button" onClick={submit} disabled={submitting || !readyToSubmit} className="btn-primary">
                  {submitting ? "Đang lưu..." : `Thêm bổ trợ đầu khóa (${selectedStudents.length})`}
                </button>
                <button type="button" onClick={closeDrawer} className="btn-ghost">
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </ResponsiveDrawer>
    </>
  );
}
