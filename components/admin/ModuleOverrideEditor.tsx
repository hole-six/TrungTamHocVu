"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccessLevel, ModuleKey } from "@/lib/server/role-matrix";

const OVERRIDE_LEVELS: AccessLevel[] = ["VIEW_LIMITED", "VIEW", "CREATE_VIEW", "UPDATE_VIEW", "APPROVE_VIEW", "FULL"];

export default function ModuleOverrideEditor({
  userId,
  module,
  moduleLabel,
  defaultLevelLabel,
  currentOverride,
  levelLabel,
  overrideAware,
}: {
  userId: string;
  module: ModuleKey;
  moduleLabel: string;
  defaultLevelLabel: string;
  currentOverride: AccessLevel | null;
  levelLabel: Record<AccessLevel, string>;
  overrideAware: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function save(level: AccessLevel | null) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/users/${userId}/module-overrides`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, level, reason: reason.trim() || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Không thể cập nhật quyền bổ sung.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-ink">{moduleLabel}</p>
        <p className="text-xs text-ink-muted48">
          Mặc định theo vai trò: {defaultLevelLabel}
          {!overrideAware && " · module này chưa áp dụng override ở API"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {currentOverride && (
          <input
            type="text"
            placeholder="Lý do (không bắt buộc)"
            defaultValue={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            className="w-40 rounded-md border-hairline text-xs"
          />
        )}
        <select
          className="rounded-md border-hairline text-xs"
          value={currentOverride ?? ""}
          disabled={loading}
          onChange={(e) => save((e.target.value || null) as AccessLevel | null)}
        >
          <option value="">— Theo vai trò ({defaultLevelLabel}) —</option>
          {OVERRIDE_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {levelLabel[lvl]}
            </option>
          ))}
        </select>
        {currentOverride && (
          <span className="badge-blue text-[10px]">Đã cấp thêm</span>
        )}
      </div>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
