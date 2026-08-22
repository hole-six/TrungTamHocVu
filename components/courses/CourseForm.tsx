"use client";

import { useState } from "react";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { formatVnd } from "@/lib/export-utils";

type CourseLevel = "BEGINNER" | "ELEMENTARY" | "INTERMEDIATE" | "ADVANCED" | "PROFICIENCY";
type CourseType = "REGULAR" | "INTENSIVE" | "PRIVATE" | "ONLINE" | "HYBRID";

type CourseFormData = {
  courseCode: string;
  courseName: string;
  courseNameEn?: string;
  level: CourseLevel;
  type: CourseType;
  description?: string;
  duration: number; // total hours
  sessionsPerWeek: number;
  minutesPerSession: number;
  maxStudents: number;
  minStudents: number;
  tuitionPerSession: number;
  bookFee?: number;
  materialFee?: number;
  totalFee: number;
  curriculum?: string;
  objectives?: string;
  prerequisites?: string;
  isActive: boolean;
};

type CourseFormProps = {
  course?: Partial<CourseFormData> & { id?: string };
  onSubmit: (data: CourseFormData) => Promise<void>;
  onCancel: () => void;
  mode?: "create" | "edit";
};

const COURSE_LEVELS = [
  { value: "BEGINNER", label: "🌱 Khởi đầu", color: "from-green-400 to-emerald-500" },
  { value: "ELEMENTARY", label: "🌿 Cơ bản", color: "from-lime-400 to-green-500" },
  { value: "INTERMEDIATE", label: "🌳 Trung cấp", color: "from-yellow-400 to-orange-500" },
  { value: "ADVANCED", label: "🎯 Nâng cao", color: "from-orange-500 to-red-500" },
  { value: "PROFICIENCY", label: "👑 Thành thạo", color: "from-purple-500 to-pink-600" },
];

const COURSE_TYPES = [
  { value: "REGULAR", label: "📚 Thường quy", icon: "📚" },
  { value: "INTENSIVE", label: "⚡ Cấp tốc", icon: "⚡" },
  { value: "PRIVATE", label: "👤 Kèm riêng", icon: "👤" },
  { value: "ONLINE", label: "💻 Trực tuyến", icon: "💻" },
  { value: "HYBRID", label: "🔄 Kết hợp", icon: "🔄" },
];

