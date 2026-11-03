// Il sito non è più un'app (novembre 2026: la vecchia app è in archivio, al suo posto la pagina per scaricare l'APK).
// Chi aveva aperto o installato la vecchia app ha ancora il suo service worker: questo lo sostituisce, cancella le
// memorie della vecchia app ("dgm-…" e "dg-img-…"), si toglie di mezzo e ricarica le pagine aperte sulla versione nuova.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.filter(function (k) { return /^dg/.test(k); }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: "window" }); })
      .then(function (cs) { cs.forEach(function (c) { try { c.navigate(c.url); } catch (x) {} }); })
  );
});
