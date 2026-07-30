import Link from "next/link";

type ModuleAction = {
  label: string;
  description: string;
  href: string;
  tone?: "primary" | "success" | "warning" | "info";
};

type ModuleMetric = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

const toneClassMap: Record<NonNullable<ModuleAction["tone"]>, string> = {
  primary: "from-sky-50 to-white border-sky-200 text-sky-700",
  success: "from-emerald-50 to-white border-emerald-200 text-emerald-700",
  warning: "from-amber-50 to-white border-amber-200 text-amber-700",
  info: "from-violet-50 to-white border-violet-200 text-violet-700",
};

const metricToneMap: Record<NonNullable<ModuleMetric["tone"]>, string> = {
  default: "text-slate-900",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
  info: "text-sky-700",
};

export default function ModuleActionHub({
  title,
  subtitle,
  actions,
  metrics,
}: {
  title: string;
  subtitle: string;
  actions: ModuleAction[];
  metrics: ModuleMetric[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-[#e8eef9] bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted48">Lối vào thao tác</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{title}</h2>
            <p className="mt-1 text-sm text-ink-muted48">{subtitle}</p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={`rounded-[22px] border bg-gradient-to-br px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-md ${toneClassMap[action.tone ?? "primary"]}`}
              >
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="mt-1 text-xs text-ink-muted48">{action.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[22px] border border-[#e8eef9] bg-white px-4 py-4 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.45)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted48">{metric.label}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${metricToneMap[metric.tone ?? "default"]}`}>{metric.value}</p>
            {metric.hint ? <p className="mt-1 text-xs text-ink-muted48">{metric.hint}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
