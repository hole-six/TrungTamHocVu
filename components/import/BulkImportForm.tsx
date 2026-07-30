"use client";

import { useState, useRef } from "react";

type ImportType =
  | "STUDENTS"
  | "GUARDIANS"
  | "LEADS"
  | "CLASSES"
  | "EMPLOYEES"
  | "INVENTORY"
  | "PAYMENTS"
  | "ATTENDANCE";

type ImportMode = "CREATE_ONLY" | "UPDATE_ONLY" | "UPSERT";

type ImportFormData = {
  importType: ImportType;
  mode: ImportMode;
  file: File | null;
  branchId: string;
  dryRun: boolean;
  skipErrors: boolean;
  validateOnly: boolean;
};

type BulkImportFormProps = {
  branches: Array<{ id: string; name: string }>;
  onImport: (data: FormData) => Promise<{
    success: boolean;
    totalRows: number;
    successRows: number;
    errorRows: number;
    errors?: Array<{ row: number; message: string }>;
  }>;
  onCancel: () => void;
};

const IMPORT_TYPES = [
  {
    value: "STUDENTS",
    label: "Học viên",
    icon: "👥",
    description: "Import danh sách học viên mới hoặc cập nhật",
    template: "/templates/students_import_template.xlsx",
    color: "from-blue-500 to-indigo-600",
    requiredFields: ["Mã HV", "Họ tên", "Ngày sinh", "Số điện thoại"],
  },
  {
    value: "GUARDIANS",
    label: "Phụ huynh",
    icon: "👪",
    description: "Import thông tin phụ huynh",
    template: "/templates/guardians_import_template.xlsx",
    color: "from-teal-500 to-cyan-600",
    requiredFields: ["Họ tên PH", "Quan hệ", "Số điện thoại"],
  },
  {
    value: "LEADS",
    label: "Tiềm năng",
    icon: "🎯",
    description: "Import khách hàng tiềm năng từ marketing",
    template: "/templates/leads_import_template.xlsx",
    color: "from-orange-500 to-red-600",
    requiredFields: ["Họ tên", "Số điện thoại", "Nguồn"],
  },
  {
    value: "CLASSES",
    label: "Lớp học",
    icon: "🎓",
    description: "Import danh sách lớp học và lịch học",
    template: "/templates/classes_import_template.xlsx",
    color: "from-purple-500 to-pink-600",
    requiredFields: ["Mã lớp", "Tên lớp", "Giảng viên", "Lịch học"],
  },
  {
    value: "EMPLOYEES",
    label: "Nhân viên",
    icon: "👨‍💼",
    description: "Import hồ sơ nhân viên và giảng viên",
    template: "/templates/employees_import_template.xlsx",
    color: "from-indigo-500 to-purple-600",
    requiredFields: ["Mã NV", "Họ tên", "Chức vụ", "Email"],
  },
  {
    value: "INVENTORY",
    label: "Kho sách",
    icon: "📚",
    description: "Import giáo trình và sách học",
    template: "/templates/inventory_import_template.xlsx",
    color: "from-amber-500 to-orange-600",
    requiredFields: ["Mã sách", "Tên sách", "Giá bán", "Tồn kho"],
  },
  {
    value: "PAYMENTS",
    label: "Thanh toán",
    icon: "💰",
    description: "Import lịch sử thanh toán học phí",
    template: "/templates/payments_import_template.xlsx",
    color: "from-emerald-500 to-teal-600",
    requiredFields: ["Mã HV", "Số tiền", "Ngày thanh toán", "Phương thức"],
  },
  {
    value: "ATTENDANCE",
    label: "Điểm danh",
    icon: "📋",
    description: "Import dữ liệu điểm danh hàng loạt",
    template: "/templates/attendance_import_template.xlsx",
    color: "from-cyan-500 to-blue-600",
    requiredFields: ["Mã HV", "Mã lớp", "Ngày", "Trạng thái"],
  },
];

