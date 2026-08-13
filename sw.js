/* ============================================================================
   Trabajador de servicio del Carné de salud infantil.

   Estrategia: red primero, caché como respaldo.
   Es deliberado. Un expediente clínico desactualizado es peor que una
   pantalla que tarda un segundo más, así que siempre se intenta la red;
   la caché entra solo cuando no hay señal. Al revés —caché primero— la
   mamá podría ver vacunas de hace tres meses creyendo que están al día.

   Al publicar una versión nueva del archivo, suba VERSION: eso descarta
   la caché anterior y todos reciben la nueva sin borrar nada a mano.
   ============================================================================ */
const VERSION = "2026-08-12c";
const ESENCIALES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ESENCIALES))
      .catch(() => {})   // si algo falla, no bloquea la instalación
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* La página pide activar la versión nueva cuando el usuario pulsa el
   botón. Sin esto, el trabajador nuevo se queda esperando a que se
   cierren todas las pestañas, que en una aplicación instalada puede no
   ocurrir en días. */
self.addEventListener("message", e => {
  if (e.data && e.data.tipo === "activar-ya") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Solo se cachea lo propio. Firebase y Firestore nunca: sus respuestas
  // llevan datos de pacientes y tokens de sesión.
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  // El HTML NUNCA se sirve desde caché.
  // Una versión vieja de la aplicación es indistinguible de datos viejos:
  // el usuario ve información desactualizada y no tiene forma de saber
  // que el problema es el archivo, no el expediente. Los íconos y el
  // manifiesto sí se cachean, porque no cambian el comportamiento.
  const esHTML = e.request.mode === "navigate" ||
                 url.pathname.endsWith("/") ||
                 url.pathname.endsWith(".html");
  if (esHTML) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        caches.open(VERSION).then(c => c.put(e.request, copia)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
