import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./lib/session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/leads",
  "/students",
  "/guardians",
  "/classes",
  "/calendar",
  "/timesheets",
  "/tuition",
  "/inventory",
  "/assets",
  "/cashbook",
  "/payroll",
  "/reports",
  "/admin",
  "/invoices",
];

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leads/:path*",
    "/students/:path*",
    "/guardians/:path*",
    "/classes/:path*",
    "/calendar/:path*",
    "/timesheets/:path*",
    "/tuition/:path*",
    "/inventory/:path*",
    "/assets/:path*",
    "/cashbook/:path*",
    "/payroll/:path*",
    "/reports/:path*",
    "/admin/:path*",
    "/invoices/:path*",
    "/login",
    "/register",
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  let session = await verifyAccessToken(req.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
  let refreshedAccessToken: string | null = null;

  // Access token hết hạn nhưng refresh token còn hiệu lực — tự cấp lại access
  // token mới ngay tại request này, đồng thời đưa vào request.headers để các
  // Server Component render sau middleware đọc được session mới ngay lập tức.
  if (!session) {
    const refreshPayload = await verifyRefreshToken(req.cookies.get(REFRESH_TOKEN_COOKIE)?.value);
    if (refreshPayload) {
      session = refreshPayload;
      refreshedAccessToken = await createAccessToken(refreshPayload);
      req.cookies.set(ACCESS_TOKEN_COOKIE, refreshedAccessToken);
    }
  }

  let response = NextResponse.next({ request: { headers: req.headers } });

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!session) {
      response = NextResponse.redirect(loginUrl);
    } else if (pathname.startsWith("/admin") && session.role !== "admin") {
      response = NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Đã đăng nhập rồi thì không cần vào lại trang login/register.
  if ((pathname === "/login" || pathname === "/register") && session) {
    response = NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Dựa theo giao thức THỰC của request (x-forwarded-proto do Nginx set),
  // không ép cứng theo NODE_ENV — tránh cookie bị trình duyệt âm thầm từ
  // chối lưu khi domain chưa có SSL.
  const isHttps = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")) === "https";

  if (refreshedAccessToken) {
    response.cookies.set(ACCESS_TOKEN_COOKIE, refreshedAccessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  return response;
}
