"use client";

import { useState } from "react";

type AppointmentType = "TEST" | "CONSULTATION" | "MEETING" | "TRIAL_CLASS" | "OTHER";
type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

type AppointmentFormData = {
  type: AppointmentType;
  leadId?: string;
  studentId?: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  appointmentDate: string;
  appointmentTime: string;
  duration: number; // minutes
  staffId: string;
  location: string;
  notes?: string;
  reminderEnabled: boolean;
  status: AppointmentStatus;
};

type AppointmentFormProps = {
  appointment?: Partial<AppointmentFormData> & { id?: string };
  leads?: Array<{ id: string; fullName: string; phone: string }>;
  students?: Array<{ id: string; fullName: string }>;
  staff: Array<{ id: string; fullName: string; role: string }>;
  locations: string[];
  onSubmit: (data: AppointmentFormData) => Promise<void>;
  onCancel: () => void;
  mode?: "create" | "edit";
};

const APPOINTMENT_TYPES = [
  {
    value: "TEST",
    label: "Kiểm tra đầu vào",
    icon: "📝",
    description: "Test trình độ cho học viên mới",
    color: "from-blue-500 to-indigo-600",
    defaultDuration: 60,
  },
  {
    value: "CONSULTATION",
    label: "Tư vấn",
    icon: "💬",
    description: "Tư vấn chương trình học",
    color: "from-purple-500 to-pink-600",
    defaultDuration: 30,
  },
  {
    value: "TRIAL_CLASS",
    label: "Học thử",
    icon: "🎓",
    description: "Buổi học thử miễn phí",
    color: "from-emerald-500 to-teal-600",
    defaultDuration: 90,
  },
  {
    value: "MEETING",
    label: "Gặp gỡ",
    icon: "🤝",
    description: "Họp phụ huynh, review học tập",
    color: "from-amber-500 to-orange-600",
    defaultDuration: 45,
  },
  {
    value: "OTHER",
    label: "Khác",
    icon: "📅",
    description: "Lịch hẹn khác",
    color: "from-cyan-500 to-blue-600",
    defaultDuration: 30,
  },
];

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
];

const DURATIONS = [
  { value: 15, label: "15 phút" },
  { value: 30, label: "30 phút" },
  { value: 45, label: "45 phút" },
  { value: 60, label: "1 giờ" },
  { value: 90, label: "1.5 giờ" },
  { value: 120, label: "2 giờ" },
];

