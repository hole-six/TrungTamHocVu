/**
 * Performance monitoring and optimization utilities
 */

// ============================================
// Performance Measurement
// ============================================

type PerformanceMark = {
  name: string;
  startTime: number;
  duration?: number;
};

const performanceMarks: Map<string, PerformanceMark> = new Map();

/**
 * Start measuring performance for a named operation
 */
export function startMeasure(name: string): void {
  if (typeof performance === "undefined") return;
  
  performanceMarks.set(name, {
    name,
    startTime: performance.now(),
  });
}

/**
 * End measuring and log the duration
 */
export function endMeasure(name: string, log = false): number | null {
  if (typeof performance === "undefined") return null;
  
  const mark = performanceMarks.get(name);
  if (!mark) {
    console.warn(`No performance mark found for: ${name}`);
    return null;
  }

  const duration = performance.now() - mark.startTime;
  mark.duration = duration;

  if (log) {
    console.log(`⚡ ${name}: ${duration.toFixed(2)}ms`);
  }

  return duration;
}

/**
 * Measure async function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  log = false
): Promise<T> {
  startMeasure(name);
  try {
    const result = await fn();
    endMeasure(name, log);
    return result;
  } catch (error) {
    endMeasure(name, log);
    throw error;
  }
}

/**
 * Get all performance marks
 */
export function getAllMarks(): PerformanceMark[] {
  return Array.from(performanceMarks.values());
}

/**
 * Clear all performance marks
 */
export function clearMarks(): void {
  performanceMarks.clear();
}

// ============================================
// Debounce & Throttle
// ============================================

/**
 * Debounce function - wait until user stops typing/acting
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - execute at most once per interval
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// Memory Management
// ============================================

/**
 * Get current memory usage (Chrome/Edge only)
 */
export function getMemoryUsage(): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null {
  if (
    typeof performance !== "undefined" &&
    "memory" in performance &&
    performance.memory
  ) {
    const memory = performance.memory as any;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }
  return null;
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Log current memory usage
 */
export function logMemoryUsage(): void {
  const memory = getMemoryUsage();
  if (memory) {
    console.log("💾 Memory Usage:", {
      used: formatBytes(memory.usedJSHeapSize),
      total: formatBytes(memory.totalJSHeapSize),
      limit: formatBytes(memory.jsHeapSizeLimit),
    });
  }
}

// ============================================
// Image Optimization
// ============================================

/**
 * Lazy load image with IntersectionObserver
 */
export function lazyLoadImage(
  img: HTMLImageElement,
  options?: IntersectionObserverInit
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    // Fallback for older browsers
    if (img.dataset.src) {
      img.src = img.dataset.src;
    }
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const image = entry.target as HTMLImageElement;
        if (image.dataset.src) {
          image.src = image.dataset.src;
          image.removeAttribute("data-src");
        }
        observer.unobserve(image);
      }
    });
  }, options);

  observer.observe(img);

  return () => observer.disconnect();
}

/**
 * Preload image
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Preload multiple images
 */
export async function preloadImages(srcs: string[]): Promise<void> {
  await Promise.all(srcs.map(preloadImage));
}

// ============================================
// Web Vitals Monitoring
// ============================================

type VitalMetric = {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
};

/**
 * Monitor Core Web Vitals (if web-vitals library is installed)
 */
export function monitorWebVitals(
  onMetric?: (metric: VitalMetric) => void
): void {
  if (typeof window === "undefined") return;

  // Largest Contentful Paint (LCP)
  if ("PerformanceObserver" in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;

        const value = lastEntry.renderTime || lastEntry.loadTime;
        const rating = value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";

        onMetric?.({ name: "LCP", value, rating });
      });

      observer.observe({ type: "largest-contentful-paint", buffered: true });
    } catch (e) {
      // Ignore if not supported
    }
  }

  // First Input Delay (FID)
  if ("PerformanceObserver" in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[];
        entries.forEach((entry) => {
          const value = entry.processingStart - entry.startTime;
          const rating = value <= 100 ? "good" : value <= 300 ? "needs-improvement" : "poor";

          onMetric?.({ name: "FID", value, rating });
        });
      });

      observer.observe({ type: "first-input", buffered: true });
    } catch (e) {
      // Ignore if not supported
    }
  }

  // Cumulative Layout Shift (CLS)
  if ("PerformanceObserver" in window) {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[];
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });

        const rating = clsValue <= 0.1 ? "good" : clsValue <= 0.25 ? "needs-improvement" : "poor";

        onMetric?.({ name: "CLS", value: clsValue, rating });
      });

      observer.observe({ type: "layout-shift", buffered: true });
    } catch (e) {
      // Ignore if not supported
    }
  }
}

// ============================================
// Request Optimization
// ============================================

/**
 * Cache for fetch requests
 */
const fetchCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Fetch with caching
 */
export async function fetchWithCache<T>(
  url: string,
  ttl: number = 60000, // 1 minute default
  options?: RequestInit
): Promise<T> {
  const cacheKey = url + JSON.stringify(options);
  const cached = fetchCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const response = await fetch(url, options);
  const data = await response.json();

  fetchCache.set(cacheKey, { data, timestamp: Date.now() });

  return data;
}

/**
 * Clear fetch cache
 */
export function clearFetchCache(): void {
  fetchCache.clear();
}

// ============================================
// Batch Processing
// ============================================

/**
 * Process items in batches to avoid blocking UI
 */
export async function processBatch<T, R>(
  items: T[],
  processItem: (item: T, index: number) => R | Promise<R>,
  batchSize: number = 100,
  onProgress?: (processed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Process batch
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => processItem(item, i + batchIndex))
    );

    results.push(...batchResults);

    // Report progress
    onProgress?.(Math.min(i + batchSize, items.length), items.length);

    // Yield to main thread
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return results;
}

// ============================================
// Resource Hints
// ============================================

/**
 * Prefetch a resource
 */
export function prefetch(url: string): void {
  if (typeof document === "undefined") return;

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Preconnect to a domain
 */
export function preconnect(url: string, crossorigin = false): void {
  if (typeof document === "undefined") return;

  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = url;
  if (crossorigin) {
    link.crossOrigin = "anonymous";
  }
  document.head.appendChild(link);
}

/**
 * DNS prefetch
 */
export function dnsPrefetch(url: string): void {
  if (typeof document === "undefined") return;

  const link = document.createElement("link");
  link.rel = "dns-prefetch";
  link.href = url;
  document.head.appendChild(link);
}
