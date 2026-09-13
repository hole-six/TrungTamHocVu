/* eslint-disable no-restricted-globals */

// v4: bản v3 cache-first MỌI request GET không phải điều hướng — gồm cả dữ liệu trang
// của Next.js khi chuyển trang bằng link / router.refresh() (GET ...?_rsc=<mã>, mã chỉ
// phụ thuộc trạng thái điều hướng, không đổi theo thời gian). Hậu quả trên production:
// chuyển trang hiện dữ liệu của LẦN ĐẦU xem trang đó, lưu xong router.refresh() không
// cập nhật, và sau mỗi lần deploy dữ liệu cũ trỏ tới chunk đã bị xóa → ChunkLoadError.
// Đổi tên cache để activate xóa sạch cache v3 đã nhiễm dữ liệu cũ trên máy người dùng.
const CACHE_NAME = "tach-v4";
const RUNTIME_CACHE = "tach-runtime-v4";

// Assets to cache on install
const PRECACHE_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/pwa-icons/icon-192.png",
  "/pwa-icons/icon-512.png",
];

// Install event - precache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
      })
      .then((cachesToDelete) => {
        return Promise.all(
          cachesToDelete.map((cacheToDelete) => {
            return caches.delete(cacheToDelete);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event — chọn chiến lược theo LOẠI request, không dùng chung 1 kiểu cho tất cả:
// - Điều hướng trang (HTML): network-first — đây là app quản lý dữ liệu thật (học phí,
//   điểm danh, lương...), ưu tiên bản mới nhất khi còn mạng, cache chỉ để lỡ mất mạng
//   thì còn cái mà xem, không để lỡ tay hiện lại dashboard cũ khi đang online.
// - API (/api/...): không đụng cache, luôn đi thẳng network — dữ liệu nghiệp vụ không
//   được phép trả bản cache.
// - Tài nguyên tĩnh BẤT BIẾN (_next/static có hash trong tên, icon PWA): cache-first.
// - MỌI THỨ CÒN LẠI (dữ liệu trang RSC, file public khác...): không đụng tới, để trình
//   duyệt đi thẳng mạng. Chỉ cache-first những gì CHẮC CHẮN không bao giờ đổi nội dung.
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!request.url.startsWith(self.location.origin)) return;
  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return;
  const url = new URL(request.url);
  // Dữ liệu trang của Next.js (chuyển trang bằng link, router.refresh, prefetch) — luôn
  // lấy mới. Kiểm tra cả query lẫn header vì prefetch có thể không mang query.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseToCache));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/offline"))),
    );
    return;
  }

  if (!isImmutableAsset(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseToCache));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-data") {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Implement your sync logic here
  console.log("Syncing data in background...");
}

// Push notifications (optional)
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || "Bạn có thông báo mới",
    icon: "/pwa-icons/icon-192.png",
    badge: "/pwa-icons/badge-72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.id || 1,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "TACH", options)
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/")
  );
});
