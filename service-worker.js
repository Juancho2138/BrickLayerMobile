const CACHE_NAME = "bricklayer-mobile-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./viewer3d.js",
  "./organizer.js",
  "./pdf/pdf-utils.js",
  "./pdf/pdf-profiles.js",
  "./pdf/pdf-layer-renderer.js",
  "./pdf/pdf-inventory-renderer.js",
  "./pdf/pdf-3d-capture.js",
  "./pdf/pdf-engine.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./vendor/jspdf/jspdf-wrapper.js",
  "./vendor/jspdf/jspdf.umd.min.js",
  "./vendor/jspdf/jspdf.es.min.js",
  "./vendor/jspdf/LICENSE",
  "./vendor/three/three.module.js",
  "./vendor/three/three.core.js",
  "./vendor/three/controls/OrbitControls.js",
  "./vendor/three/LICENSE"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" })));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
