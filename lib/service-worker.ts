/**
 * Service Worker registration and management
 */

type ServiceWorkerConfig = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
};

/**
 * Register service worker for offline support
 */
export async function registerServiceWorker(
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    console.log("Service workers are not supported");
    return null;
  }

  // Don't register in development
  if (process.env.NODE_ENV === "development") {
    console.log("Service worker disabled in development");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
    });

    console.log("✅ Service Worker registered:", registration.scope);

    // Check for updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New content available, notify user
            console.log("🔄 New content available, please refresh");
            config.onUpdate?.(registration);
          }
        });
      }
    });

    config.onSuccess?.(registration);
    return registration;
  } catch (error) {
    console.error("❌ Service Worker registration failed:", error);
    config.onError?.(error as Error);
    return null;
  }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const success = await registration.unregister();
    
    if (success) {
      console.log("✅ Service Worker unregistered");
    }
    
    return success;
  } catch (error) {
    console.error("❌ Service Worker unregistration failed:", error);
    return false;
  }
}

/**
 * Check if service worker is supported
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

/**
 * Check if service worker is active
 */
export async function isServiceWorkerActive(): Promise<boolean> {
  if (!isServiceWorkerSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return !!registration?.active;
  } catch {
    return false;
  }
}

/**
 * Update service worker
 */
export async function updateServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    console.log("🔄 Service Worker update checked");
  } catch (error) {
    console.error("❌ Service Worker update failed:", error);
  }
}

/**
 * Request background sync (for offline actions)
 */
export async function requestBackgroundSync(tag: string): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    
    if ("sync" in registration) {
      await (registration as any).sync.register(tag);
      console.log(`📡 Background sync requested: ${tag}`);
    } else {
      console.warn("Background sync not supported");
    }
  } catch (error) {
    console.error("❌ Background sync request failed:", error);
  }
}

/**
 * Check if online
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Add online/offline event listeners
 */
export function addNetworkStatusListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

/**
 * Get cache size estimate (Chrome/Edge only)
 */
export async function getCacheSize(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !("storage" in navigator)) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  if (typeof caches === "undefined") return;

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log("✅ All caches cleared");
  } catch (error) {
    console.error("❌ Cache clear failed:", error);
  }
}

/**
 * Hook for using service worker in React components
 */
export function useServiceWorker(config: ServiceWorkerConfig = {}) {
  if (typeof window === "undefined") {
    return {
      isSupported: false,
      isActive: false,
      isOnline: true,
      register: async () => null,
      unregister: async () => false,
      update: async () => {},
    };
  }

  const [isActive, setIsActive] = React.useState(false);
  const [isOnlineState, setIsOnline] = React.useState(isOnline());

  React.useEffect(() => {
    // Check if active
    isServiceWorkerActive().then(setIsActive);

    // Register
    registerServiceWorker(config);

    // Network status listeners
    const cleanup = addNetworkStatusListeners(
      () => setIsOnline(true),
      () => setIsOnline(false)
    );

    return cleanup;
  }, []);

  return {
    isSupported: isServiceWorkerSupported(),
    isActive,
    isOnline: isOnlineState,
    register: () => registerServiceWorker(config),
    unregister: unregisterServiceWorker,
    update: updateServiceWorker,
  };
}

// Add React import for the hook (will be tree-shaken if not used)
import * as React from "react";
