// Evergreen Business Plan · funziona anche offline. Prima prova la rete (così gli aggiornamenti arrivano subito), se manca usa la copia salvata.
const C = "evergreen-bp-online";
const FILE = ["./", "index.html", "app.css", "app.js", "cloud.js", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILE)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request, { cache: "no-store" }).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
