"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <svg
            className="mx-auto h-24 w-24"
            style={{ color: "var(--text-muted)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 17h-2m-4 0H9m12-4h-2"
            />
          </svg>
        </div>

        <h1
          className="text-3xl font-bold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          🔌 Không có kết nối
        </h1>

        <p
          className="text-base mb-6"
          style={{ color: "var(--text-secondary)" }}
        >
          Bạn đang offline. Vui lòng kiểm tra kết nối mạng của bạn.
        </p>

        <div
          className="rounded-xl border p-6 mb-6"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-primary)",
          }}
        >
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            💡 Gợi ý:
          </h2>
          <ul
            className="text-sm text-left space-y-2"
            style={{ color: "var(--text-secondary)" }}
          >
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Kiểm tra kết nối WiFi hoặc dữ liệu di động</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Tắt chế độ máy bay nếu đang bật</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Thử tải lại trang sau khi có mạng</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Thử lại
        </button>

        <p
          className="text-xs mt-6"
          style={{ color: "var(--text-muted)" }}
        >
          Một số tính năng có thể vẫn hoạt động offline
        </p>
      </div>
    </div>
  );
}