const IMPORT_MODES = [
  {
    value: "CREATE_ONLY",
    label: "Chỉ tạo mới",
    description: "Chỉ thêm bản ghi mới, bỏ qua nếu đã tồn tại",
    icon: "➕",
  },
  {
    value: "UPDATE_ONLY",
    label: "Chỉ cập nhật",
    description: "Chỉ cập nhật bản ghi có sẵn, bỏ qua nếu chưa tồn tại",
    icon: "✏️",
  },
  {
    value: "UPSERT",
    label: "Tạo hoặc cập nhật",
    description: "Tạo mới nếu chưa có, cập nhật nếu đã tồn tại",
    icon: "🔄",
  },
];

export default function BulkImportForm({ branches, onImport, onCancel }: BulkImportFormProps) {
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [formData, setFormData] = useState<ImportFormData>({
    importType: "STUDENTS",
    mode: "UPSERT",
    file: null,
    branchId: branches[0]?.id || "",
    dryRun: false,
    skipErrors: true,
    validateOnly: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedType = IMPORT_TYPES.find((t) => t.value === formData.importType)!;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel", // .xls
        "text/csv",
      ];
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
        alert("Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert("File không được vượt quá 10MB");
        return;
      }

      setFormData({ ...formData, file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.file) {
      alert("Vui lòng chọn file để import");
      return;
    }

    if (!formData.branchId) {
      alert("Vui lòng chọn chi nhánh");
      return;
    }

    setLoading(true);
    setImportResult(null);

    try {
      const data = new FormData();
      data.append("file", formData.file);
      data.append("importType", formData.importType);
      data.append("mode", formData.mode);
      data.append("branchId", formData.branchId);
      data.append("dryRun", String(formData.dryRun));
      data.append("skipErrors", String(formData.skipErrors));
      data.append("validateOnly", String(formData.validateOnly));

      const result = await onImport(data);
      setImportResult(result);

      if (result.success && !formData.dryRun && !formData.validateOnly) {
        // Success
      }
    } catch (error: any) {
      alert(`Lỗi import: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = selectedType.template;
    link.download = `template_${selectedType.value.toLowerCase()}.xlsx`;
    link.click();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          📤 Import dữ liệu hàng loạt
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nhập dữ liệu từ file Excel hoặc CSV vào hệ thống
        </p>
      </div>

      {/* Import Type Selection */}
      <div className="form-group">
        <label className="label">Loại dữ liệu cần import</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {IMPORT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFormData({ ...formData, importType: type.value as ImportType, file: null })}
              className={`relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${
                formData.importType === type.value
                  ? "border-primary shadow-md"
                  : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
              }`}
            >
              {formData.importType === type.value && (
                <div
                  className="absolute inset-0 opacity-5"
                  style={{ background: `linear-gradient(135deg, ${type.color})` }}
                />
              )}

              <div className="relative">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{type.icon}</span>
                  {formData.importType === type.value && (
                    <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                  {type.label}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {type.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Type Info */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: `linear-gradient(135deg, ${selectedType.color})`,
          borderColor: "transparent",
        }}
      >
        <div className="text-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedType.icon}</span>
              <div>
                <p className="font-bold text-lg">{selectedType.label}</p>
                <p className="text-sm opacity-90">{selectedType.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="btn-ghost-sm bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Tải template
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2 opacity-75">Các trường bắt buộc:</p>
            <div className="flex flex-wrap gap-2">
              {selectedType.requiredFields.map((field, idx) => (
                <span
                  key={idx}
                  className="inline-block px-2 py-1 rounded-lg text-xs font-medium bg-white/20"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="form-group">
        <label className="label">Chọn file để import</label>
        <div
          className="relative rounded-xl border-2 border-dashed p-8 text-center transition-colors"
          style={{
            borderColor: formData.file ? "var(--color-primary)" : "var(--border-secondary)",
            backgroundColor: formData.file ? "var(--bg-primary-light)" : "var(--bg-card)",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = "var(--color-primary)";
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-secondary)";
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = "var(--border-secondary)";
            const files = e.dataTransfer.files;
            if (files.length > 0 && fileInputRef.current) {
              fileInputRef.current.files = files;
              handleFileSelect({ target: { files } } as any);
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {formData.file ? (
            <div className="space-y-3">
              <svg
                className="mx-auto h-12 w-12 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div>
                <p className="font-semibold text-primary">{formData.file.name}</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {(formData.file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, file: null })}
                className="btn-ghost-sm text-red-600"
              >
                Xóa file
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <svg
                className="mx-auto h-12 w-12"
                style={{ color: "var(--text-muted)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <div>
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Kéo thả file vào đây hoặc click để chọn
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Chấp nhận: .xlsx, .xls, .csv (tối đa 10MB)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import Mode */}
      <div className="form-group">
        <label className="label">Chế độ import</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {IMPORT_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setFormData({ ...formData, mode: mode.value as ImportMode })}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                formData.mode === mode.value
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{mode.icon}</span>
                <div>
                  <p
                    className={`font-semibold text-sm mb-1 ${
                      formData.mode === mode.value ? "text-primary" : ""
                    }`}
                    style={{ color: formData.mode === mode.value ? undefined : "var(--text-primary)" }}
                  >
                    {mode.label}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {mode.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Branch Selection */}
      <div className="form-group">
        <label className="label">Chi nhánh</label>
        <select
          value={formData.branchId}
          onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
          className="input"
          required
        >
          <option value="">Chọn chi nhánh</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Options */}
      <div className="form-group space-y-3">
        <label className="label">Tùy chọn nâng cao</label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.validateOnly}
            onChange={(e) => setFormData({ ...formData, validateOnly: e.target.checked })}
            className="h-5 w-5 rounded border-2 border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
          />
          <div>
            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              🔍 Chỉ kiểm tra (không import)
            </span>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Kiểm tra lỗi trong file mà không thực hiện import
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.dryRun}
            onChange={(e) => setFormData({ ...formData, dryRun: e.target.checked })}
            className="h-5 w-5 rounded border-2 border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
            disabled={formData.validateOnly}
          />
          <div>
            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              🧪 Chạy thử (Dry Run)
            </span>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Mô phỏng import để xem kết quả trước khi thực hiện
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.skipErrors}
            onChange={(e) => setFormData({ ...formData, skipErrors: e.target.checked })}
            className="h-5 w-5 rounded border-2 border-gray-300 text-primary focus:ring-2 focus:ring-primary/20"
          />
          <div>
            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              ⏭️ Bỏ qua lỗi
            </span>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Tiếp tục import các dòng còn lại khi gặp lỗi
            </p>
          </div>
        </label>
      </div>

      {/* Import Result */}
      {importResult && (
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: importResult.success ? "var(--bg-success-light)" : "var(--bg-danger-light)",
            borderColor: importResult.success ? "var(--color-success)" : "var(--color-danger)",
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {importResult.success ? (
                <svg className="h-6 w-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <p className="font-bold text-lg">
                {formData.validateOnly ? "Kết quả kiểm tra" : formData.dryRun ? "Kết quả chạy thử" : "Kết quả import"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs opacity-75">Tổng số dòng</p>
                <p className="text-2xl font-bold">{importResult.totalRows}</p>
              </div>
              <div>
                <p className="text-xs opacity-75">Thành công</p>
                <p className="text-2xl font-bold text-emerald-600">{importResult.successRows}</p>
              </div>
              <div>
                <p className="text-xs opacity-75">Lỗi</p>
                <p className="text-2xl font-bold text-red-600">{importResult.errorRows}</p>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div
                className="mt-3 rounded-lg border p-3 max-h-40 overflow-y-auto"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-primary)",
                }}
              >
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                  Chi tiết lỗi:
                </p>
                <div className="space-y-1">
                  {importResult.errors.map((error: any, idx: number) => (
                    <p key={idx} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Dòng {error.row}: {error.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1" disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading || !formData.file}>
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
              </svg>
              Đang xử lý...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              {formData.validateOnly ? "Kiểm tra file" : formData.dryRun ? "Chạy thử" : "Bắt đầu import"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
