"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary print:hidden">
      In hóa đơn
    </button>
  );
}
