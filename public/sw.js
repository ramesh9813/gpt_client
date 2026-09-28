// Installable PWA service worker for owngpt.onrender.com (Chrome → Install app).
// - Cache-first for hashed assets (js/css/png/svg) for fast offline launch.
// - Network-first for navigations (SPA): try network, fall back to cached index
//   so deep links (/chat/:id) still work offline/after install.
// - Never cache or intercept /api/* (auth-gated JSON).
// - No feature changes — purely install + offline-shell.

const CACHE_NAME = "chatgpt-pwa-v4";
const SHELL = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png"
];

const isHashedAsset = (pathname) =>
  /\.[a-f0-9]{6,}\.(js|css)(\.map)?$/i.test(pathname) ||
  pathname.endsWith(".png") ||
  pathname.endsWith(".svg") ||
  pathname.endsWith(".css") ||
  pathname.endsWith(".js");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : undefined)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Same-origin only; cross-origin (OpenRouter, CDN) bypasses.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isNav =
    event.request.mode === "navigate" ||
    event.request.destination === "document";

  if (isNav) {
    // Navigations (/, /chat/:id, refresh while on deep link): network first
    // so the user always gets latest shell; offline → cached "/" (SPA fallback).
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Cache successful navigations for offline fallback
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            // Also ensure "/" is cached as fallback
            caches.open(CACHE_NAME).then((c) => c.put("/", clone.clone()).catch(() => {}));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request).then(
            (hit) => hit || caches.match("/").then((root) => root || hit)
          )
        )
    );
    return;
  }

  // Hashed assets: cache-first (immutable), update in background.
  if (isHashedAsset(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((hit) => {
        if (hit) {
          // Stale-while-revalidate
          event.waitUntil(
            fetch(event.request)
              .then((res) => {
                if (res && res.status === 200) {
                  caches.open(CACHE_NAME).then((c) => c.put(event.request, res));
                }
              })
              .catch(() => {})
          );
          return hit;
        }
        return fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            }
            return res;
          })
          .catch(() => hit);
      })
    );
    return;
  }

  // Other same-origin GETs (manifest.json etc.): network-first, cache fallback.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
