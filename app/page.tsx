import Link from "next/link";
import { getSession } from "@/lib/auth";

const ERP_MODULES = [
  {
    name: "CRM tuyển sinh",
    description: "Lead, lịch hẹn, test đầu vào và chuyển đổi ghi danh.",
  },
  {
    name: "Học viên & lớp học",
    description: "Hồ sơ, lịch học, điểm danh và tiến độ theo từng cơ sở.",
  },
  {
    name: "Học phí & công nợ",
    description: "Tạo kỳ thu, ghi nhận thanh toán, hoàn tiền và cảnh báo nợ.",
  },
  {
    name: "Kho & giáo trình",
    description: "Nhập xuất tồn, cấp sách cho học viên và kiểm kê minh bạch.",
  },
];

const ERP_PILLARS = [
  "Đồng bộ dữ liệu giữa tuyển sinh, đào tạo, tài chính và nhân sự",
  "Theo dõi từng cơ sở, từng lớp, từng học viên theo thời gian thực",
  "Chuẩn hóa quy trình từ workbook Excel sang một ERP vận hành khép kín",
];

const ERP_METRICS = [
  { value: "01", label: "Hệ thống trung tâm" },
  { value: "06", label: "Phân hệ vận hành" },
  { value: "360°", label: "Góc nhìn dữ liệu" },
];

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,172,254,0.16),_transparent_26%),radial-gradient(circle_at_85%_12%,_rgba(102,126,234,0.18),_transparent_24%),linear-gradient(180deg,_#f8faff_0%,_#eef4ff_100%)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-white/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4facfe_0%,#667eea_100%)] text-lg font-black text-white shadow-[0_16px_40px_-18px_rgba(79,172,254,0.9)]">
              T
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#5b6f99]">
                TACH ERP
              </p>
              <p className="text-sm text-[#64748b]">
                Hệ thống vận hành trung tâm đào tạo đa cơ sở
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {session ? (
              <>
                <div className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-[#475569] shadow-sm backdrop-blur">
                  Xin chào <span className="font-semibold text-[#0f172a]">{session.fullName}</span>
                </div>
                <Link href="/dashboard" className="btn-primary">
                  Vào bảng điều hành
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-primary">
                  Đăng nhập ERP
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.2fr_0.8fr] lg:py-16">
          <div className="space-y-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dbe7ff] bg-white/80 px-4 py-2 text-sm font-semibold text-[#4f46e5] shadow-sm backdrop-blur">
              ERP thực chiến cho tuyển sinh, lớp học, học phí và kho
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-black leading-[1.05] text-transparent sm:text-6xl lg:text-7xl">
                Một màn hình điều phối toàn bộ trung tâm, đẹp, rõ và vận hành thật.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-[#4b5d82] sm:text-xl">
                TACH ERP gom toàn bộ luồng tuyển sinh, học viên, lớp học, học phí,
                thu chi, kho giáo trình và nhân sự vào một hệ thống thống nhất để
                đội vận hành làm việc nhanh hơn, ít lỗi hơn và nhìn dữ liệu chính xác hơn.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {ERP_METRICS.map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/70 bg-white/80 px-5 py-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur"
                >
                  <p className="text-3xl font-black text-[#0f172a]">{item.value}</p>
                  <p className="mt-2 text-sm font-medium text-[#60708f]">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={session ? "/dashboard" : "/login"} className="btn-primary">
                {session ? "Mở dashboard ngay" : "Bắt đầu đăng nhập"}
              </Link>
            </div>

            <div className="grid gap-3">
              {ERP_PILLARS.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-4 text-sm text-[#475569] shadow-sm backdrop-blur"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4facfe_0%,#667eea_100%)] text-xs font-bold text-white">
                    ✓
                  </span>
                  <span className="leading-6">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[32px] bg-[linear-gradient(135deg,rgba(102,126,234,0.14),rgba(79,172,254,0.14))] blur-2xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_40px_90px_-38px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5b6f99]">
                    Bảng điều phối ERP
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-transparent">
                    Luồng dữ liệu vận hành
                  </h2>
                </div>
                <div className="rounded-2xl bg-[#eef4ff] px-3 py-2 text-sm font-semibold text-[#4f46e5]">
                  Live
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {ERP_MODULES.map((module, index) => (
                  <div
                    key={module.name}
                    className="rounded-3xl border border-[#e6edfb] bg-[linear-gradient(135deg,#ffffff_0%,#f7faff_100%)] p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8db0]">
                          Module {index + 1}
                        </p>
                        <p className="mt-2 text-lg font-bold text-[#0f172a]">{module.name}</p>
                        <p className="mt-2 text-sm leading-6 text-[#64748b]">
                          {module.description}
                        </p>
                      </div>
                      <span className="rounded-2xl bg-[#eff4ff] px-3 py-2 text-xs font-bold text-[#4f46e5]">
                        ERP
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-3xl bg-[#0f172a] px-5 py-5 text-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.8)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  Giá trị cốt lõi
                </p>
                <p className="mt-3 text-lg font-semibold leading-7">
                  Không còn tách rời giữa file Excel và vận hành thực tế — mọi quan hệ
                  học viên, lớp, thu tiền, xuất sách và chấm công nằm chung một logic.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