export default function AppointmentForm({
  appointment,
  leads = [],
  students = [],
  staff,
  locations,
  onSubmit,
  onCancel,
  mode = "create",
}: AppointmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AppointmentFormData>({
    type: appointment?.type || "CONSULTATION",
    leadId: appointment?.leadId,
    studentId: appointment?.studentId,
    guardianName: appointment?.guardianName || "",
    guardianPhone: appointment?.guardianPhone || "",
    guardianEmail: appointment?.guardianEmail || "",
    appointmentDate: appointment?.appointmentDate || new Date().toISOString().split("T")[0],
    appointmentTime: appointment?.appointmentTime || "09:00",
    duration: appointment?.duration || 30,
    staffId: appointment?.staffId || staff[0]?.id || "",
    location: appointment?.location || locations[0] || "",
    notes: appointment?.notes || "",
    reminderEnabled: appointment?.reminderEnabled !== false,
    status: appointment?.status || "SCHEDULED",
  });

  const selectedType = APPOINTMENT_TYPES.find((t) => t.value === formData.type)!;

  // Auto-fill guardian info when lead is selected
  const handleLeadSelect = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      setFormData({
        ...formData,
        leadId,
        guardianName: lead.fullName,
        guardianPhone: lead.phone,
      });
    }
  };

  // Auto-fill guardian info when student is selected
  const handleStudentSelect = (studentId: string) => {
    setFormData({
      ...formData,
      studentId,
      leadId: undefined,
    });
  };

  const handleTypeChange = (type: AppointmentType) => {
    const typeConfig = APPOINTMENT_TYPES.find((t) => t.value === type)!;
    setFormData({
      ...formData,
      type,
      duration: typeConfig.defaultDuration,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.guardianName || !formData.guardianPhone) {
      alert("Vui lòng điền thông tin phụ huynh/người liên hệ");
      return;
    }

    if (!formData.staffId) {
      alert("Vui lòng chọn nhân viên phụ trách");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  // Calculate end time
  const getEndTime = () => {
    const [hours, minutes] = formData.appointmentTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + formData.duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {mode === "create" ? "📅 Đặt lịch hẹn mới" : "✏️ Chỉnh sửa lịch hẹn"}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {mode === "create" ? "Tạo lịch hẹn với phụ huynh/học viên" : "Cập nhật thông tin lịch hẹn"}
        </p>
      </div>

      {/* Appointment Type */}
      <div className="form-group">
        <label className="label">Loại lịch hẹn</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {APPOINTMENT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => handleTypeChange(type.value as AppointmentType)}
              className={`relative overflow-hidden rounded-xl border-2 p-3 text-center transition-all ${
                formData.type === type.value
                  ? "border-primary shadow-md"
                  : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
              }`}
            >
              {formData.type === type.value && (
                <div
                  className="absolute inset-0 opacity-5"
                  style={{ background: `linear-gradient(135deg, ${type.color})` }}
                />
              )}

              <div className="relative">
                <span className="text-3xl block mb-1">{type.icon}</span>
                <span
                  className={`text-xs font-semibold block ${
                    formData.type === type.value ? "text-primary" : ""
                  }`}
                  style={{ color: formData.type === type.value ? undefined : "var(--text-secondary)" }}
                >
                  {type.label}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Type Description */}
        <div
          className="mt-3 rounded-lg border p-3"
          style={{
            background: `linear-gradient(135deg, ${selectedType.color})`,
            borderColor: "transparent",
          }}
        >
          <div className="text-white">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedType.icon}</span>
              <div>
                <p className="font-semibold">{selectedType.label}</p>
                <p className="text-sm opacity-90">{selectedType.description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lead or Student Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {leads.length > 0 && (
          <div className="form-group">
            <label className="label">Tiềm năng (nếu có)</label>
            <select
              value={formData.leadId || ""}
              onChange={(e) => handleLeadSelect(e.target.value)}
              className="input"
            >
              <option value="">-- Chọn tiềm năng --</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.fullName} - {lead.phone}
                </option>
              ))}
            </select>
          </div>
        )}

        {students.length > 0 && (
          <div className="form-group">
            <label className="label">Học viên (nếu có)</label>
            <select
              value={formData.studentId || ""}
              onChange={(e) => handleStudentSelect(e.target.value)}
              className="input"
            >
              <option value="">-- Chọn học viên --</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Guardian Info */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Họ tên phụ huynh/Người liên hệ *</label>
            <input
              type="text"
              value={formData.guardianName}
              onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
              className="input"
              placeholder="Nguyễn Văn A"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Số điện thoại *</label>
            <input
              type="tel"
              value={formData.guardianPhone}
              onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
              className="input"
              placeholder="0912345678"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="label">Email (không bắt buộc)</label>
          <input
            type="email"
            value={formData.guardianEmail}
            onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
            className="input"
            placeholder="email@example.com"
          />
        </div>
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="form-group">
          <label className="label">Ngày hẹn *</label>
          <input
            type="date"
            value={formData.appointmentDate}
            onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
            className="input"
            min={new Date().toISOString().split("T")[0]}
            required
          />
        </div>

        <div className="form-group">
          <label className="label">Giờ bắt đầu *</label>
          <select
            value={formData.appointmentTime}
            onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
            className="input"
            required
          >
            {TIME_SLOTS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label">Thời lượng *</label>
          <select
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
            className="input"
            required
          >
            {DURATIONS.map((dur) => (
              <option key={dur.value} value={dur.value}>
                {dur.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Time Summary */}
      <div
        className="rounded-lg border p-3"
        style={{
          backgroundColor: "var(--bg-muted)",
          borderColor: "var(--border-primary)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Thời gian dự kiến:
          </span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {formData.appointmentTime} - {getEndTime()} ({formData.duration} phút)
          </span>
        </div>
      </div>

      {/* Staff and Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Nhân viên phụ trách *</label>
          <select
            value={formData.staffId}
            onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
            className="input"
            required
          >
            <option value="">-- Chọn nhân viên --</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.role})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label">Địa điểm *</label>
          <select
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="input"
            required
          >
            {locations.map((loc, idx) => (
              <option key={idx} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div className="form-group">
        <label className="label">Ghi chú</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="input min-h-[80px] resize-none"
          placeholder="Ghi chú thêm về lịch hẹn..."
          rows={3}
        />
      </div>

      {/* Options */}
      <div className="form-group">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.reminderEnabled}
            onChange={(e) => setFormData({ ...formData, reminderEnabled: e.target.checked })}
            className="h-5 w-5 rounded border-2 border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
          />
          <div>
            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              Gửi nhắc nhở
            </span>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Gửi SMS/Email nhắc nhở 1 ngày trước lịch hẹn
            </p>
          </div>
        </label>
      </div>

      {/* Status (for edit mode) */}
      {mode === "edit" && (
        <div className="form-group">
          <label className="label">Trạng thái</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as AppointmentStatus })}
            className="input"
          >
            <option value="SCHEDULED">Đã đặt lịch</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
            <option value="NO_SHOW">Không đến</option>
          </select>
        </div>
      )}

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
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {mode === "create" ? "Đặt lịch hẹn" : "Cập nhật lịch hẹn"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
