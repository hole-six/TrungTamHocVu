"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CourseOption = {
  id: string;
  code: string;
  name: string;
  tuitionPerSession: number;
  sessionsPerWeek: number;
};

type ClassOption = {
  id: string;
  classCode: string;
  className: string;
  courseId: string | null;
  courseName: string | null;
  courseCode: string | null;
  tuitionPerSession: number | null;
  sessionsPerWeek: number | null;
  activeEnrollments: number;
  startDate: string | null;
};

type Props = {
  courses: CourseOption[];
  classes: ClassOption[];
};

type IntakeMode = "ENROLL_NOW" | "WAITLIST";

const STEPS = [
  { id: "guardian", label: "Phụ huynh" },
  { id: "student", label: "Học viên" },
  { id: "placement", label: "Khóa & lớp" },
  { id: "confirm", label: "Xác nhận" },
] as const;

function formatVnd(amount: number | null | undefined) {
  if (!amount) return "—";
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function formatDate(value: string | null) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function EnrollmentIntakeWizard({ courses, classes }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<null | {
    mode: IntakeMode;
    redirectTo: string;
    guardianPortal: null | { email: string; tempPassword: string };
  }>(null);
  const [form, setForm] = useState({
    mode: "ENROLL_NOW" as IntakeMode,
    guardianName: "",
    contactPhone: "",
    guardianEmail: "",
    createPortalAccount: true,
    guardianRelation: "Mẹ",
    address: "",
    facebookParentName: "",
    facebookLink: "",
    fullName: "",
    gender: "",
    dob: "",
    studentPhone: "",
    source: "",
    meetDate: new Date().toISOString().split("T")[0],
    expectedStartDate: "",
    enrollDate: new Date().toISOString().split("T")[0],
    initialAssessment: "",
    notes: "",
    courseId: "",
    classId: "",
  });

  const filteredClasses = useMemo(() => {
    return classes.filter((item) => !form.courseId || item.courseId === form.courseId);
  }, [classes, form.courseId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === form.courseId) ?? null,
    [courses, form.courseId]
  );

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === form.classId) ?? null,
    [classes, form.classId]
  );

  function patchForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (!form.guardianName.trim() && !form.contactPhone.trim()) {
        return "Cần ít nhất tên phụ huynh hoặc số điện thoại liên hệ.";
      }
      if (form.mode === "ENROLL_NOW" && form.createPortalAccount && !form.guardianEmail.trim()) {
        return "Cần email phụ huynh nếu muốn cấp tài khoản portal ngay trong luồng nhập học.";
      }
    }
    if (step === 1 && !form.fullName.trim()) {
      return "Họ tên học viên là bắt buộc.";
    }
    if (step === 2 && form.mode === "ENROLL_NOW" && !form.classId) {
      return "Phải chọn lớp khi nhập học ngay.";
    }
    if (step === 3 && form.mode === "ENROLL_NOW" && form.createPortalAccount && !form.guardianEmail.trim()) {
      return "Thiếu email phụ huynh để cấp portal.";
    }
    return null;
  }

  function nextStep() {
    const nextError = validateCurrentStep();
    if (nextError) {
      setError(nextError);
      return;
    }
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function previousStep() {
    setStep((prev) => Math.max(prev - 1, 0));
    setError(null);
  }

  async function handleSubmit() {
    const nextError = validateCurrentStep();
    if (nextError) {
      setError(nextError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/leads/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          courseName: selectedCourse?.name ?? selectedClass?.courseName ?? null,
          courseCode: selectedCourse?.code ?? selectedClass?.courseCode ?? null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Không thể hoàn tất đăng ký nhập học.");
      }

      if (result.guardianPortal?.tempPassword) {
        setCompletion({
          mode: result.mode,
          redirectTo: result.redirectTo,
          guardianPortal: result.guardianPortal,
        });
        return;
      }

      router.push(result.redirectTo);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  if (completion) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Hoàn tất intake</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950">
                {completion.mode === "ENROLL_NOW" ? "Đã tạo học viên và cấp portal phụ huynh" : "Đã lưu hồ sơ"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-emerald-800">
                Hãy sao chép ngay thông tin đăng nhập bên dưới để gửi phụ huynh. Sau bước này, hệ thống không hiển thị lại mật khẩu thuần nữa.
              </p>
            </div>
            <button type="button" onClick={() => router.push(completion.redirectTo)} className="btn-primary whitespace-nowrap">
              Tiếp tục tới hồ sơ
            </button>
          </div>
        </div>

        {completion.guardianPortal ? (
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-ink">Thông tin portal phụ huynh</h2>
            <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] p-4 text-sm">
              <p>
                Email đăng nhập: <strong>{completion.guardianPortal.email}</strong>
              </p>
              <p className="mt-2">
                Mật khẩu tạm: <strong className="font-mono">{completion.guardianPortal.tempPassword}</strong>
              </p>
              <p className="mt-2 text-xs text-ink-muted48">
                Phụ huynh sẽ dùng tài khoản này để xem học phí, nhật ký lớp học, lịch học và các nhắc nhở thanh toán.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => router.push(completion.redirectTo)} className="btn-primary">
                Mở hồ sơ vừa tạo
              </button>
              <button type="button" onClick={() => router.push("/guardians")} className="btn-ghost">
                Xem phụ huynh
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-4">
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted48 transition hover:text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại CRM tuyển sinh
        </Link>

        <div className="overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_45%,#60a5fa_100%)] p-6 text-white shadow-[0_30px_80px_-45px_rgba(29,78,216,0.75)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/85">
                Luồng nhập học tự động
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Đăng ký nhập học</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
                  Một luồng duy nhất để tiếp nhận phụ huynh, tạo học viên, xếp lớp, cấp portal và bàn giao sang học phí.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">Khóa khả dụng</p>
                <p className="mt-2 text-2xl font-semibold">{courses.length}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">Lớp đang mở</p>
                <p className="mt-2 text-2xl font-semibold">{classes.length}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">Chuỗi dữ liệu</p>
                <p className="mt-2 text-2xl font-semibold">Lead → Portal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="card space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STEPS.map((item, index) => {
              const isActive = index === step;
              const isDone = index < step;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (index <= step) setStep(index);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-[#e6ebf5] bg-white"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted48">Bước {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{item.label}</p>
                </button>
              );
            })}
          </div>

          {step === 0 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-ink">Thông tin phụ huynh & liên hệ</h2>
                <p className="mt-1 text-sm text-ink-muted48">Hệ thống sẽ tự dò phụ huynh cũ theo số điện thoại để tránh tạo trùng.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-group">
                  <span className="label">Tên phụ huynh</span>
                  <input className="input" value={form.guardianName} onChange={(event) => patchForm("guardianName", event.target.value)} placeholder="Nguyễn Thị A" />
                </label>
                <label className="form-group">
                  <span className="label">Số điện thoại liên hệ</span>
                  <input className="input" value={form.contactPhone} onChange={(event) => patchForm("contactPhone", event.target.value)} placeholder="0912345678" />
                </label>
                <label className="form-group">
                  <span className="label">Email portal phụ huynh</span>
                  <input className="input" type="email" value={form.guardianEmail} onChange={(event) => patchForm("guardianEmail", event.target.value)} placeholder="phuhuynh@email.com" />
                </label>
                <label className="form-group">
                  <span className="label">Quan hệ với học viên</span>
                  <select className="input" value={form.guardianRelation} onChange={(event) => patchForm("guardianRelation", event.target.value)}>
                    <option value="Mẹ">Mẹ</option>
                    <option value="Bố">Bố</option>
                    <option value="Người giám hộ">Người giám hộ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </label>
                <label className="form-group">
                  <span className="label">Nguồn đăng ký</span>
                  <input className="input" value={form.source} onChange={(event) => patchForm("source", event.target.value)} placeholder="Facebook, giới thiệu, đi ngang..." />
                </label>
                <label className="form-group md:col-span-2">
                  <span className="label">Portal phụ huynh</span>
                  <div className="rounded-2xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
                    <label className="flex items-start gap-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[#2563eb]"
                        checked={form.createPortalAccount}
                        onChange={(event) => patchForm("createPortalAccount", event.target.checked)}
                      />
                      <span>
                        Cấp tài khoản portal cho phụ huynh ngay khi hoàn tất nhập học.
                        <span className="mt-1 block text-xs text-ink-muted48">
                          Nên bật để phụ huynh xem nhật ký lớp, công nợ và nhận reminder. Nếu để chế độ chờ xếp lớp, portal sẽ chưa được cấp.
                        </span>
                      </span>
                    </label>
                  </div>
                </label>
                <label className="form-group md:col-span-2">
                  <span className="label">Địa chỉ</span>
                  <textarea className="input min-h-[110px]" value={form.address} onChange={(event) => patchForm("address", event.target.value)} placeholder="Địa chỉ liên hệ của phụ huynh" />
                </label>
                <label className="form-group">
                  <span className="label">Tên Facebook phụ huynh</span>
                  <input className="input" value={form.facebookParentName} onChange={(event) => patchForm("facebookParentName", event.target.value)} placeholder="Tên hiển thị Facebook" />
                </label>
                <label className="form-group">
                  <span className="label">Link Facebook</span>
                  <input className="input" value={form.facebookLink} onChange={(event) => patchForm("facebookLink", event.target.value)} placeholder="https://facebook.com/..." />
                </label>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-ink">Thông tin học viên</h2>
                <p className="mt-1 text-sm text-ink-muted48">Nếu chọn nhập học ngay, lead và học viên sẽ được tạo đồng thời trong cùng một transaction.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-group">
                  <span className="label">Họ và tên học viên *</span>
                  <input className="input" value={form.fullName} onChange={(event) => patchForm("fullName", event.target.value)} placeholder="Nguyễn Minh B" />
                </label>
                <label className="form-group">
                  <span className="label">Giới tính</span>
                  <select className="input" value={form.gender} onChange={(event) => patchForm("gender", event.target.value)}>
                    <option value="">-- Chọn giới tính --</option>
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </label>
                <label className="form-group">
                  <span className="label">Ngày sinh</span>
                  <input type="date" className="input" value={form.dob} onChange={(event) => patchForm("dob", event.target.value)} />
                </label>
                <label className="form-group">
                  <span className="label">Số điện thoại học viên</span>
                  <input className="input" value={form.studentPhone} onChange={(event) => patchForm("studentPhone", event.target.value)} placeholder="Nếu học viên có số riêng" />
                </label>
                <label className="form-group">
                  <span className="label">Ngày tiếp nhận</span>
                  <input type="date" className="input" value={form.meetDate} onChange={(event) => patchForm("meetDate", event.target.value)} />
                </label>
                <label className="form-group">
                  <span className="label">Ngày dự kiến học</span>
                  <input type="date" className="input" value={form.expectedStartDate} onChange={(event) => patchForm("expectedStartDate", event.target.value)} />
                </label>
                <label className="form-group md:col-span-2">
                  <span className="label">Đánh giá đầu vào / nhu cầu</span>
                  <textarea className="input min-h-[110px]" value={form.initialAssessment} onChange={(event) => patchForm("initialAssessment", event.target.value)} placeholder="Mục tiêu học, trình độ, lưu ý chuyên môn..." />
                </label>
                <label className="form-group md:col-span-2">
                  <span className="label">Ghi chú vận hành</span>
                  <textarea className="input min-h-[110px]" value={form.notes} onChange={(event) => patchForm("notes", event.target.value)} placeholder="Lưu ý thêm cho giáo vụ / tuyển sinh / phụ huynh" />
                </label>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-ink">Chọn cách xử lý và xếp lớp</h2>
                <p className="mt-1 text-sm text-ink-muted48">Nếu chưa có lớp phù hợp, vẫn lưu đúng trạng thái đạt điều kiện chờ xếp lớp.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => patchForm("mode", "ENROLL_NOW")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${form.mode === "ENROLL_NOW" ? "border-primary bg-primary/5" : "border-[#e6ebf5] bg-white"}`}
                >
                  <p className="text-sm font-semibold text-ink">Nhập học và ghi danh ngay</p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted48">Tạo lead, học viên, liên kết phụ huynh, portal và enrollment trong cùng một lượt.</p>
                </button>
                <button
                  type="button"
                  onClick={() => patchForm("mode", "WAITLIST")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${form.mode === "WAITLIST" ? "border-amber-300 bg-amber-50" : "border-[#e6ebf5] bg-white"}`}
                >
                  <p className="text-sm font-semibold text-ink">Lưu chờ xếp lớp</p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted48">Chỉ tạo lead ở trạng thái đủ điều kiện để giáo vụ xếp lớp sau.</p>
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-group">
                  <span className="label">Khóa học định hướng</span>
                  <select
                    className="input"
                    value={form.courseId}
                    onChange={(event) => {
                      const nextCourseId = event.target.value;
                      const nextSelectedClass = classes.find((item) => item.id === form.classId);
                      setForm((prev) => ({
                        ...prev,
                        courseId: nextCourseId,
                        classId: nextSelectedClass && nextSelectedClass.courseId === nextCourseId ? prev.classId : "",
                      }));
                      setError(null);
                    }}
                  >
                    <option value="">-- Chọn khóa học --</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        [{course.code}] {course.name} · {formatVnd(course.tuitionPerSession)}/buổi
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-group">
                  <span className="label">Lớp đang mở</span>
                  <select className="input" value={form.classId} onChange={(event) => patchForm("classId", event.target.value)}>
                    <option value="">-- Chọn lớp phù hợp --</option>
                    {filteredClasses.map((item) => (
                      <option key={item.id} value={item.id}>
                        [{item.classCode}] {item.className}
                      </option>
                    ))}
                  </select>
                </label>

                {form.mode === "ENROLL_NOW" ? (
                  <label className="form-group">
                    <span className="label">Ngày nhập học</span>
                    <input type="date" className="input" value={form.enrollDate} onChange={(event) => patchForm("enrollDate", event.target.value)} />
                  </label>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-[#e6ebf5] bg-[#fbfdff] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">Lớp gợi ý đang chọn</p>
                    <p className="mt-1 text-xs text-ink-muted48">Thông tin này sẽ đi thẳng vào lead hoặc enrollment tùy chế độ xử lý.</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {filteredClasses.length} lớp phù hợp
                  </span>
                </div>

                {selectedClass ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#dbe7ff] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Lớp</p>
                      <p className="mt-2 text-base font-semibold text-ink">[{selectedClass.classCode}] {selectedClass.className}</p>
                      <p className="mt-1 text-sm text-ink-muted48">{selectedClass.courseName ?? "Chưa gắn khóa học"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#dbe7ff] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Thông số vận hành</p>
                      <p className="mt-2 text-sm text-ink">Học phí: <strong>{formatVnd(selectedClass.tuitionPerSession)}</strong></p>
                      <p className="mt-1 text-sm text-ink">Buổi/tuần: <strong>{selectedClass.sessionsPerWeek ?? "—"}</strong></p>
                      <p className="mt-1 text-sm text-ink">Đang học: <strong>{selectedClass.activeEnrollments}</strong></p>
                      <p className="mt-1 text-sm text-ink">Khai giảng: <strong>{formatDate(selectedClass.startDate)}</strong></p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-[#d7deeb] bg-white px-4 py-6 text-sm text-ink-muted48">
                    Chưa chọn lớp. Nếu để chế độ chờ xếp lớp, hệ thống sẽ tạo lead đủ điều kiện và giáo vụ tiếp tục xử lý sau.
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-ink">Xác nhận thao tác tự động</h2>
                <p className="mt-1 text-sm text-ink-muted48">Luồng này chốt đúng quan hệ thực tế: lead, phụ huynh, học viên, lớp, portal và học phí.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#e6ebf5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Phụ huynh</p>
                  <p className="mt-2 text-base font-semibold text-ink">{form.guardianName || "Chưa nhập tên"}</p>
                  <p className="mt-1 text-sm text-ink-muted48">{form.contactPhone || "Chưa có số điện thoại"}</p>
                  <p className="mt-1 text-sm text-ink-muted48">{form.guardianEmail || "Chưa có email portal"}</p>
                  <p className="mt-1 text-sm text-ink-muted48">{form.guardianRelation}</p>
                </div>
                <div className="rounded-2xl border border-[#e6ebf5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Học viên</p>
                  <p className="mt-2 text-base font-semibold text-ink">{form.fullName || "Chưa nhập tên"}</p>
                  <p className="mt-1 text-sm text-ink-muted48">{form.dob ? formatDate(form.dob) : "Chưa có ngày sinh"}</p>
                  <p className="mt-1 text-sm text-ink-muted48">{form.initialAssessment || "Chưa có đánh giá đầu vào"}</p>
                </div>
                <div className="rounded-2xl border border-[#e6ebf5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Xử lý hệ thống</p>
                  <ul className="mt-2 space-y-2 text-sm text-ink">
                    <li>• Tạo hoặc tái dùng phụ huynh theo số điện thoại</li>
                    <li>• Tạo lead và lưu nguồn, đánh giá đầu vào</li>
                    {form.mode === "ENROLL_NOW" ? (
                      <>
                        <li>• Tạo học viên chính thức</li>
                        <li>• Liên kết phụ huynh - học viên</li>
                        <li>• Ghi danh vào lớp đã chọn</li>
                        {form.createPortalAccount ? <li>• Cấp portal phụ huynh và sinh mật khẩu tạm</li> : null}
                      </>
                    ) : (
                      <li>• Đưa lead vào trạng thái chờ xếp lớp</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-2xl border border-[#e6ebf5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Đích sau khi lưu</p>
                  <p className="mt-2 text-sm text-ink">
                    {form.mode === "ENROLL_NOW"
                      ? "Đi tới trang chi tiết học viên mới tạo để tiếp tục học phí, hồ sơ và theo dõi vận hành."
                      : "Đi tới trang chi tiết lead để giáo vụ tiếp tục xếp lớp."}
                  </p>
                  <p className="mt-2 text-sm text-ink-muted48">
                    {selectedClass ? `Lớp chọn: [${selectedClass.classCode}] ${selectedClass.className}` : "Chưa gắn lớp cụ thể."}
                  </p>
                  {form.mode === "ENROLL_NOW" && form.createPortalAccount ? (
                    <p className="mt-2 text-sm text-ink-muted48">Portal phụ huynh: {form.guardianEmail || "Thiếu email — cần bổ sung"}</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-[#edf1f7] pt-5">
            <button type="button" onClick={previousStep} disabled={step === 0 || submitting} className="btn-ghost disabled:opacity-50">
              Quay lại
            </button>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => router.push("/leads")} className="btn-ghost" disabled={submitting}>
                Hủy
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={nextStep} className="btn-primary" disabled={submitting}>
                  Tiếp tục
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} className="btn-primary" disabled={submitting}>
                  {submitting ? "Đang xử lý..." : form.mode === "ENROLL_NOW" ? "Hoàn tất nhập học" : "Lưu chờ xếp lớp"}
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Logic thực tế</p>
            <ul className="mt-3 space-y-3 text-sm text-ink">
              <li>• Lead là vết gốc để CRM, báo cáo và truy nguyên lịch sử tuyển sinh.</li>
              <li>• Phụ huynh là đầu mối nhận hóa đơn, nhắc học phí và xem portal.</li>
              <li>• Học viên là đối tượng học thật, nhận nhật ký lớp và điểm danh.</li>
              <li>• Enrollment nối học viên với lớp; học phí và attendance bám vào đây.</li>
            </ul>
          </div>

          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Khuyến nghị</p>
            <ul className="mt-3 space-y-3 text-sm text-ink-muted80">
              <li>• Khi phụ huynh đã chốt học, nên cấp portal ngay tại intake để khỏi quên.</li>
              <li>• Nếu chưa chốt lớp, chỉ giữ lead; tránh cấp portal cho tài khoản chưa có học viên liên kết.</li>
              <li>• Sau khi tạo xong, bàn giao thẳng sang hồ sơ học viên để xử lý học phí đầu kỳ.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
