const CACHE_NAME = "stowlio-shell-v4";
const SHELL_ASSETS = [
  "/brand/icon.png",
  "/brand/logo.png",
];

// Only cache truly static assets — never page HTML or RSC payloads
// which are authenticated and user-specific.
function isCacheableRequest(request) {
  if (request.method !== "GET") return false;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(url.protocol)) return false;
  if (url.origin !== self.location.origin) return false;

  // Only cache versioned Next.js static chunks and known static brand assets
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (/^\/brand\//.test(url.pathname) && /\.(png|jpg|svg|ico|webp)$/.test(url.pathname)) return true;

  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => null),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!isCacheableRequest(request)) return;

  if (request.mode === "navigate") {
    // Always go to network for page navigations — never serve cached HTML
    // for authenticated pages as it would expose one user's data to another.
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => null);
        }
        return response;
      });
    }),
  );
});
