const VER = "edges-tracker-v4";
const CORE = ["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./apple-touch-icon.png","./favicon-32.png"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    await c.add("./index.html");                       // the app itself is mandatory
    await Promise.all(CORE.filter(u => u !== "./index.html")
      .map(u => c.add(u).catch(() => {})));            // a missing icon must never break offline mode
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: stale-while-revalidate (so the Arabic font works offline after first load)
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(VER).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // Pages: network first (picks up updates), fall back to cache when offline
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone(); caches.open(VER).then(c => c.put("./index.html", copy)); return r;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  // Everything else on our origin: cache first
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    const copy = r.clone(); caches.open(VER).then(c => c.put(req, copy)); return r;
  })));
});
