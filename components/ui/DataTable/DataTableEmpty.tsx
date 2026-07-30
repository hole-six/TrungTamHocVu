type DataTableEmptyProps = {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export default function DataTableEmpty({
  title = "Không có dữ liệu",
  description = "Không tìm thấy kết quả nào phù hợp với tìm kiếm của bạn.",
  action,
}: DataTableEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f1f5f9] to-[#e2e8f0]">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      <h3 className="mb-2 font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mb-6 max-w-md text-center text-sm text-ink-muted48">{description}</p>
      {action ? (
        <button type="button" onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
