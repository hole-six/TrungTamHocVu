"use client";

import Link from "next/link";
import { ReactNode } from "react";

const ERP_FLOW = [
  "Tuyển sinh và test đầu vào",
  "Ghi danh, xếp lớp, lịch học",
  "Học phí, công nợ, hoàn tiền",
  "Kho sách, giáo trình, nhân sự",
];

const ERP_HIGHLIGHTS = [
  {
    title: "Một nguồn dữ liệu duy nhất",
    description: "Giảm lệch số giữa các phòng ban và giữa từng cơ sở.",
  },
  {
    title: "Điều hành theo vai trò",
    description: "Admin, giáo vụ, kế toán, tư vấn đều nhìn đúng phần việc của mình.",
  },
  {
    title: "Sẵn sàng thay Excel thủ công",
    description: "Quy trình rõ ràng hơn, kiểm soát tốt hơn và truy vết nhanh hơn.",
  },
];

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
};

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,172,254,0.16),_transparent_26%),radial-gradient(circle_at_85%_12%,_rgba(102,126,234,0.18),_transparent_24%),linear-gradient(180deg,_#f8faff_0%,_#eef4ff_100%)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="flex flex-col justify-between gap-10 rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(244,248,255,0.92))] p-8 shadow-[0_32px_90px_-42px_rgba(15,23,42,0.45)] backdrop-blur lg:p-10">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7dd3fc_0%,#0284c7_100%)] text-lg font-black text-white shadow-[0_16px_40px_-18px_rgba(14,165,233,0.9)]">
                  T
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#5b6f99]">
                    TACH ERP
                  </p>
                  <p className="text-sm text-[#64748b]">Điều hành trung tâm đào tạo</p>
                </div>
              </Link>
              <Link href="/" className="btn-ghost">
                Về landing page
              </Link>
            </div>

            <div className="space-y-5">
              <p className="inline-flex rounded-full border border-[#dbe7ff] bg-white/80 px-4 py-2 text-sm font-semibold text-[#4f46e5] shadow-sm">
                {eyebrow}
              </p>
              <h1 className="max-w-2xl text-4xl font-black leading-tight text-transparent sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#4b5d82]">
                {subtitle}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {ERP_HIGHLIGHTS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/75 bg-white/80 p-5 shadow-sm"
                >
                  <p className="text-base font-bold text-[#0f172a]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#64748b]">{item.description}</p>
                </div>
              ))}
              <div className="rounded-3xl bg-[#0f172a] p-5 text-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.8)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  Vòng đời dữ liệu
                </p>
                <div className="mt-4 space-y-3">
                  {ERP_FLOW.map((item, index) => (
                    <div key={item} className="flex items-center gap-3 text-sm">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="font-medium text-white/90">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/70 px-5 py-4 text-sm text-[#55657f] shadow-sm">
            Đội vận hành cần một luồng đăng nhập rõ ràng, nhanh và đúng vai trò để vào hệ
            thống là làm việc được ngay.
          </div>
        </section>

        <section className="flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-lg rounded-[32px] border border-white/80 bg-white/92 p-8 shadow-[0_36px_90px_-42px_rgba(15,23,42,0.45)] backdrop-blur lg:p-10">
            {children}
            <div className="mt-8 border-t border-[#e5eaf7] pt-5 text-sm text-[#64748b]">
              {footer}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