export default function CourseForm({ course, onSubmit, onCancel, mode = "create" }: CourseFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CourseFormData>({
    courseCode: course?.courseCode || "",
    courseName: course?.courseName || "",
    courseNameEn: course?.courseNameEn || "",
    level: course?.level || "BEGINNER",
    type: course?.type || "REGULAR",
    description: course?.description || "",
    duration: course?.duration || 60,
    sessionsPerWeek: course?.sessionsPerWeek || 2,
    minutesPerSession: course?.minutesPerSession || 90,
    maxStudents: course?.maxStudents || 15,
    minStudents: course?.minStudents || 5,
    tuitionPerSession: course?.tuitionPerSession || 150000,
    bookFee: course?.bookFee || 0,
    materialFee: course?.materialFee || 0,
    totalFee: course?.totalFee || 0,
    curriculum: course?.curriculum || "",
    objectives: course?.objectives || "",
    prerequisites: course?.prerequisites || "",
    isActive: course?.isActive !== false,
  });

  // Auto-calculate total fee
  const calculateTotalFee = () => {
    const totalSessions = Math.ceil(formData.duration / (formData.minutesPerSession / 60));
    const tuitionTotal = totalSessions * formData.tuitionPerSession;
    const total = tuitionTotal + (formData.bookFee || 0) + (formData.materialFee || 0);
    setFormData({ ...formData, totalFee: total });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.courseCode || !formData.courseName) {
      alert("Vui lòng điền đầy đủ mã khóa học và tên");
      return;
    }

    if (formData.minStudents > formData.maxStudents) {
      alert("Số học viên tối thiểu không được lớn hơn tối đa");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  const totalSessions = Math.ceil(formData.duration / (formData.minutesPerSession / 60));
  const estimatedWeeks = Math.ceil(totalSessions / formData.sessionsPerWeek);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {mode === "create" ? "➕ Thêm chương trình học mới" : "✏️ Chỉnh sửa chương trình"}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {mode === "create" ? "Tạo chương trình học mới cho trung tâm" : "Cập nhật thông tin chương trình"}
        </p>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Mã khóa học *</label>
            <input
              type="text"
              value={formData.courseCode}
              onChange={(e) => setFormData({ ...formData, courseCode: e.target.value.toUpperCase() })}
              className="input font-mono"
              placeholder="VD: ENG101, MATH01"
              required
              disabled={mode === "edit"}
            />
            {mode === "edit" && (
              <p className="form-hint">Mã khóa học không thể thay đổi</p>
            )}
          </div>

          <div className="form-group">
            <label className="label">Tên khóa học (Tiếng Việt) *</label>
            <input
              type="text"
              value={formData.courseName}
              onChange={(e) => setFormData({ ...formData, courseName: e.target.value })}
              className="input"
              placeholder="VD: Tiếng Anh Giao Tiếp Cơ Bản"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="label">Tên khóa học (Tiếng Anh)</label>
          <input
            type="text"
            value={formData.courseNameEn}
            onChange={(e) => setFormData({ ...formData, courseNameEn: e.target.value })}
            className="input"
            placeholder="VD: Basic English Communication"
          />
        </div>
      </div>

      {/* Level Selection */}
      <div className="form-group">
        <label className="label">Trình độ *</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {COURSE_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setFormData({ ...formData, level: level.value as CourseLevel })}
              className={`relative overflow-hidden rounded-xl border-2 p-3 text-center transition-all ${
                formData.level === level.value
                  ? "border-primary shadow-md scale-[1.05]"
                  : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
              }`}
            >
              {formData.level === level.value && (
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ background: `linear-gradient(135deg, ${level.color})` }}
                />
              )}
              <div className="relative">
                <p
                  className={`font-semibold text-sm ${
                    formData.level === level.value ? "text-primary" : ""
                  }`}
                  style={{ color: formData.level === level.value ? undefined : "var(--text-primary)" }}
                >
                  {level.label}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Type Selection */}
      <div className="form-group">
        <label className="label">Hình thức học *</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {COURSE_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFormData({ ...formData, type: type.value as CourseType })}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all ${
                formData.type === type.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
              }`}
            >
              <span className="text-2xl">{type.icon}</span>
              <span
                className={`text-xs font-semibold ${
                  formData.type === type.value ? "text-primary" : ""
                }`}
                style={{ color: formData.type === type.value ? undefined : "var(--text-secondary)" }}
              >
                {type.label.replace(/^[^\s]+ /, "")}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Duration & Schedule */}
      <div className="space-y-4">
        <label className="label">Thời lượng & Lịch học</label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="form-group">
            <label className="label-sm">Tổng số giờ học *</label>
            <div className="relative">
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                onBlur={calculateTotalFee}
                className="input"
                min="1"
                step="1"
                required
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                giờ
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="label-sm">Số buổi/tuần *</label>
            <input
              type="number"
              value={formData.sessionsPerWeek}
              onChange={(e) => setFormData({ ...formData, sessionsPerWeek: Number(e.target.value) })}
              className="input"
              min="1"
              max="7"
              required
            />
          </div>

          <div className="form-group">
            <label className="label-sm">Phút/buổi *</label>
            <select
              value={formData.minutesPerSession}
              onChange={(e) => setFormData({ ...formData, minutesPerSession: Number(e.target.value) })}
              onBlur={calculateTotalFee}
              className="input"
              required
            >
              <option value="45">45 phút</option>
              <option value="60">60 phút (1 giờ)</option>
              <option value="90">90 phút (1.5 giờ)</option>
              <option value="120">120 phút (2 giờ)</option>
              <option value="150">150 phút (2.5 giờ)</option>
              <option value="180">180 phút (3 giờ)</option>
            </select>
          </div>
        </div>

        {/* Duration Summary */}
        <div
          className="rounded-lg border p-3"
          style={{
            backgroundColor: "var(--bg-muted)",
            borderColor: "var(--border-primary)",
          }}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Tổng buổi học
              </p>
              <p className="text-xl font-bold text-primary">{totalSessions}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Dự kiến (tuần)
              </p>
              <p className="text-xl font-bold text-primary">{estimatedWeeks}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Dự kiến (tháng)
              </p>
              <p className="text-xl font-bold text-primary">{Math.ceil(estimatedWeeks / 4)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Class Size */}
      <div className="space-y-4">
        <label className="label">Quy mô lớp học</label>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label-sm">Số học viên tối thiểu *</label>
            <input
              type="number"
              value={formData.minStudents}
              onChange={(e) => setFormData({ ...formData, minStudents: Number(e.target.value) })}
              className="input"
              min="1"
              max={formData.maxStudents}
              required
            />
          </div>

          <div className="form-group">
            <label className="label-sm">Số học viên tối đa *</label>
            <input
              type="number"
              value={formData.maxStudents}
              onChange={(e) => setFormData({ ...formData, maxStudents: Number(e.target.value) })}
              className="input"
              min={formData.minStudents}
              max="50"
              required
            />
          </div>
        </div>
      </div>

      {/* Fees */}
      <div className="space-y-4">
        <label className="label">Chi phí</label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label-sm">Học phí/buổi *</label>
            <CurrencyInput
              required
              value={formData.tuitionPerSession}
              onChange={(next) => setFormData({ ...formData, tuitionPerSession: next })}
            />
            <p className="form-hint">{formatVnd(formData.tuitionPerSession || 0)}</p>
          </div>

          <div className="form-group">
            <label className="label-sm">Phí sách</label>
            <CurrencyInput
              value={formData.bookFee ?? 0}
              onChange={(next) => setFormData({ ...formData, bookFee: next })}
            />
            <p className="form-hint">{formatVnd(formData.bookFee || 0)}</p>
          </div>

          <div className="form-group">
            <label className="label-sm">Phí tài liệu</label>
            <CurrencyInput
              value={formData.materialFee ?? 0}
              onChange={(next) => setFormData({ ...formData, materialFee: next })}
            />
            <p className="form-hint">{formatVnd(formData.materialFee || 0)}</p>
          </div>

          <div className="form-group">
            <label className="label-sm">Tổng học phí</label>
            <div className="relative">
              <input
                type="number"
                value={formData.totalFee}
                onChange={(e) => setFormData({ ...formData, totalFee: Number(e.target.value) })}
                className="input pr-12 font-bold text-primary"
                step="1000"
                min="0"
                readOnly
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                ₫
              </span>
            </div>
            <p className="form-hint">{formatVnd(formData.totalFee || 0)}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={calculateTotalFee}
          className="btn-ghost-sm w-full"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Tính lại tổng học phí
        </button>
      </div>

      {/* Description */}
      <div className="form-group">
        <label className="label">Mô tả khóa học</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="input min-h-[100px] resize-none"
          placeholder="Mô tả tổng quan về khóa học..."
          rows={4}
        />
      </div>

      {/* Curriculum, Objectives, Prerequisites */}
      <div className="space-y-4">
        <div className="form-group">
          <label className="label">Nội dung chương trình</label>
          <textarea
            value={formData.curriculum}
            onChange={(e) => setFormData({ ...formData, curriculum: e.target.value })}
            className="input min-h-[100px] resize-none"
            placeholder="Module 1: ...\nModule 2: ..."
            rows={4}
          />
        </div>

        <div className="form-group">
          <label className="label">Mục tiêu đầu ra</label>
          <textarea
            value={formData.objectives}
            onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
            className="input min-h-[80px] resize-none"
            placeholder="- Học viên có thể...\n- Nắm vững..."
            rows={3}
          />
        </div>

        <div className="form-group">
          <label className="label">Yêu cầu đầu vào</label>
          <textarea
            value={formData.prerequisites}
            onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
            className="input min-h-[80px] resize-none"
            placeholder="- Đã hoàn thành...\n- Có kiến thức..."
            rows={3}
          />
        </div>
      </div>

      {/* Active Status */}
      <div className="form-group">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-5 w-5 rounded border-2 border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
          />
          <div>
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              Kích hoạt chương trình
            </span>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Chương trình không kích hoạt sẽ không hiển thị khi tạo lớp mới
            </p>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1" disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
              </svg>
              Đang lưu...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {mode === "create" ? "Tạo chương trình" : "Lưu thay đổi"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
