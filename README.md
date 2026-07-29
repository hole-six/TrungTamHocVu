# TACH

Khung khởi động dự án: **Next.js 14 (App Router) + TypeScript + TailwindCSS + Prisma/SQLite**, kèm sẵn hệ thống đăng ký/đăng nhập bằng cookie session tự ký (không phụ thuộc thư viện auth ngoài).

## Chạy dự án

```bash
# 1. Cài dependency
npm install

# 2. Tạo file .env từ mẫu
cp .env.example .env   # Windows: copy .env.example .env

# 3. Tạo schema + seed tài khoản admin mẫu
npx prisma migrate dev --name init
npm run prisma:seed

# 4. Chạy dev server
npm run dev
```

Mở http://localhost:3000

## Tài khoản demo

| Email | Mật khẩu |
|---|---|
| admin@demo.vn | Demo@123 |

## Biến môi trường (`.env`)

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | Có | Mặc định `file:./dev.db` (SQLite). Đổi `provider` trong `prisma/schema.prisma` sang `postgresql` nếu cần scale. |
| `SESSION_SECRET` | Có | Chuỗi ngẫu nhiên dài để ký cookie phiên đăng nhập — đổi giá trị khác cho từng môi trường. |
| `NEXT_PUBLIC_APP_URL` | Không | URL public của app. |

## Cấu trúc

- `app/page.tsx` — trang chủ, tự chuyển hướng theo trạng thái đăng nhập.
- `app/login`, `app/register` — form đăng nhập/đăng ký (client component gọi API).
- `app/dashboard` — trang mẫu được bảo vệ bởi middleware, chỉ vào được khi đã đăng nhập.
- `app/api/auth/*` — Route Handlers xử lý login/register/logout.
- `middleware.ts` — guard route `/dashboard`, `/admin`; tự refresh access token khi hết hạn.
- `lib/session.ts` — ký/xác thực JWT-style token bằng Web Crypto (chạy được cả Edge middleware lẫn Node route).
- `lib/auth.ts` — đọc/ghi cookie session ở Server Component & Route Handler.
- `lib/password.ts` — hash/verify mật khẩu bằng bcryptjs.
- `prisma/schema.prisma` — model `User` (email, passwordHash, fullName, role).
- `prisma/seed.ts` — seed tài khoản admin demo.

## Mở rộng

- Thêm model mới vào `prisma/schema.prisma` rồi chạy `npx prisma migrate dev --name <ten>`.
- Muốn thêm role/route bảo vệ mới: cập nhật `matcher` trong `middleware.ts` và logic kiểm tra `session.role`.
- Cần UI đẹp hơn: có thể bổ sung `lucide-react` (icon), `next-themes` (dark mode) như dự án gốc.
