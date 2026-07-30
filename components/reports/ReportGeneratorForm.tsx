"use client";

import { useState } from "react";

type ReportType =
  | "STUDENT_SUMMARY"
  | "CLASS_ATTENDANCE"
  | "TUITION_REVENUE"
  | "PAYMENT_COLLECTION"
  | "CASHBOOK_STATEMENT"
  | "PAYROLL_SUMMARY"
  | "INVENTORY_STOCK"
  | "LEAD_CONVERSION"
  | "TEACHER_PERFORMANCE";

type ReportFormat = "PDF" | "EXCEL" | "CSV";

type ReportFormData = {
  reportType: ReportType;
  format: ReportFormat;
  dateFrom: string;
  dateTo: string;
  branchId?: string;
  classId?: string;
  teacherId?: string;
  includeCharts: boolean;
  includeDetails: boolean;
};

type ReportGeneratorFormProps = {
  branches: Array<{ id: string; name: string }>;
  classes?: Array<{ id: string; name: string }>;
  teachers?: Array<{ id: string; name: string }>;
  onGenerate: (data: ReportFormData) => Promise<void>;
  onCancel: () => void;
};

const REPORT_TYPES = [
  {
    value: "STUDENT_SUMMARY",
    label: "Tổng hợp học viên",
    icon: "👥",
    description: "Số lượng, trạng thái, phân bố theo lớp",
    color: "from-blue-500 to-indigo-600",
  },
  {
    value: "CLASS_ATTENDANCE",
    label: "Điểm danh lớp học",
    icon: "📋",
    description: "Tỷ lệ đi học, vắng mặt theo lớp/học viên",
    color: "from-purple-500 to-pink-600",
  },
  {
    value: "TUITION_REVENUE",
    label: "Doanh thu học phí",
    icon: "💰",
    description: "Doanh thu theo tháng, lớp, học viên",
    color: "from-emerald-500 to-teal-600",
  },
  {
    value: "PAYMENT_COLLECTION",
    label: "Thu tiền học phí",
    icon: "💳",
    description: "Chi tiết thanh toán, công nợ",
    color: "from-green-500 to-emerald-600",
  },
  {
    value: "CASHBOOK_STATEMENT",
    label: "Sổ quỹ tiền mặt",
    icon: "📊",
    description: "Thu chi, tồn quỹ theo ngày",
    color: "from-amber-500 to-orange-600",
  },
  {
    value: "PAYROLL_SUMMARY",
    label: "Bảng lương",
    icon: "💵",
    description: "Lương giảng viên, công giờ dạy",
    color: "from-cyan-500 to-blue-600",
  },
  {
    value: "INVENTORY_STOCK",
    label: "Tồn kho sách",
    icon: "📚",
    description: "Nhập xuất tồn giáo trình",
    color: "from-indigo-500 to-purple-600",
  },
  {
    value: "LEAD_CONVERSION",
    label: "Chuyển đổi tiềm năng",
    icon: "📈",
    description: "Tỷ lệ chốt từ tư vấn đến nhập học",
    color: "from-pink-500 to-rose-600",
  },
  {
    value: "TEACHER_PERFORMANCE",
    label: "Hiệu suất giảng viên",
    icon: "👨‍🏫",
    description: "Số giờ dạy, đánh giá, lương",
    color: "from-teal-500 to-cyan-600",
  },
];

const FORMATS = [
  { value: "PDF", label: "📄 PDF", icon: "📄" },
  { value: "EXCEL", label: "📊 Excel", icon: "📊" },
  { value: "CSV", label: "📁 CSV", icon: "📁" },
];

