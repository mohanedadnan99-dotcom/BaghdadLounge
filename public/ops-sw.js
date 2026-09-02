/* Baghdad Lounge door app shell. Passenger data stays in IndexedDB; API
   responses are deliberately never written to the HTTP cache. */
const CACHE_NAME = "baghdad-lounge-ops-v3";
const OFFLINE_ASSETS = ["/zxing_reader.wasm", "/pdf.worker.min.mjs"];

async function cacheResponse(cache, url) {
  try {
    const response = await fetch(url, { cache: "reload" });
    if (response.ok) await cache.put(url, response);
  } catch {
    // A later online visit can fill a non-essential missing asset.
  }
}

async function precacheDoorApp() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch("/ops", { cache: "reload" });
  if (!response.ok) throw new Error("Unable to cache the operations shell");
  const html = await response.clone().text();
  await cache.put("/ops", response);

  // The first page load happens before this worker controls the tab. Extract
  // its hashed Next.js assets so the very first offline reload can hydrate.
  const assets = new Set(OFFLINE_ASSETS);
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = new URL(match[1], self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
      assets.add(`${url.pathname}${url.search}`);
    }
  }
  await Promise.all([...assets].map((url) => cacheResponse(cache, url)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheDoorApp().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("baghdad-lounge-ops-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate" && url.pathname === "/ops") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (url.pathname === "/ops" && response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put("/ops", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match("/ops")) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/zxing_") || url.pathname.endsWith(".wasm") || url.pathname.endsWith(".mjs")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
  }
});
