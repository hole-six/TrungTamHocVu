export default function ModulePlaceholder({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: string[];
}) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">{title}</h1>
            <span className="badge-amber">Sắp có</span>
          </div>
          <p className="page-subtitle">{description}</p>
        </div>
      </div>

      {/* Status card */}
      <div className="card border-l-4 border-l-primary">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-ink">Đang triển khai</p>
            <p className="mt-1 text-sm text-ink-muted80">
              Cấu trúc dữ liệu cho module này đã có sẵn trong cơ sở dữ liệu (theo đúng đối chiếu Excel vận hành + yêu cầu
              PDF). Giao diện và API cho các phân hệ dưới đây sẽ được xây theo đúng mẫu tham chiếu của module{" "}
              <span className="font-medium text-ink">Học viên</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Sections grid */}
      {sections.length > 0 && (
        <div className="card">
          <div className="section-header mb-4">
            <h2 className="section-title">Phân hệ trong module</h2>
            <span className="text-xs text-ink-muted48">{sections.length} phân hệ</span>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sections.map((s) => (
              <li
                key={s}
                className="flex items-center gap-2.5 rounded-lg border border-hairline bg-canvas-parchment/50 px-3 py-2.5 text-sm text-ink-muted80"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