export default function ReportGeneratorForm({
  branches,
  classes = [],
  teachers = [],
  onGenerate,
  onCancel,
}: ReportGeneratorFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ReportFormData>({
    reportType: "STUDENT_SUMMARY",
    format: "PDF",
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    dateTo: new Date().toISOString().split("T")[0],
    branchId: branches[0]?.id || "",
    includeCharts: true,
    includeDetails: true,
  });

  const selectedReport = REPORT_TYPES.find((r) => r.value === formData.reportType)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (new Date(formData.dateFrom) > new Date(formData.dateTo)) {
      alert("Ngày bắt đầu phải trước ngày kết thúc");
      return;
    }

    setLoading(true);
    try {
      await onGenerate(formData);
    } finally {
      setLoading(false);
    }
  };

  // Quick date range presets
  const setDateRange = (preset: string) => {
    const today = new Date();
    let from = new Date();
    let to = new Date();

    switch (preset) {
      case "today":
        from = to = today;
        break;
      case "yesterday":
        from = to = new Date(today.setDate(today.getDate() - 1));
        break;
      case "this_week":
        from = new Date(today.setDate(today.getDate() - today.getDay()));
        to = new Date();
        break;
      case "last_week":
        from = new Date(today.setDate(today.getDate() - today.getDay() - 7));
        to = new Date(today.setDate(today.getDate() - today.getDay() - 1));
        break;
      case "this_month":
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date();
        break;
      case "last_month":
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "this_quarter":
        const quarter = Math.floor(today.getMonth() / 3);
        from = new Date(today.getFullYear(), quarter * 3, 1);
        to = new Date();
        break;
      case "this_year":
        from = new Date(today.getFullYear(), 0, 1);
        to = new Date();
        break;
    }

    setFormData({
      ...formData,
      dateFrom: from.toISOString().split("T")[0],
      dateTo: to.toISOString().split("T")[0],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          📊 Tạo báo cáo
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Chọn loại báo cáo và tùy chỉnh thời gian, định dạng xuất
        </p>
      </div>

      {/* Report Type Selection */}
      <div className="form-group">
        <label className="label">Loại báo cáo</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORT_TYPES.map((report) => (
            <button
              key={report.value}
              type="button"
              onClick={() => setFormData({ ...formData, reportType: report.value as ReportType })}
              className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                formData.reportType === report.value
                  ? "border-primary shadow-md"
                  : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
              }`}
            >
              {formData.reportType === report.value && (
                <div
                  className="absolute inset-0 opacity-5"
                  style={{
                    background: `linear-gradient(135deg, ${report.color})`,
                  }}
                />
              )}

              <div className="relative">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{report.icon}</span>
                  {formData.reportType === report.value && (
                    <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                  {report.label}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {report.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Report Info */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: `linear-gradient(135deg, ${selectedReport.color})`,
          borderColor: "transparent",
        }}
      >
        <div className="text-white">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{selectedReport.icon}</span>
            <div>
              <p className="font-bold text-lg">{selectedReport.label}</p>
              <p className="text-sm opacity-90">{selectedReport.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="form-group">
        <label className="label">Khoảng thời gian</label>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { key: "today", label: "Hôm nay" },
            { key: "this_week", label: "Tuần này" },
            { key: "this_month", label: "Tháng này" },
            { key: "last_month", label: "Tháng trước" },
            { key: "this_quarter", label: "Quý này" },
            { key: "this_year", label: "Năm nay" },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setDateRange(preset.key)}
              className="btn-ghost-sm"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-sm">Từ ngày</label>
            <input
              type="date"
              value={formData.dateFrom}
              onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label-sm">Đến ngày</label>
            <input
              type="date"
              value={formData.dateTo}
              onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
              className="input"
              required
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Chi nhánh</label>
          <select
            value={formData.branchId}
            onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
            className="input"
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        {(formData.reportType === "CLASS_ATTENDANCE" || formData.reportType === "TUITION_REVENUE") && (
          <div className="form-group">
            <label className="label">Lớp học</label>
            <select
              value={formData.classId}
              onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
              className="input"
            >
              <option value="">Tất cả lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {(formData.reportType === "PAYROLL_SUMMARY" || formData.reportType === "TEACHER_PERFORMANCE") && (
          <div className="form-group">
            <label className="label">Giảng viên</label>
            <select
              value={formData.teacherId}
              onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              className="input"
            >
              <option value="">Tất cả giảng viên</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Format Selection */}
      <div className="form-group">
        <label className="label">Định dạng xuất</label>
        <div className="grid grid-cols-3 gap-3">
          {FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              onClick={() => setFormData({ ...formData, format: format.value as ReportFormat })}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all ${
                formData.format === format.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
              }`}
            >
              <span className="text-2xl">{format.icon}</span>
              <span
                className={`text-sm font-medium ${
                  formData.format === format.value ? "text-primary" : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {format.label.replace(/^[^\s]+ /, "")}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="form-group space-y-3">
        <label className="label">Tùy chọn</label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.includeCharts}
            onChange={(e) => setFormData({ ...formData, includeCharts: e.target.checked })}
            className="h-5 w-5 rounded border-2 border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
            disabled={formData.format === "CSV"}
          />
          <div>
            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              Bao gồm biểu đồ
            </span>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Thêm biểu đồ trực quan vào báo cáo (chỉ PDF & Excel)
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.includeDetails}
            onChange={(e) => setFormData({ ...formData, includeDetails: e.target.checked })}
            className="h-5 w-5 rounded border-2 border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
          />
          <div>
            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              Chi tiết đầy đủ
            </span>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Hiển thị tất cả chi tiết giao dịch (file sẽ lớn hơn)
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
              Đang tạo...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Tạo báo cáo
            </>
          )}
        </button>
      </div>
    </form>
  );
}
