"use client";

import { useState } from "react";
import { exportToCSV, exportToExcel, exportToJSON, generateReportTitle } from "@/lib/export-utils";

type ExportFormat = "csv" | "excel" | "json";

type ExportButtonProps<T> = {
  data: T[];
  columns: { key: keyof T; label: string; format?: (value: any) => string }[];
  filename: string;
  formats?: ExportFormat[];
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function ExportButton<T>({
  data,
  columns,
  filename,
  formats = ["excel", "csv", "json"],
  variant = "ghost",
  size = "md",
  className = "",
}: ExportButtonProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    setIsOpen(false);

    try {
      const reportFilename = generateReportTitle(filename);

      switch (format) {
        case "excel":
          exportToExcel(data, columns, reportFilename);
          break;
        case "csv":
          exportToCSV(data, columns, reportFilename);
          break;
        case "json":
          exportToJSON(data, reportFilename);
          break;
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Xuất file thất bại. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-3 text-base",
  };

  const variantClasses = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-ghost",
  };

  const formatIcons: Record<ExportFormat, JSX.Element> = {
    excel: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="15" x2="15" y2="15" />
        <line x1="9" y1="18" x2="15" y2="18" />
        <line x1="9" y1="12" x2="15" y2="12" />
      </svg>
    ),
    csv: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    json: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M10 12h4" />
        <path d="M10 16h4" />
      </svg>
    ),
  };

  const formatLabels: Record<ExportFormat, string> = {
    excel: "Excel (.xls)",
    csv: "CSV (.csv)",
    json: "JSON (.json)",
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={exporting || data.length === 0}
        className={`${variantClasses[variant]} ${sizeClasses[size]} flex items-center gap-2`}
      >
        {exporting ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
            </svg>
            <span>Đang xuất...</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Xuất file</span>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-[#e8edf5] bg-white shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-[#e8edf5] bg-[#fafbff]">
              <p className="text-xs font-semibold text-ink-muted48">
                Chọn định dạng ({data.length} dòng)
              </p>
            </div>
            <div className="py-1">
              {formats.map((format) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ink hover:bg-[#f8fafc] transition-colors"
                >
                  <div className="text-primary">{formatIcons[format]}</div>
                  <span>{formatLabels[format]}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
