import Link from "next/link";
import GuardianForm from "@/components/guardians/GuardianForm";

export default function NewGuardianPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/guardians"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#e8edf5] hover:bg-[#f8fafc] transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Thêm phụ huynh mới</h1>
          <p className="page-subtitle">Tạo hồ sơ phụ huynh vào hệ thống</p>
        </div>
      </div>

      <div className="card">
        <GuardianForm />
      </div>
    </div>
  );
}
