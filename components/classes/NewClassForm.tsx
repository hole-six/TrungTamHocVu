"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SmartForm, { FormSection } from "@/components/ui/SmartForm/SmartForm";

type Course = {
  id: string;
  code: string;
  name: string;
  tuitionPerSession: number;
  sessionsPerWeek: number;
};

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

export default function NewClassForm({ courses }: { courses: Course[] }) {
  const router = useRouter();

  const sections: FormSection[] = [
    {
      title: "Thông tin nhận diện lớp",
      description: "Khai báo mã lớp, tên lớp và nhóm lớp để đồng bộ cho mọi màn vận hành.",
      fields: [
        {
          name: "classCode",
          label: "Mã lớp",
          type: "text",
          required: true,
          placeholder: "VD: FF3-2026-SANG",
        },
        {
          name: "className",
          label: "Tên lớp",
          type: "text",
          required: true,
          placeholder: "VD: First Friends 3 - Sáng T2/T4",
        },
        {
          name: "classGroup",
          label: "Nhóm lớp",
          type: "text",
          placeholder: "VD: Thiếu nhi, Starters, Kèm riêng",
        },
      ],
    },
    {
      title: "Khóa học và học phí",
      description: "Map lớp với khóa chuẩn để ERP tự điền học phí và số buổi mỗi tuần.",
      fields: [
        {
          name: "courseId",
          label: "Khóa học",
          type: "select",
          options: [
            { value: "", label: "Nhập tay / chưa gắn khóa" },
            ...courses.map((course) => ({
              value: course.id,
              label: `[${course.code}] ${course.name} · ${formatVnd(course.tuitionPerSession)}/buổi`,
            })),
          ],
          description: "Khi chọn khóa học, hệ thống tự điền học phí/buổi và số buổi/tuần theo cấu hình master.",
          onChange: (courseId) => {
            const selectedCourse = courses.find((course) => course.id === courseId);
            if (!selectedCourse) {
              return undefined;
            }

            return {
              tuitionPerSession: selectedCourse.tuitionPerSession,
              sessionsPerWeek: selectedCourse.sessionsPerWeek,
            };
          },
        },
        {
          name: "tuitionPerSession",
          label: "Học phí / buổi",
          type: "number",
          placeholder: "170000",
          min: 0,
        },
        {
          name: "sessionsPerWeek",
          label: "Số buổi / tuần",
          type: "number",
          placeholder: "2",
          min: 1,
          max: 7,
        },
      ],
    },
    {
      title: "Tiến độ triển khai",
      description: "Khai báo mốc mở lớp để liên kết lịch học, sĩ số và báo cáo doanh thu.",
      fields: [
        {
          name: "totalSessions",
          label: "Tổng số buổi",
          type: "number",
          placeholder: "48",
          min: 1,
        },
        {
          name: "startDate",
          label: "Ngày khai giảng",
          type: "date",
        },
        {
          name: "notes",
          label: "Ghi chú nội bộ",
          type: "textarea",
          rows: 4,
          colSpan: 2,
          placeholder: "Cam kết với phụ huynh, lưu ý vận hành, phòng học, giáo viên phụ trách...",
        },
      ],
    },
  ];

  async function handleSubmit(data: Record<string, any>) {
    const payload = {
      classCode: data.classCode,
      className: data.className,
      classGroup: data.classGroup || null,
      courseId: data.courseId || null,
      totalSessions: data.totalSessions === "" ? null : data.totalSessions,
      startDate: data.startDate || null,
      tuitionPerSession: data.tuitionPerSession === "" ? null : data.tuitionPerSession,
      sessionsPerWeek: data.sessionsPerWeek === "" ? null : data.sessionsPerWeek,
      notes: data.notes || null,
    };

    const response = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? "Không thể tạo lớp học.");
    }

    router.push(`/classes/${result.item.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-4">
        <Link
          href="/classes"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted48 transition hover:text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại quản lý lớp học
        </Link>

        <div className="overflow-hidden rounded-[32px] border border-[#dbe7ff] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_45%,#60a5fa_100%)] p-6 text-white shadow-[0_30px_80px_-45px_rgba(29,78,216,0.75)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/85">
                ERP vận hành lớp
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Khởi tạo lớp học mới</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/80 sm:text-base">
                  Tạo lớp theo đúng cấu trúc ERP: nhận diện lớp, liên kết khóa học, học phí và các mốc vận hành để dữ liệu luôn khớp nhau.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">Khóa khả dụng</p>
                <p className="mt-2 text-2xl font-semibold">{courses.length}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">Map tự động</p>
                <p className="mt-2 text-2xl font-semibold">Học phí</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">Sẵn sàng</p>
                <p className="mt-2 text-2xl font-semibold">Vận hành</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SmartForm
        sections={sections}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/classes")}
        submitLabel="Tạo lớp học"
        cancelLabel="Hủy"
      />
    </div>
  );
}
