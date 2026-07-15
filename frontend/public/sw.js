/* mediaERP service worker — minimal, safe runtime caching for installability
   + basic offline. Deliberately never touches /api/ so data & auth stay live. */
const CACHE = "mediaerp-v1";
const STATIC_DESTS = ["style", "script", "font", "image"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Only handle same-origin GETs. Never intercept the API (network-only → fresh
  // data + auth) or WebSocket upgrades.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation → network-first (always try for the freshest app shell), then cache.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/dashboard")))
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  if (STATIC_DESTS.includes(req.destination) || url.pathname.startsWith("/_next/")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
