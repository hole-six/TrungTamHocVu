"use client";

export default function PrintButton({ label = "In hóa đơn" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-primary print:hidden">
      {label}
    </button>
  );
}
