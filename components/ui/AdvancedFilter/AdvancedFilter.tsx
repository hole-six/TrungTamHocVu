"use client";

import { useState } from "react";

export type FilterField = {
  name: string;
  label: string;
  type: "text" | "select" | "date-range" | "number-range" | "multi-select";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

type AdvancedFilterProps = {
  fields: FilterField[];
  onApply: (filters: Record<string, any>) => void;
  onReset: () => void;
  initialValues?: Record<string, any>;
  className?: string;
};

export default function AdvancedFilter({
  fields,
  onApply,
  onReset,
  initialValues = {},
  className = "",
}: AdvancedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>(initialValues);
  const [activeFiltersCount, setActiveFiltersCount] = useState(
    Object.values(initialValues).filter(v => v !== "" && v !== null && v !== undefined).length
  );

  const handleChange = (name: string, value: any) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApply = () => {
    const activeFilters = Object.entries(filters).reduce((acc, [key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        if (Array.isArray(value) && value.length > 0) {
          acc[key] = value;
        } else if (!Array.isArray(value)) {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as Record<string, any>);

    setActiveFiltersCount(Object.keys(activeFilters).length);
    onApply(activeFilters);
    setIsOpen(false);
  };

  const handleReset = () => {
    const emptyFilters = fields.reduce((acc, field) => {
      acc[field.name] = field.type === "multi-select" ? [] : "";
      return acc;
    }, {} as Record<string, any>);
    
    setFilters(emptyFilters);
    setActiveFiltersCount(0);
    onReset();
    setIsOpen(false);
  };

  const renderField = (field: FilterField) => {
    const value = filters[field.name] || (field.type === "multi-select" ? [] : "");

    switch (field.type) {
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="input"
          >
            <option value="">Tất cả</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "multi-select":
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.includes(opt.value)}
                  onChange={(e) => {
                    const newValue = e.target.checked
                      ? [...value, opt.value]
                      : value.filter((v: string) => v !== opt.value);
                    handleChange(field.name, newValue);
                  }}
                  className="h-4 w-4 rounded border-2 border-[#cbd5e1] text-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-sm text-ink">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case "date-range":
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-ink-muted48 mb-1">Từ ngày</label>
              <input
                type="date"
                value={value.from || ""}
                onChange={(e) =>
                  handleChange(field.name, { ...value, from: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-muted48 mb-1">Đến ngày</label>
              <input
                type="date"
                value={value.to || ""}
                onChange={(e) =>
                  handleChange(field.name, { ...value, to: e.target.value })
                }
                className="input"
              />
            </div>
          </div>
        );

      case "number-range":
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-ink-muted48 mb-1">Từ</label>
              <input
                type="number"
                value={value.min || ""}
                onChange={(e) =>
                  handleChange(field.name, { ...value, min: e.target.value })
                }
                placeholder={field.placeholder || "Min"}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-muted48 mb-1">Đến</label>
              <input
                type="number"
                value={value.max || ""}
                onChange={(e) =>
                  handleChange(field.name, { ...value, max: e.target.value })
                }
                placeholder={field.placeholder || "Max"}
                className="input"
              />
            </div>
          </div>
        );

      default: // text
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className="input"
          />
        );
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`btn-ghost relative ${activeFiltersCount > 0 ? "ring-2 ring-primary/20" : ""}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span>Bộ lọc nâng cao</span>
        {activeFiltersCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-4 top-20 z-50 w-full max-w-md rounded-xl border border-[#e8edf5] bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e8edf5] px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Bộ lọc nâng cao</h3>
                  {activeFiltersCount > 0 && (
                    <p className="text-xs text-ink-muted48">
                      {activeFiltersCount} bộ lọc đang áp dụng
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f1f5f9] transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Filter Fields */}
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.name}>
                    <label className="label mb-2">{field.label}</label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-[#e8edf5] px-5 py-4">
              <button onClick={handleReset} className="btn-ghost text-sm">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Đặt lại
              </button>
              <button onClick={handleApply} className="btn-primary">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Áp dụng
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
