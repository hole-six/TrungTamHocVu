"use client";

import { useState } from "react";
import PipelineStackEditorModal from "./PipelineStackEditorModal";

export default function PipelineStackEditorTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-bold text-[#0f1729] transition hover:border-[#0f1729]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7" /></svg>
        Sắp xếp ngăn xếp
      </button>
      <PipelineStackEditorModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
