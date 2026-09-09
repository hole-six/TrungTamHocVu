"use client";

export default function PrintNowButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary shrink-0">
      In / Lưu PDF
    </button>
  );
}
