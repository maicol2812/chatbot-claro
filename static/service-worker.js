// static/service-worker.js

self.addEventListener("install", function (event) {
  self.skipWaiting();
  console.log("🛠️ Service Worker instalado.");
});

self.addEventListener("activate", function (event) {
  console.log("✅ Service Worker activo.");
});

self.addEventListener("fetch", function (event) {
  // Estrategia de caché: usar red primero, luego caché
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Notificaciones push (simulada, necesita servidor real)
self.addEventListener("push", function (event) {
  const data = event.data?.text() || "¡Tienes una nueva alerta!";
  self.registration.showNotification("ClaroBot", {
    body: data,
    icon: "/static/claro-logo.png"
  });
});
