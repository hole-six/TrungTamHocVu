import { cookies, headers } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  SessionPayload,
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./session";

// Cookie "Secure" chỉ nên bật khi request THỰC SỰ qua HTTPS — không phải cứ
// production là bật cứng. Nếu domain chưa kịp cấp SSL mà ép Secure=true,
// trình duyệt sẽ âm thầm từ chối lưu cookie khi truy cập qua HTTP, khiến
// đăng nhập báo "hết hạn phiên" dù mọi thứ khác đều đúng. Dùng header
// x-forwarded-proto (Nginx set) để biết chính xác request đang tới qua
// giao thức nào.
function isSecureRequest(): boolean {
  const proto = headers().get("x-forwarded-proto");
  if (proto) return proto === "https";
  return process.env.NODE_ENV === "production";
}

// Shim tương thích NextAuth-style cho các helper mới (lib/branch-filter.ts) đang
// gọi `auth()` rồi đọc `session.user.id` — hệ thống này dùng cookie session tự ký
// (không phải NextAuth) nên không có `auth()` gốc; hàm này bọc lại getSession() để
// trả về đúng hình dạng { user: { id, role, fullName } } mà code gọi nó mong đợi,
// tránh phải viết lại toàn bộ branch-filter.ts sang API session khác.
export async function auth(): Promise<{ user: { id: string; role: string; fullName: string } } | null> {
  const session = await getSession();
  if (!session) return null;
  return { user: { id: session.userId, role: session.role, fullName: session.fullName } };
}

export async function getSession(): Promise<SessionPayload | null> {
  const accessPayload = await verifyAccessToken(cookies().get(ACCESS_TOKEN_COOKIE)?.value);
  if (accessPayload) return accessPayload;

  const refreshPayload = await verifyRefreshToken(cookies().get(REFRESH_TOKEN_COOKIE)?.value);
  if (!refreshPayload) return null;

  // Access token hết hạn nhưng refresh token còn hiệu lực — tự cấp lại access
  // token mới để không bắt người dùng đăng nhập lại giữa chừng.
  const newAccessToken = await createAccessToken(refreshPayload);
  try {
    cookies().set(ACCESS_TOKEN_COOKIE, newAccessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(),
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    });
  } catch {
    // Đang render trong Server Component (chỉ đọc được cookie, không set được)
    // — middleware sẽ cấp lại access token mới ở request kế tiếp.
  }
  return refreshPayload;
}

export async function setSessionCookie(payload: SessionPayload) {
  const accessToken = await createAccessToken(payload);
  const refreshToken = await createRefreshToken(payload);
  const secure = isSecureRequest();

  cookies().set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  cookies().set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearSessionCookie() {
  cookies().delete(ACCESS_TOKEN_COOKIE);
  cookies().delete(REFRESH_TOKEN_COOKIE);
}
