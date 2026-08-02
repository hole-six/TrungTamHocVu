"use client";

import { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
};

export default function AuthShell({ children, eyebrow, title, subtitle, footer }: AuthShellProps) {
  return (
    <main
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        backgroundImage: "url('/img/login (2).png')",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="relative z-10 flex min-h-screen items-center justify-end pr-[6%] lg:pr-[10%]">
        <div className="w-full max-w-[430px] rounded-3xl bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
          {eyebrow || title || subtitle ? (
            <div className="mb-6 space-y-3">
              {eyebrow ? (
                <div className="inline-flex rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#4f46e5]">
                  {eyebrow}
                </div>
              ) : null}
              {title ? <h1 className="text-3xl font-black leading-tight text-[#12304a]">{title}</h1> : null}
              {subtitle ? <p className="text-sm leading-6 text-[#64748b]">{subtitle}</p> : null}
            </div>
          ) : null}

          {children}

          {footer ? <div className="mt-6 border-t border-[#e8eef8] pt-5 text-sm text-[#5d6d88]">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
