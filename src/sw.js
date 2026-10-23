// Rete prima, cache come ripiego: si vede sempre l'ultima versione e funziona anche offline.
var C = "dgm-v3", FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon.ico", "favicon-32.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(C).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
// (cancella solo le sue vecchie versioni "dgm-…": le immagini salvate dall'app, "dg-img-…", restano)
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== C && /^dgm-/.test(k); }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // immagini di carte, prodotti e banner: le salva l'app stessa (cache "dg-img-v2"), qui niente doppione
  if (/\/(img|prod|banners)\//.test(u.pathname)) return;
  e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(C).then(function (c) { c.put(e.request, cp); }); return r; })
    .catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match("index.html"); }); }));
});
