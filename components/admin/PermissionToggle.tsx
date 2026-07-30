"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PermissionToggle({
  roleId,
  permissionId,
  granted,
  disabled,
  label,
  description,
}: {
  roleId: string;
  permissionId: string;
  granted: boolean;
  disabled?: boolean;
  label: string;
  description?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(granted);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !checked;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/roles/${roleId}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionId, granted: next }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Không thể cập nhật quyền.");
      return;
    }
    setChecked(next);
    router.refresh();
  }

  return (
    <label
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
        checked ? "border-primary/30 bg-primary/5" : "border-hairline"
      } ${disabled ? "opacity-60" : "cursor-pointer hover:border-primary/40"}`}
      title={error ?? undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled || loading}
        onChange={toggle}
        className="mt-0.5 h-3.5 w-3.5 rounded border-hairline text-primary"
      />
      <span>
        <span className="block font-mono font-medium text-ink">{label}</span>
        {description && <span className="block text-ink-muted48">{description}</span>}
        {error && <span className="block text-red-600">{error}</span>}
      </span>
    </label>
  );
}
