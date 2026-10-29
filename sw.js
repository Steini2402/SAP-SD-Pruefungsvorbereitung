/* SAP SD Quiz - Service Worker
 * Strategie:
 *  - Navigation (HTML-Seiten): network-first, Fallback auf Cache, dann offline.html
 *  - Statische Dateien (Icons, Manifest, Bilder): stale-while-revalidate
 *  - Google Analytics: wird nie abgefangen und nie gecacht
 * Version bei inhaltlichen Aenderungen hochziehen.
 */
var VERSION = "v3";
var CACHE = "sap-sd-quiz-" + VERSION;
var OFFLINE = "offline.html";

var PRECACHE = [
  "./",
  "index.html",
  "en.html",
  "quiz.html",
  "quiz-en.html",
  OFFLINE,
  "manifest.webmanifest",
  "manifest-en.webmanifest",
  "bild1.jpg",
  "bild2.jpg",
  "bild3.jpg",
  "bild4.jpg",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* Einzeln hinzufuegen: eine fehlende Datei darf das
         gesamte Precache nicht zum Scheitern bringen. */
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(new Request(url, { cache: "reload" })).catch(function () {
            return null;
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE) return caches.delete(key);
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isAnalytics(url) {
  return (
    url.hostname.indexOf("google-analytics.com") !== -1 ||
    url.hostname.indexOf("googletagmanager.com") !== -1 ||
    url.hostname.indexOf("analytics.google.com") !== -1
  );
}

self.addEventListener("fetch", function (event) {
  var req = event.request;

  /* Nur GET und nur eigene Herkunft behandeln. */
  if (req.method !== "GET") return;

  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  /* Tracking niemals abfangen - weder cachen noch aus dem Cache bedienen. */
  if (isAnalytics(url)) return;
  if (url.origin !== self.location.origin) return;

  var isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").indexOf("text/html") !== -1;

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(req, copy).catch(function () {});
          });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match(OFFLINE) || caches.match("index.html") || Response.error();
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req)
        .then(function (res) {
          if (res && res.status === 200 && res.type === "basic") {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(req, copy).catch(function () {});
            });
          }
          return res;
        })
        .catch(function () {
          return hit || Response.error();
        });
      return hit || network;
    })
  );
});
