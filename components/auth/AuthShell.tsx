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
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 sm:py-8 md:justify-end md:pr-[6%] lg:pr-[10%]">
        <div className="w-full max-w-[430px] rounded-2xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:rounded-3xl sm:p-6 md:p-8 md:shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
          {eyebrow || title || subtitle ? (
            <div className="mb-5 space-y-2.5 sm:mb-6 sm:space-y-3">
              {eyebrow ? (
                <div className="inline-flex rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4f46e5] sm:px-3 sm:py-1 sm:text-xs">
                  {eyebrow}
                </div>
              ) : null}
              {title ? <h1 className="text-2xl font-black leading-tight text-[#12304a] sm:text-3xl">{title}</h1> : null}
              {subtitle ? <p className="text-xs leading-6 text-[#64748b] sm:text-sm">{subtitle}</p> : null}
            </div>
          ) : null}

          {children}

          {footer ? <div className="mt-5 border-t border-[#e8eef8] pt-4 text-xs text-[#5d6d88] sm:mt-6 sm:pt-5 sm:text-sm">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
