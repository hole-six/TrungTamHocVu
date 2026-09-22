export const PHONE_ERROR = "Số điện thoại phải đúng 10 chữ số.";

export function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidPhone(value: unknown): boolean {
  const normalized = normalizePhone(value);
  return normalized.length === 10;
}

export function normalizeOptionalPhone(value: unknown): string {
  const normalized = normalizePhone(value);
  return normalized;
}

export function validateOptionalPhone(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const normalized = normalizeOptionalPhone(value);
  if (!normalized) return { ok: true, value: "" };
  if (normalized.length !== 10) return { ok: false, error: PHONE_ERROR };
  return { ok: true, value: normalized };
}
