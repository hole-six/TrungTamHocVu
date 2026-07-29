/* eslint-disable no-restricted-globals */

const CACHE_NAME = "tach-v1";
const RUNTIME_CACHE = "tach-runtime-v1";

// Assets to cache on install
const PRECACHE_URLS = [
  "/",
  "/offline",
  // Add other critical assets here
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

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  // Skip cross-origin requests
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return caches.open(RUNTIME_CACHE).then((cache) => {
          return fetch(event.request).then((response) => {
            // Only cache successful responses
            if (response.status === 200) {
              // Don't cache API calls or dynamic content
              if (!event.request.url.includes("/api/")) {
                cache.put(event.request, response.clone());
              }
            }
            return response;
          }).catch(() => {
            // Return offline page if available
            if (event.request.mode === "navigate") {
              return caches.match("/offline");
            }
          });
        });
      })
    );
  }
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
    icon: "/icon-192.png",
    badge: "/badge-72.png",
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
