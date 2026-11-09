const CACHE = "desk-static-v1";
const ASSETS = ["./index.html", "./app.js", "./app.css", "./chart.js", "./manifest.json"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // never cache the secret JSON snapshots
  if (url.pathname.includes("/d/")) return;
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (err) {}
  const title = data.title || "Grok Bot · now";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    data: { url: data.url },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(clients.openWindow(url));
});
