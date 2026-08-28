"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatVnd as formatVndBase } from "@/lib/export-utils";
import BackButton from "@/components/ui/BackButton";

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
  totalSessions: number | null;
  activeEnrollments: number;
  startDate: string | null;
};

type ExistingStudentOption = {
  id: string;
  fullName: string;
  studentCode: string;
  phone: string | null;
  currentClasses: Array<{
    className: string;
    classCode: string;
  }>;
};

type Props = {
  courses: CourseOption[];
  classes: ClassOption[];
  students: ExistingStudentOption[];
};

type IntakeMode = "ENROLL_NOW" | "WAITLIST";
type StudentTarget = "NEW_STUDENT" | "EXISTING_STUDENT";

const STEPS = [
  { id: "guardian", label: "Phụ huynh" },
  { id: "student", label: "Học viên" },
  { id: "placement", label: "Khóa & lớp" },
  { id: "confirm", label: "Xác nhận" },
] as const;

function formatVnd(amount: number | null | undefined) {
  return amount == null ? "—" : formatVndBase(amount);
}

function formatDate(value: string | null) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleDateString("vi-VN");
}

function todayInVietnam() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function EnrollmentIntakeWizard({ courses, classes, students }: Props) {
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
    studentTarget: "NEW_STUDENT" as StudentTarget,
    existingStudentId: "",
    guardianName: "",
    contactPhone: "",
    guardianEmail: "",
    createPortalAccount: false,
    guardianRelation: "Mẹ",
    address: "",
    facebookParentName: "",
    facebookLink: "",
    fullName: "",
    gender: "",
    dob: "",
    studentPhone: "",
    source: "",
    meetDate: todayInVietnam(),
    expectedStartDate: "",
    enrollDate: todayInVietnam(),
    initialAssessment: "",
    notes: "",
    courseId: "",
    classId: "",
    scholarshipPercent: "",
    scholarshipReason: "",
  });

  const filteredClasses = useMemo(() => classes.filter((item) => !form.courseId || item.courseId === form.courseId), [classes, form.courseId]);
  const selectedCourse = useMemo(() => courses.find((course) => course.id === form.courseId) ?? null, [courses, form.courseId]);
  const selectedClass = useMemo(() => classes.find((item) => item.id === form.classId) ?? null, [classes, form.classId]);
  const selectedExistingStudent = useMemo(
    () => students.find((student) => student.id === form.existingStudentId) ?? null,
    [students, form.existingStudentId],
  );

  const estimatedTuition = useMemo(() => {
    if (!selectedClass?.tuitionPerSession || !selectedClass.totalSessions) return null;
    return selectedClass.tuitionPerSession * selectedClass.totalSessions;
  }, [selectedClass]);

  const scholarshipPercentNumber = form.scholarshipPercent ? Number(form.scholarshipPercent) : 0;
  const estimatedDiscount = estimatedTuition ? Math.round((estimatedTuition * scholarshipPercentNumber) / 100) : 0;
  const estimatedNetTuition = estimatedTuition != null ? estimatedTuition - estimatedDiscount : null;

  function patchForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function syncExistingStudent(studentId: string) {
    const student = students.find((item) => item.id === studentId) ?? null;
    setForm((prev) => ({
      ...prev,
      existingStudentId: studentId,
      fullName: student?.fullName ?? prev.fullName,
      studentPhone: student?.phone ?? prev.studentPhone,
      createPortalAccount: studentId ? false : prev.createPortalAccount,
    }));
    setError(null);
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (form.studentTarget === "EXISTING_STUDENT" && form.createPortalAccount) {
        return "Học viên đã có sẵn không cấp portal từ intake này. Portal nên quản lý ở hồ sơ phụ huynh hiện tại.";
      }
      if (form.mode === "ENROLL_NOW" && form.createPortalAccount && !form.guardianEmail.trim()) {
        return "Cần email phụ huynh nếu muốn cấp tài khoản portal ngay trong luồng nhập học.";
      }
    }
    if (step === 1) {
      if (form.studentTarget === "NEW_STUDENT" && !form.fullName.trim()) {
        return "Họ tên học viên là bắt buộc.";
      }
      if (form.studentTarget === "EXISTING_STUDENT" && !form.existingStudentId) {
        return "Cần chọn học viên đã có sẵn nếu đang làm hồ sơ học thêm lớp.";
      }
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
          fullName: form.studentTarget === "EXISTING_STUDENT" ? selectedExistingStudent?.fullName ?? form.fullName : form.fullName,
          studentPhone: form.studentTarget === "EXISTING_STUDENT" ? selectedExistingStudent?.phone ?? form.studentPhone : form.studentPhone,
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
      <div className="page-shell page-shell-form">
        <div className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Hoàn tất intake</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950">
                {completion.mode === "ENROLL_NOW" ? "Đã tạo hồ sơ và cấp portal phụ huynh" : "Đã lưu hồ sơ chờ xếp lớp"}
              </h1>
            </div>
            <button type="button" onClick={() => router.push(completion.redirectTo)} className="btn-primary whitespace-nowrap">
              Tiếp tục tới hồ sơ
            </button>
          </div>
        </div>

        {completion.guardianPortal ? (
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-ink">Thông tin portal phụ huynh</h2>
            <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm">
              <p>Email đăng nhập: <strong>{completion.guardianPortal.email}</strong></p>
              <p className="mt-2">Mật khẩu tạm: <strong className="font-mono">{completion.guardianPortal.tempPassword}</strong></p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page-shell page-shell-wide">
      <div className="space-y-4">
        <BackButton href="/leads" className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted48 transition hover:text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại CRM tuyển sinh
        </BackButton>

        <div className="overflow-hidden rounded-[32px] border-2 border-[#fed7aa] bg-gradient-to-r from-[#fff7ed] via-[#ffedd5] to-[#fed7aa] p-6 shadow-lg">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex w-fit rounded-full border-2 border-[#ea580c] bg-[#ea580c] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-white">
                Luồng nhập học tự động
              </span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">Đăng ký nhập học</h1>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#78716c] sm:text-base">
                  Một luồng duy nhất để tiếp nhận phụ huynh, tạo học viên mới hoặc ghi danh thêm lớp cho học viên đang học,
                  gắn lớp phù hợp và bàn giao sang học phí.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border-2 border-[#fed7aa] bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a16207]">Khóa khả dụng</p>
                <p className="mt-2 text-2xl font-black text-[#f97316]">{courses.length}</p>
              </div>
              <div className="rounded-2xl border-2 border-[#fed7aa] bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a16207]">Lớp đang mở</p>
                <p className="mt-2 text-2xl font-black text-[#f97316]">{classes.length}</p>
              </div>
              <div className="rounded-2xl border-2 border-[#fed7aa] bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a16207]">HV đang học</p>
                <p className="mt-2 text-2xl font-black text-[#f97316]">{students.length}</p>
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
                    isActive ? "border-primary bg-primary/5 shadow-sm" : isDone ? "border-emerald-200 bg-emerald-50" : "border-[#e6ebf5] bg-white"
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
                <p className="mt-1 text-sm text-ink-muted48">Nếu đây là học viên đã có sẵn, bạn có thể chỉ bổ sung phần liên hệ còn thiếu và ghi danh thêm lớp ở bước sau.</p>
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
                  <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3">
                    <label className="flex items-start gap-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[#f97316]"
                        checked={form.createPortalAccount}
                        disabled={form.studentTarget === "EXISTING_STUDENT"}
                        onChange={(event) => patchForm("createPortalAccount", event.target.checked)}
                      />
                      <span>
                        Cấp tài khoản portal cho phụ huynh ngay khi hoàn tất.
                        <span className="mt-1 block text-xs text-ink-muted48">
                          Với học viên đã có sẵn, intake này không cấp portal mới mà dùng luồng hồ sơ phụ huynh hiện tại để tránh trùng tài khoản.
                        </span>
                      </span>
                    </label>
                  </div>
                </label>
                <label className="form-group md:col-span-2">
                  <span className="label">Địa chỉ</span>
                  <textarea className="input min-h-[110px]" value={form.address} onChange={(event) => patchForm("address", event.target.value)} placeholder="Địa chỉ liên hệ của phụ huynh" />
                </label>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-ink">Xác định học viên</h2>
                <p className="mt-1 text-sm text-ink-muted48">Phân biệt rõ học viên mới với học viên đang học muốn học thêm để tránh tạo hồ sơ trùng.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => patchForm("studentTarget", "NEW_STUDENT")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${form.studentTarget === "NEW_STUDENT" ? "border-primary bg-primary/5" : "border-[#e6ebf5] bg-white"}`}
                >
                  <p className="text-sm font-semibold text-ink">Học viên mới</p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted48">Tạo mới đầy đủ lead + học viên + ghi danh.</p>
                </button>
                <button
                  type="button"
                  onClick={() => patchForm("studentTarget", "EXISTING_STUDENT")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${form.studentTarget === "EXISTING_STUDENT" ? "border-amber-300 bg-amber-50" : "border-[#e6ebf5] bg-white"}`}
                >
                  <p className="text-sm font-semibold text-ink">Học viên đã có sẵn</p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted48">Dùng khi học viên đang học rồi nhưng cần vào thêm lớp mới.</p>
                </button>
              </div>

              {form.studentTarget === "EXISTING_STUDENT" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="form-group md:col-span-2">
                    <span className="label">Chọn học viên có sẵn</span>
                    <select className="input" value={form.existingStudentId} onChange={(event) => syncExistingStudent(event.target.value)}>
                      <option value="">-- Chọn học viên đang có trong hệ thống --</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          [{student.studentCode}] {student.fullName}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedExistingStudent ? (
                    <div className="rounded-[24px] border border-[#fed7aa] bg-[#fff7ed] p-4 md:col-span-2">
                      <p className="text-sm font-semibold text-ink">{selectedExistingStudent.fullName}</p>
                      <p className="mt-1 text-sm text-ink-muted48">{selectedExistingStudent.studentCode} · {selectedExistingStudent.phone ?? "Chưa có SĐT riêng"}</p>
                      <p className="mt-2 text-xs text-ink-muted48">
                        Lớp hiện có:
                        {" "}
                        {selectedExistingStudent.currentClasses.length
                          ? selectedExistingStudent.currentClasses.map((item) => `[${item.classCode}] ${item.className}`).join(" · ")
                          : "Chưa có lớp đang hoạt động"}
                      </p>
                    </div>
                  ) : null}

                  <label className="form-group">
                    <span className="label">Ngày tiếp nhận</span>
                    <input type="date" className="input" value={form.meetDate} onChange={(event) => patchForm("meetDate", event.target.value)} />
                  </label>
                  <label className="form-group">
                    <span className="label">Ngày dự kiến học thêm</span>
                    <input type="date" className="input" value={form.expectedStartDate} onChange={(event) => patchForm("expectedStartDate", event.target.value)} />
                  </label>
                  <label className="form-group md:col-span-2">
                    <span className="label">Ghi chú nhu cầu học thêm</span>
                    <textarea className="input min-h-[110px]" value={form.notes} onChange={(event) => patchForm("notes", event.target.value)} placeholder="VD: muốn học thêm writing, đổi khung giờ khác, học song song 2 lớp..." />
                  </label>
                </div>
              ) : (
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
              )}
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-ink">Chọn cách xử lý và gắn lớp</h2>
                <p className="mt-1 text-sm text-ink-muted48">Lead ban đầu có thể chưa gắn lớp. Chỉ khi nhập học ngay mới bắt buộc chốt lớp để tính học phí và tạo enrollment.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => patchForm("mode", "ENROLL_NOW")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${form.mode === "ENROLL_NOW" ? "border-primary bg-primary/5" : "border-[#e6ebf5] bg-white"}`}
                >
                  <p className="text-sm font-semibold text-ink">Nhập học và ghi danh ngay</p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted48">Dùng khi đã chốt lớp cụ thể và muốn đẩy thẳng sang hồ sơ học viên.</p>
                </button>
                <button
                  type="button"
                  onClick={() => patchForm("mode", "WAITLIST")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${form.mode === "WAITLIST" ? "border-amber-300 bg-amber-50" : "border-[#e6ebf5] bg-white"}`}
                >
                  <p className="text-sm font-semibold text-ink">Lưu chờ xếp lớp</p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted48">Dùng cho nhu cầu ban đầu khi phụ huynh chưa chốt lớp phù hợp.</p>
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
                    <option value="">-- Có thể để trống nếu mới là lead ban đầu --</option>
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

                {form.mode === "ENROLL_NOW" ? (
                  <>
                    <label className="form-group">
                      <span className="label">Học bổng (%)</span>
                      <input type="number" min="0" max="100" step="1" className="input" value={form.scholarshipPercent} onChange={(event) => patchForm("scholarshipPercent", event.target.value)} placeholder="Để trống nếu không có" />
                    </label>
                    {form.scholarshipPercent ? (
                      <label className="form-group">
                        <span className="label">Lý do học bổng</span>
                        <input className="input" value={form.scholarshipReason} onChange={(event) => patchForm("scholarshipReason", event.target.value)} placeholder="VD: ưu đãi khai giảng, học sinh giỏi..." />
                      </label>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-[#e6ebf5] bg-[#fbfdff] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">Thông tin lớp đang chọn</p>
                    <p className="mt-1 text-xs text-ink-muted48">Dùng để tính học phí ước tính cho từng học viên nếu đã chốt lớp.</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{filteredClasses.length} lớp phù hợp</span>
                </div>

                {selectedClass ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#fed7aa] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Lớp</p>
                      <p className="mt-2 text-base font-semibold text-ink">[{selectedClass.classCode}] {selectedClass.className}</p>
                      <p className="mt-1 text-sm text-ink-muted48">{selectedClass.courseName ?? "Chưa gắn khóa học"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#fed7aa] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Cách tính tiền</p>
                      <p className="mt-2 text-sm text-ink">Học phí / buổi: <strong>{formatVnd(selectedClass.tuitionPerSession)}</strong></p>
                      <p className="mt-1 text-sm text-ink">Tổng buổi khóa: <strong>{selectedClass.totalSessions ?? "—"}</strong></p>
                      <p className="mt-1 text-sm text-ink">Tạm tính toàn khóa: <strong>{formatVnd(estimatedTuition)}</strong></p>
                      {scholarshipPercentNumber > 0 ? <p className="mt-1 text-sm text-ink">Sau học bổng: <strong>{formatVnd(estimatedNetTuition)}</strong></p> : null}
                      <p className="mt-2 text-xs text-ink-muted48">
                        Công thức đang nhìn ở đây là {formatVnd(selectedClass.tuitionPerSession)} × {selectedClass.totalSessions ?? "—"} buổi.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-[#d7deeb] bg-white px-4 py-6 text-sm text-ink-muted48">
                    Chưa gắn lớp. Đây vẫn là hợp lệ nếu bạn chỉ đang ghi nhận nhu cầu ban đầu ở CRM và sẽ xếp lớp sau.
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-ink">Xác nhận luồng nghiệp vụ</h2>
                <p className="mt-1 text-sm text-ink-muted48">Kiểm tra lại đúng kiểu hồ sơ trước khi lưu để tránh trùng học viên hoặc gắn sai lớp.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#e6ebf5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Phụ huynh</p>
                  <p className="mt-2 text-base font-semibold text-ink">{form.guardianName || "Chưa nhập tên"}</p>
                  <p className="mt-1 text-sm text-ink-muted48">{form.contactPhone || "Chưa có số điện thoại"}</p>
                  <p className="mt-1 text-sm text-ink-muted48">{form.guardianEmail || "Chưa có email portal"}</p>
                </div>
                <div className="rounded-2xl border border-[#e6ebf5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Học viên</p>
                  {form.studentTarget === "EXISTING_STUDENT" ? (
                    <>
                      <p className="mt-2 text-base font-semibold text-ink">{selectedExistingStudent?.fullName || "Chưa chọn học viên"}</p>
                      <p className="mt-1 text-sm text-ink-muted48">{selectedExistingStudent?.studentCode ?? "Chưa có mã"}</p>
                      <p className="mt-1 text-sm text-ink-muted48">Luồng này sẽ không tạo hồ sơ học viên mới, chỉ thêm enrollment nếu nhập học ngay.</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-base font-semibold text-ink">{form.fullName || "Chưa nhập tên"}</p>
                      <p className="mt-1 text-sm text-ink-muted48">{form.dob ? formatDate(form.dob) : "Chưa có ngày sinh"}</p>
                      <p className="mt-1 text-sm text-ink-muted48">{form.initialAssessment || "Chưa có đánh giá đầu vào"}</p>
                    </>
                  )}
                </div>
                <div className="rounded-2xl border border-[#e6ebf5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Xử lý hệ thống</p>
                  <ul className="mt-2 space-y-2 text-sm text-ink">
                    <li>• Luôn tạo 1 lead để giữ vết CRM.</li>
                    {form.studentTarget === "NEW_STUDENT" ? <li>• Tạo học viên mới nếu bạn chọn nhập học ngay.</li> : <li>• Dùng lại học viên hiện có, không tạo trùng hồ sơ.</li>}
                    {form.mode === "ENROLL_NOW" ? <li>• Tạo enrollment gắn vào lớp đã chọn.</li> : <li>• Chỉ lưu nhu cầu, chưa phát sinh enrollment.</li>}
                    {form.createPortalAccount ? <li>• Cấp portal phụ huynh ngay sau khi hoàn tất.</li> : null}
                  </ul>
                </div>
                <div className="rounded-2xl border border-[#e6ebf5] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted48">Tính tiền hiện tại</p>
                  <p className="mt-2 text-sm text-ink">
                    {selectedClass ? (
                      <>
                        Học phí đang lấy theo lớp: <strong>{formatVnd(selectedClass.tuitionPerSession)}</strong>/buổi × <strong>{selectedClass.totalSessions ?? "—"}</strong> buổi
                      </>
                    ) : (
                      "Chưa chốt lớp nên chưa chốt tiền cho học viên."
                    )}
                  </p>
                  {selectedClass ? <p className="mt-2 text-sm text-ink-muted48">Tạm tính: {formatVnd(estimatedTuition)}{scholarshipPercentNumber > 0 ? ` · sau học bổng còn ${formatVnd(estimatedNetTuition)}` : ""}</p> : null}
                  {!selectedClass ? <p className="mt-2 text-sm text-amber-700">Lead chưa có lớp chỉ là nhu cầu quan tâm, chưa phải hồ sơ học phí.</p> : null}
                </div>
              </div>
            </section>
          ) : null}

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Phân biệt 2 nơi</p>
            <ul className="mt-3 space-y-3 text-sm text-ink">
              <li>• `Lead` là nhu cầu ban đầu, có thể chưa gắn lớp.</li>
              <li>• `Enrollment` mới là gắn học viên vào lớp thật để sinh attendance và học phí.</li>
              <li>• Học viên đang học mà muốn học thêm thì vẫn nên đi qua intake này ở chế độ học viên có sẵn.</li>
            </ul>
          </div>

          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Cách tính tiền</p>
            <ul className="mt-3 space-y-3 text-sm text-ink-muted80">
              <li>• Nếu chưa chốt lớp, hệ thống chưa chốt tiền vì chưa có đơn giá và tổng buổi cụ thể.</li>
              <li>• Khi đã chọn lớp, tiền đang lấy theo `học phí/buổi × tổng số buổi của lớp`.</li>
              <li>• Học bổng nếu có sẽ trừ trực tiếp trên tổng ước tính để nhân sự nhìn ra ngay.</li>
            </ul>
          </div>

          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Khi nào dùng nhánh nào</p>
            <ul className="mt-3 space-y-3 text-sm text-ink-muted80">
              <li>• `Lưu chờ xếp lớp`: phụ huynh mới hỏi, chưa biết vào lớp nào, chưa nên chốt tiền.</li>
              <li>• `Nhập học ngay`: đã chọn lớp cụ thể, lúc đó mới nên xem preview học phí và tạo enrollment.</li>
              <li>• `Học viên đã có sẵn`: dùng khi học viên đang học rồi nhưng muốn học thêm lớp mới, không tạo trùng hồ sơ học viên.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
