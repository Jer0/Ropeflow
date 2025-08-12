const CACHE_NAME = 'ropeflow-viewer-v5'; // Versión 5: Instalación más robusta
const APP_SHELL_URLS = [
  'index.html', // Más específico que '/'
  'style.css',
  'script.js',
  'videos.json'
];

// Evento de instalación: cachear el App Shell y forzar activación
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando v5...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto, guardando App Shell');
        return cache.addAll(APP_SHELL_URLS);
      })
      .then(() => self.skipWaiting()) // Activa el nuevo SW en cuanto termina la instalación
  );
});

// Evento de activación: limpiar cachés antiguas y tomar control
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando v5...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Limpiando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Asegura que el SW activo controle la página inmediatamente
  );
});

// Evento fetch: servir desde la caché, con fallback a la red (Cache then Network)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Si la respuesta está en la caché, la retornamos.
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si no, la buscamos en la red.
        return fetch(event.request).then(
          networkResponse => {
            // Clona la respuesta de red para poder guardarla en caché y devolverla.
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                // Guarda la nueva respuesta en la caché para la próxima vez.
                cache.put(event.request, responseToCache);
              });
            // Retorna la respuesta de la red original.
            return networkResponse;
          }
        );
      })
  );
});