"use client";

import { useState } from "react";

type UserRole = "DIRECTOR" | "BRANCH_MANAGER" | "ACCOUNTANT" | "RECEPTIONIST" | "TEACHER";

type UserFormData = {
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  branchId?: string;
  password?: string;
  isActive: boolean;
};

type UserManagementFormProps = {
  user?: Partial<UserFormData> & { id?: string };
  branches: Array<{ id: string; name: string }>;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  mode?: "create" | "edit";
};

const ROLES = [
  {
    value: "DIRECTOR",
    label: "👑 Giám đốc",
    description: "Toàn quyền quản lý hệ thống",
    color: "from-purple-500 to-pink-600",
    permissions: ["Xem tất cả", "Tạo mới", "Chỉnh sửa", "Xóa", "Xuất dữ liệu", "Quản lý tài chính", "Quản lý nhân sự"],
  },
  {
    value: "BRANCH_MANAGER",
    label: "🏢 Quản lý chi nhánh",
    description: "Quản lý chi nhánh được giao",
    color: "from-blue-500 to-indigo-600",
    permissions: ["Xem chi nhánh", "Tạo mới", "Chỉnh sửa", "Xóa", "Báo cáo chi nhánh"],
  },
  {
    value: "ACCOUNTANT",
    label: "💰 Kế toán",
    description: "Quản lý tài chính và học phí",
    color: "from-emerald-500 to-teal-600",
    permissions: ["Xem dữ liệu", "Quản lý học phí", "Quản lý thu chi", "Báo cáo tài chính"],
  },
  {
    value: "RECEPTIONIST",
    label: "📋 Lễ tân",
    description: "Tiếp nhận và hỗ trợ học viên",
    color: "from-amber-500 to-orange-600",
    permissions: ["Xem dữ liệu", "Tạo hồ sơ", "Chỉnh sửa thông tin", "Điểm danh"],
  },
  {
    value: "TEACHER",
    label: "👨‍🏫 Giáo viên",
    description: "Giảng dạy và điểm danh",
    color: "from-cyan-500 to-blue-600",
    permissions: ["Xem lớp học", "Điểm danh", "Ghi chú học viên"],
  },
];

export default function UserManagementForm({
  user,
  branches,
  onSubmit,
  onCancel,
  mode = "create",
}: UserManagementFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    email: user?.email || "",
    fullName: user?.fullName || "",
    phone: user?.phone || "",
    role: user?.role || "RECEPTIONIST",
    branchId: user?.branchId || (branches[0]?.id || ""),
    password: "",
    isActive: user?.isActive !== false,
  });
  const [selectedRole, setSelectedRole] = useState(
    ROLES.find((r) => r.value === formData.role) || ROLES[3]
  );
  const [showPassword, setShowPassword] = useState(false);

  const handleRoleSelect = (role: typeof ROLES[0]) => {
    setSelectedRole(role);
    setFormData({ ...formData, role: role.value as UserRole });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.email || !formData.fullName) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    if (mode === "create" && !formData.password) {
      alert("Vui lòng nhập mật khẩu cho tài khoản mới");
      return;
    }

    if (formData.password && formData.password.length < 6) {
      alert("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (formData.role !== "DIRECTOR" && !formData.branchId) {
      alert("Vui lòng chọn chi nhánh cho nhân viên");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {mode === "create" ? "➕ Thêm nhân viên mới" : "✏️ Chỉnh sửa thông tin"}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {mode === "create"
            ? "Tạo tài khoản và phân quyền cho nhân viên"
            : "Cập nhật thông tin và quyền hạn"}
        </p>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <div className="form-group">
          <label className="label">Email đăng nhập *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="input"
            placeholder="nhanvien@trungTam.edu.vn"
            required
            disabled={mode === "edit"}
          />
          {mode === "edit" && (
            <p className="form-hint">Email không thể thay đổi sau khi tạo</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Họ và tên *</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="input"
              placeholder="Nguyễn Văn A"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Số điện thoại</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              placeholder="0912345678"
            />
          </div>
        </div>
      </div>

      {/* Password (for new users or password change) */}
      <div className="form-group">
        <label className="label">
          {mode === "create" ? "Mật khẩu *" : "Mật khẩu mới (để trống nếu không đổi)"}
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="input pr-10"
            placeholder={mode === "create" ? "Tối thiểu 6 ký tự" : "••••••••"}
            required={mode === "create"}
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {mode === "create" && (
          <p className="form-hint">Mật khẩu mặc định, nhân viên nên đổi sau lần đăng nhập đầu</p>
        )}
      </div>

      {/* Role Selection */}
      <div className="form-group">
        <label className="label">Vai trò *</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLES.map((role) => (
            <button
              key={role.value}
              type="button"
              onClick={() => handleRoleSelect(role)}
              className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                selectedRole.value === role.value
                  ? "border-primary shadow-md scale-[1.02]"
                  : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
              }`}
            >
              {/* Gradient Background */}
              {selectedRole.value === role.value && (
                <div
                  className="absolute inset-0 opacity-5"
                  style={{
                    background: `linear-gradient(135deg, ${role.color.split(" ")[0].replace("from-", "var(--color-")} 0%, ${role.color.split(" ")[2].replace("to-", "var(--color-")} 100%)`,
                  }}
                />
              )}

              <div className="relative">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-base font-semibold">{role.label}</span>
                  {selectedRole.value === role.value && (
                    <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                  {role.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 2).map((perm, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {perm}
                    </span>
                  ))}
                  {role.permissions.length > 2 && (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ color: "var(--text-muted)" }}
                    >
                      +{role.permissions.length - 2}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Permissions Detail */}
        <div
          className="mt-3 rounded-lg border p-3"
          style={{
            backgroundColor: "var(--bg-muted)",
            borderColor: "var(--border-secondary)",
          }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
            Quyền hạn của {selectedRole.label}:
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedRole.permissions.map((perm, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text-primary)",
                }}
              >
                <svg className="h-3 w-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {perm}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Branch Selection (not for Director) */}
      {formData.role !== "DIRECTOR" && (
        <div className="form-group">
          <label className="label">Chi nhánh *</label>
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
          <p className="form-hint">Nhân viên sẽ làm việc tại chi nhánh này</p>
        </div>
      )}

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
              Kích hoạt tài khoản
            </span>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Tài khoản không kích hoạt sẽ không thể đăng nhập
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
              {mode === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
