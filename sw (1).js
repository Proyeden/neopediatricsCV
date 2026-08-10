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
const VERSION = "carne-v1";
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
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // si algo falla, no bloquea la instalación
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Solo se cachea lo propio. Firebase y Firestore nunca: sus respuestas
  // llevan datos de pacientes y tokens de sesión.
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

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
