const PRECACHE = ["/", "/offline/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("tradehax-shell").then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : { title: "TradeHax", body: "Alert" };
  event.waitUntil(self.registration.showNotification(payload.title || "TradeHax", { body: payload.body || "", data: payload }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/alerts/"));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.includes("/v1/") || event.request.headers.get("accept")?.includes("text/event-stream")) return;
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(stale(event.request));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(url.pathname).then((hit) => hit || caches.match("/offline/"))));
    return;
  }
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});

async function stale(request) {
  const cache = await caches.open("tradehax-data");
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || fresh;
}
