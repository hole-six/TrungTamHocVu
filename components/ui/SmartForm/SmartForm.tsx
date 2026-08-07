"use client";

import { useRef, useState, FormEvent } from "react";

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
  colSpan?: 1 | 2;
  onChange?: (value: any, formData: Record<string, any>) => void | Partial<Record<string, any>>;
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
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      const patch = field.onChange?.(value, next);
      if (patch && typeof patch === "object") {
        Object.assign(next, patch);
      }
      return next;
    });

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    setSubmitError(null);
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.hidden) return;

        const value = formData[field.name];
        const isEmpty =
          value === undefined ||
          value === null ||
          value === "" ||
          (field.type === "checkbox" && value !== true);

        if (field.required && isEmpty) {
          nextErrors[field.name] = `${field.label} là bắt buộc`;
          return;
        }

        if (field.validation && value !== undefined && value !== null && value !== "") {
          const error = field.validation(value);
          if (error) {
            nextErrors[field.name] = error;
          }
        }
      });
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại.");
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

  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const goToSection = (index: number) => {
    if (collapsedSections[index]) toggleSection(index);
    sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const renderField = (field: FormField) => {
    if (field.hidden) return null;

    const rawValue =
      formData[field.name] ??
      (field.type === "checkbox" ? false : "");
    const error = errors[field.name];
    const spanClass =
      field.colSpan === 2 || field.type === "textarea" || field.type === "checkbox" || field.type === "radio"
        ? "sm:col-span-2 lg:col-span-3"
        : "";

    const inputClasses = `input ${error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""} ${field.icon ? "pl-10" : ""}`;

    return (
      <div key={field.name} className={`form-group ${spanClass}`}>
        <label className="label">
          {field.label}
          {field.required ? <span className="ml-1 text-red-500">*</span> : null}
        </label>

        {field.description ? (
          <p className="mb-2 text-xs leading-5 text-ink-muted48">{field.description}</p>
        ) : null}

        <div className="relative">
          {field.icon ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted48">
              {field.icon}
            </div>
          ) : null}

          {field.type === "select" ? (
            <select
              name={field.name}
              value={rawValue}
              onChange={(e) => handleChange(field.name, e.target.value, field)}
              disabled={field.disabled || submitting}
              required={field.required}
              className={inputClasses}
            >
              <option value="">-- Chọn {field.label.toLowerCase()} --</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              name={field.name}
              value={rawValue}
              onChange={(e) => handleChange(field.name, e.target.value, field)}
              disabled={field.disabled || submitting}
              required={field.required}
              placeholder={field.placeholder}
              rows={field.rows || 4}
              className={inputClasses}
            />
          ) : field.type === "checkbox" ? (
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e5eaf7] bg-white px-4 py-3">
              <input
                type="checkbox"
                name={field.name}
                checked={Boolean(rawValue)}
                onChange={(e) => handleChange(field.name, e.target.checked, field)}
                disabled={field.disabled || submitting}
                className="h-4 w-4 rounded border-2 border-[#cbd5e1] text-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-sm text-ink">{field.placeholder || field.label}</span>
            </label>
          ) : field.type === "radio" ? (
            <div className="space-y-2">
              {field.options?.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e5eaf7] bg-white px-4 py-3"
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={option.value}
                    checked={rawValue === option.value}
                    onChange={(e) => handleChange(field.name, e.target.value, field)}
                    disabled={field.disabled || submitting}
                    className="h-4 w-4 border-2 border-[#cbd5e1] text-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-sm text-ink">{option.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              type={field.type}
              name={field.name}
              value={rawValue}
              onChange={(e) =>
                handleChange(
                  field.name,
                  field.type === "number"
                    ? (e.target.value === "" ? "" : Number(e.target.value))
                    : e.target.value,
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

        {error ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${className}`}>
      {sections.length > 1 && (
        <div className="overflow-x-auto rounded-[24px] border border-[#e4ebf8] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-5 py-4 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex min-w-max items-center">
            {sections.map((section, sectionIdx) => (
              <div key={sectionIdx} className="flex items-center">
                <button
                  type="button"
                  onClick={() => goToSection(sectionIdx)}
                  className="flex items-center gap-2.5 rounded-2xl px-2 py-1 hover:bg-[#f8fbff]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-xs font-bold text-primary">
                    {sectionIdx + 1}
                  </span>
                  <span className="whitespace-nowrap text-sm font-semibold text-ink">{section.title}</span>
                </button>
                {sectionIdx < sections.length - 1 ? <span className="mx-3 h-px w-8 shrink-0 bg-[#dbe4f5]" /> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.map((section, sectionIdx) => {
        const isCollapsed = collapsedSections[sectionIdx];

        return (
          <div
            key={sectionIdx}
            ref={(el) => {
              sectionRefs.current[sectionIdx] = el;
            }}
            className="overflow-hidden rounded-[28px] border border-[#e4ebf8] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_22px_60px_-40px_rgba(15,23,42,0.45)]"
          >
            <div
              className={`flex items-center justify-between gap-4 px-6 py-5 ${
                section.collapsible ? "cursor-pointer hover:bg-[#f8fbff]" : ""
              }`}
              onClick={() => section.collapsible && toggleSection(sectionIdx)}
            >
              <div className="flex items-center gap-3">
                {section.icon ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
                    {section.icon}
                  </div>
                ) : null}
                <div>
                  <h3 className="text-sm font-bold text-ink">{section.title}</h3>
                  {section.description ? (
                    <p className="mt-0.5 text-xs leading-5 text-ink-muted48">{section.description}</p>
                  ) : null}
                </div>
              </div>

              {section.collapsible ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-ink-muted48 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              ) : null}
            </div>

            {!isCollapsed ? (
              <div className="space-y-4 border-t border-[#e8edf5] px-6 pb-6 pt-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {section.fields.map(renderField)}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {submitError ? (
        <div className="alert-danger flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {submitError}
        </div>
      ) : null}

      <div className="sticky bottom-4 z-10 -mx-2 rounded-[24px] border border-[#e4ebf8] bg-white/92 p-4 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur-md">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="btn-ghost"
            >
              {cancelLabel}
            </button>
          ) : null}

          <button type="submit" disabled={submitting} className="btn-primary min-w-[140px]">
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
      </div>
    </form>
  );
}
