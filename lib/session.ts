// Access token ngắn hạn (có hạn dùng "exp" được ký và kiểm tra thật) + refresh
// token dài hạn để tự cấp lại access token khi hết hạn — không lưu server-side.
// Dùng Web Crypto (crypto.subtle) thay vì node:crypto để chạy được cả trong
// middleware (Edge runtime) lẫn Route Handlers (Node runtime).

export type SessionPayload = {
  userId: string;
  role: "admin" | "user";
  fullName: string;
};

type TokenType = "access" | "refresh";

type TokenClaims = SessionPayload & { typ: TokenType; exp: number };

export const ACCESS_TOKEN_COOKIE = "app_access";
export const REFRESH_TOKEN_COOKIE = "app_refresh";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 30; // 30 phút
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 ngày

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// TS's lib.dom BufferSource typing doesn't always line up with Uint8Array's
// generic ArrayBufferLike param across TS versions; the runtime shape is
// always a valid BufferSource for SubtleCrypto, so cast through unknown.
function bufSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET chưa được cấu hình trong .env");
  return crypto.subtle.importKey(
    "raw",
    bufSource(new TextEncoder().encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signToken(claims: TokenClaims): Promise<string> {
  const key = await getKey();
  const payloadBytes = new TextEncoder().encode(JSON.stringify(claims));
  const payloadB64 = base64UrlEncode(payloadBytes);
  const signature = await crypto.subtle.sign("HMAC", key, bufSource(new TextEncoder().encode(payloadB64)));
  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${payloadB64}.${sigB64}`;
}

async function verifyToken(token: string | undefined | null, expectedType: TokenType): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      bufSource(base64UrlDecode(sigB64)),
      bufSource(new TextEncoder().encode(payloadB64))
    );
    if (!valid) return null;

    const json = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const claims = JSON.parse(json) as TokenClaims;

    if (claims.typ !== expectedType) return null;
    if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;

    const { typ, exp, ...payload } = claims;
    return payload;
  } catch {
    return null;
  }
}

export async function createAccessToken(payload: SessionPayload): Promise<string> {
  return signToken({ ...payload, typ: "access", exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS });
}

export async function createRefreshToken(payload: SessionPayload): Promise<string> {
  return signToken({ ...payload, typ: "refresh", exp: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS });
}

export async function verifyAccessToken(token: string | undefined | null): Promise<SessionPayload | null> {
  return verifyToken(token, "access");
}

export async function verifyRefreshToken(token: string | undefined | null): Promise<SessionPayload | null> {
  return verifyToken(token, "refresh");
}
