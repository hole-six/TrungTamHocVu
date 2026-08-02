"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Lightbulb, ListChecks, X } from "lucide-react";

type GuideSection = {
  title: string;
  items: string[];
  tone?: "info" | "success" | "warning";
};

function toneClasses(tone: GuideSection["tone"]) {
  if (tone === "success") {
    return {
      card: "border-emerald-200 bg-emerald-50/80",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2.3} />,
      title: "text-emerald-900",
      item: "text-emerald-800",
    };
  }

  if (tone === "warning") {
    return {
      card: "border-amber-200 bg-amber-50/90",
      icon: <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={2.3} />,
      title: "text-amber-900",
      item: "text-amber-800",
    };
  }

  return {
    card: "border-[#dbe7ff] bg-white/95",
    icon: <Lightbulb className="h-4 w-4 text-[#1f6feb]" strokeWidth={2.3} />,
    title: "text-ink",
    item: "text-ink-muted80",
  };
}

export default function FormGuide({
  title,
  summary,
  sections,
  position = "floating",
  buttonLabel = "Guide",
}: {
  title: string;
  summary: string;
  sections: GuideSection[];
  position?: "floating" | "inline";
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const wrapperClassName = useMemo(() => {
    if (position === "inline") return "relative shrink-0";
    return "pointer-events-none fixed bottom-6 right-6 z-[90]";
  }, [position]);

  const buttonClassName =
    position === "inline"
      ? "inline-flex h-11 items-center gap-2 rounded-2xl border border-[#dbe7ff] bg-white px-4 text-sm font-semibold text-[#1f6feb] shadow-sm transition hover:border-[#1f6feb] hover:bg-[#f7fbff]"
      : "pointer-events-auto inline-flex h-14 items-center gap-3 rounded-full border border-[#dbe7ff] bg-white/95 px-5 text-sm font-semibold text-[#1f6feb] shadow-[0_18px_45px_rgba(31,111,235,0.16)] backdrop-blur";

  return (
    <div className={wrapperClassName}>
      <button type="button" onClick={() => setOpen((current) => !current)} className={buttonClassName}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eaf3ff]">
          <HelpCircle className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span>{buttonLabel}</span>
      </button>

      {open ? (
        <div
          className={
            position === "inline"
              ? "absolute right-0 top-[calc(100%+12px)] z-[95] w-[380px] max-w-[calc(100vw-32px)] rounded-[26px] border border-[#dbe7ff] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]"
              : "pointer-events-auto mt-3 w-[420px] max-w-[calc(100vw-32px)] rounded-[28px] border border-[#dbe7ff] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]"
          }
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#e6eefc] px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#edf5ff] text-[#1f6feb]">
                  <ListChecks className="h-4.5 w-4.5" strokeWidth={2.3} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1f6feb]">Hướng dẫn vận hành</p>
                  <h3 className="text-base font-semibold text-ink">{title}</h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-muted80">{summary}</p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e6eefc] bg-white text-ink-muted48 transition hover:border-[#1f6feb] hover:text-[#1f6feb]"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
            {sections.map((section) => {
              const tone = toneClasses(section.tone);
              return (
                <section key={section.title} className={`rounded-2xl border p-4 ${tone.card}`}>
                  <div className="mb-3 flex items-center gap-2">
                    {tone.icon}
                    <h4 className={`text-sm font-semibold ${tone.title}`}>{section.title}</h4>
                  </div>
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li key={item} className={`flex gap-2 text-sm leading-6 ${tone.item}`}>
                        <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
