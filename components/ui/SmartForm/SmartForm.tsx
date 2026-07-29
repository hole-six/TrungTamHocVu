"use client";

import { useState, FormEvent } from "react";

export type FormField = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "date" | "select" | "textarea" | "checkbox" | "radio";
  placeholder?: string;
  required?: boolean;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  validation?: (value: any) => string | undefined;
  disabled?: boolean;
  hidden?: boolean;
  description?: string;
  icon?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  onChange?: (value: any) => void;
};

export type FormSection = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  fields: FormField[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

type SmartFormProps = {
  sections: FormSection[];
  onSubmit: (data: Record<string, any>) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  className?: string;
};

export default function SmartForm({
  sections,
  onSubmit,
  onCancel,
  submitLabel = "Lưu",
  cancelLabel = "Hủy",
  loading = false,
  className = "",
}: SmartFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          initial[field.name] = field.defaultValue;
        }
      });
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = loading || isSubmitting;
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((section, idx) => {
      if (section.collapsible && section.defaultCollapsed) {
        initial[idx] = true;
      }
    });
    return initial;
  });

  const handleChange = (name: string, value: any, field: FormField) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Run custom onChange
    field.onChange?.(value);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.hidden) return;

        const value = formData[field.name];

        // Required validation
        if (field.required && (!value || value === "")) {
          newErrors[field.name] = `${field.label} là bắt buộc`;
        }

        // Custom validation
        if (field.validation && value) {
          const error = field.validation(value);
          if (error) {
            newErrors[field.name] = error;
          }
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      // Không để lỗi submit (vd server trả 409 trùng SĐT) rơi vào unhandled rejection —
      // nếu component cha không tự bắt lỗi thì người dùng bấm Lưu xong không thấy gì xảy ra,
      // nút vẫn kẹt ở "Đang lưu..." mà không rõ vì sao.
      setSubmitError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSection = (index: number) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const renderField = (field: FormField) => {
    if (field.hidden) return null;

    const value = formData[field.name] || "";
    const error = errors[field.name];

    const inputClasses = `input ${error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""} ${
      field.icon ? "pl-10" : ""
    }`;

    return (
      <div key={field.name} className="form-group">
        <label className="label">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {field.description && (
          <p className="text-xs text-ink-muted48 mb-2">{field.description}</p>
        )}

        <div className="relative">
          {field.icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted48">
              {field.icon}
            </div>
          )}

          {field.type === "select" ? (
            <select
              name={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value, field)}
              disabled={field.disabled || submitting}
              required={field.required}
              className={inputClasses}
            >
              <option value="">-- Chọn {field.label.toLowerCase()} --</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              name={field.name}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value, field)}
              disabled={field.disabled || submitting}
              required={field.required}
              placeholder={field.placeholder}
              rows={field.rows || 4}
              className={inputClasses}
            />
          ) : field.type === "checkbox" ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name={field.name}
                checked={!!value}
                onChange={(e) => handleChange(field.name, e.target.checked, field)}
                disabled={field.disabled || submitting}
                className="h-4 w-4 rounded border-2 border-[#cbd5e1] text-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-sm text-ink">{field.placeholder || field.label}</span>
            </label>
          ) : field.type === "radio" ? (
            <div className="space-y-2">
              {field.options?.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={value === opt.value}
                    onChange={(e) => handleChange(field.name, e.target.value, field)}
                    disabled={field.disabled || submitting}
                    className="h-4 w-4 border-2 border-[#cbd5e1] text-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-sm text-ink">{opt.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              type={field.type}
              name={field.name}
              value={value}
              onChange={(e) =>
                handleChange(
                  field.name,
                  field.type === "number" ? Number(e.target.value) : e.target.value,
                  field
                )
              }
              disabled={field.disabled || submitting}
              required={field.required}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              step={field.step}
              className={inputClasses}
            />
          )}
        </div>

        {error && (
          <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${className}`}>
      {sections.map((section, sectionIdx) => {
        const isCollapsed = collapsedSections[sectionIdx];

        return (
          <div
            key={sectionIdx}
            className="rounded-xl border border-[#e8edf5] bg-gradient-to-br from-white to-[#fafbff] overflow-hidden"
          >
            {/* Section header */}
            <div
              className={`flex items-center justify-between p-5 ${
                section.collapsible ? "cursor-pointer hover:bg-[#f8fafc]" : ""
              }`}
              onClick={() => section.collapsible && toggleSection(sectionIdx)}
            >
              <div className="flex items-center gap-2">
                {section.icon && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    {section.icon}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-ink">{section.title}</h3>
                  {section.description && (
                    <p className="text-xs text-ink-muted48 mt-0.5">{section.description}</p>
                  )}
                </div>
              </div>
              {section.collapsible && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform text-ink-muted48 ${isCollapsed ? "" : "rotate-180"}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </div>

            {/* Section fields */}
            {!isCollapsed && (
              <div className="px-5 pb-5 space-y-4 border-t border-[#e8edf5] pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {section.fields.map(renderField)}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {submitError && (
        <div className="alert-danger flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {submitError}
        </div>
      )}

      {/* Form actions */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-[#e8edf5] p-4 -mx-4 -mb-4 rounded-b-xl">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-ghost"
          >
            {cancelLabel}
          </button>
        )}
        <button type="submit" disabled={submitting} className="btn-primary min-w-[120px]">
          {submitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
              </svg>
              Đang lưu...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              {submitLabel}
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
