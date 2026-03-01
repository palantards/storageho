const CACHE_NAME = "storageho-shell-v3";
const SHELL_ASSETS = [
  "/",
  "/en",
  "/en/dashboard",
  "/brand/icon.svg",
  "/brand/logo.svg",
];

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
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/_next/")) return false;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return false;
  if (url.searchParams.has("__rsc")) return false;

  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/x-component")) return false;

  return true;
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
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/en/dashboard")),
        ),
    );
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
