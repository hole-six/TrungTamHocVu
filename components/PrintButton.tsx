"use client";

import { printPage } from "@/lib/export-utils";

export default function PrintButton({
  label = "In hóa đơn",
  pageSize,
  margin,
}: {
  label?: string;
  pageSize?: string;
  margin?: string;
}) {
  return (
    <button onClick={() => printPage({ pageSize, margin })} className="btn-primary print:hidden">
      {label}
    </button>
  );
}
