#!/usr/bin/env bash
# Deploy lên VPS KHÔNG làm sập site đang chạy.
#
# Vì sao có file này: script cũ trong .github/workflows/deploy.yml chạy thẳng trên thư mục
# site đang phục vụ:
#   - `npm ci` XÓA SẠCH node_modules rồi cài lại trong khi server vẫn đang require từ đó;
#   - `npm run build` GHI ĐÈ thư mục .next trong khi server vẫn đang đọc chunk từ đó.
# Suốt vài phút build, mshangedu.com trả 500 và thiếu chunk (ChunkLoadError) — mỗi lần
# đẩy code là site sập một lần.
#
# Cách làm mới (xanh/lá): luôn có 2 thư mục build .next-a / .next-b. Build vào thư mục
# KHÔNG đang chạy, build xong mới chuyển server sang, kiểm tra sống; hỏng thì quay lại
# thư mục cũ. Site đang chạy không bị đụng tới cho tới lúc chuyển (vài giây restart).
set -euo pipefail

APP_NAME="mshangedu"
APP_DIR="${APP_DIR:-/var/www/mshangedu}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5050/login}"
HEALTH_TRIES="${HEALTH_TRIES:-30}"
cd "$APP_DIR"

ACTIVE_FILE=".active-dist"
ACTIVE="$(cat "$ACTIVE_FILE" 2>/dev/null || echo ".next")"
if [ "$ACTIVE" = ".next-a" ]; then NEXT_DIST=".next-b"; else NEXT_DIST=".next-a"; fi
echo "[deploy] đang chạy: $ACTIVE → build vào: $NEXT_DIST"

# Commit TRƯỚC khi git pull — workflow truyền vào. Không có thì coi như thư viện có thể đã
# đổi và cài lại cho chắc.
BEFORE="${DEPLOY_BEFORE_SHA:-}"

# Chỉ cài lại thư viện khi package-lock.json thật sự đổi. `npm ci` xóa node_modules của
# server đang chạy — đây là bước DUY NHẤT còn làm site chập chờn, và hầu hết lần deploy
# không đổi thư viện nên bỏ qua được.
if [ -z "$BEFORE" ] || ! git diff --quiet "$BEFORE" HEAD -- package.json package-lock.json; then
  echo "[deploy] thư viện thay đổi → npm ci"
  npm ci
else
  echo "[deploy] thư viện không đổi → bỏ qua npm ci"
fi

npx prisma migrate deploy
npx prisma generate

rm -rf "$NEXT_DIST"
NEXT_DIST_DIR="$NEXT_DIST" npm run build

# Giữ lại chunk của bản đang chạy trong bản mới: tab trình duyệt mở từ trước khi deploy
# vẫn tải chunk theo tên cũ — thiếu là ChunkLoadError. Tên chunk có hash nên không bao
# giờ trùng/ghi đè nhau (-n). Giữ nguyên ngày sửa (-p) để dọn được chunk quá 7 ngày.
if [ -d "$ACTIVE/static" ]; then
  cp -rnp "$ACTIVE/static/." "$NEXT_DIST/static/" || true
  find "$NEXT_DIST/static" -type f -mtime +7 -delete || true
fi

switch_to() {
  echo "$1" > "$ACTIVE_FILE"
  # Restart ĐÚNG process đang chạy theo tên, chỉ đổi biến môi trường — giữ nguyên lệnh
  # chạy/node đang dùng (đã chạy được), không khởi động lại từ file cấu hình. pm2 save để
  # VPS khởi động lại (pm2 resurrect) vẫn nhớ đúng thư mục build.
  NODE_ENV=production NEXT_DIST_DIR="$1" pm2 restart "$APP_NAME" --update-env
  pm2 save >/dev/null || true
}

healthy() {
  for _ in $(seq 1 "$HEALTH_TRIES"); do
    if curl -sf -o /dev/null "$HEALTH_URL"; then return 0; fi
    sleep 1
  done
  return 1
}

switch_to "$NEXT_DIST"
if healthy; then
  echo "[deploy] OK — đang chạy $NEXT_DIST"
  # Thư mục build mặc định cũ (.next, trước khi dùng a/b) không còn process nào dùng nữa.
  # Thư mục a/b còn lại GIỮ NGUYÊN để lần sau quay lại được và để copy chunk cũ.
  if [ -d ".next" ]; then rm -rf .next; fi
else
  echo "[deploy] bản mới không phản hồi — QUAY LẠI $ACTIVE" >&2
  switch_to "$ACTIVE"
  healthy || echo "[deploy] cảnh báo: bản cũ cũng không phản hồi, cần kiểm tra tay" >&2
  exit 1
fi
