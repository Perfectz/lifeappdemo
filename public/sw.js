const CACHE_VERSION = "lifequest-v18";
const APP_SHELL_CACHE = `${CACHE_VERSION}-app-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");

function withScope(path) {
  return `${SCOPE_PATH}${path}`;
}

function pathWithoutScope(url) {
  if (SCOPE_PATH && url.pathname.startsWith(`${SCOPE_PATH}/`)) {
    return url.pathname.slice(SCOPE_PATH.length);
  }

  return url.pathname;
}

const PRECACHE_URLS = [
  withScope("/offline.html"),
  withScope("/manifest.webmanifest"),
  withScope("/icons/icon-192.svg"),
  withScope("/icons/icon-512.svg"),
  withScope("/icons/icon-192.png"),
  withScope("/icons/icon-512.png"),
  withScope("/icons/maskable-512.png")
];

function shouldNeverCache(url) {
  const pathname = pathWithoutScope(url);

  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    url.pathname.includes("openai") ||
    url.pathname.includes("realtime") ||
    url.pathname.includes("ai") ||
    pathname.includes("openai") ||
    pathname.includes("realtime") ||
    pathname.includes("ai")
  );
}

function isStaticAsset(url) {
  const pathname = pathWithoutScope(url);

  return (
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/assets/")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || shouldNeverCache(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match(withScope("/offline.html")))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          return response;
        });
      })
    );
  }
});
