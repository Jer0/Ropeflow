const CACHE_NAME = 'ropeflow-viewer-v4'; // Incrementamos la versión para forzar la actualización
const APP_SHELL_URLS = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'videos.json'
];

// Evento de instalación: cachear el App Shell
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando v4...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto, guardando App Shell');
        return cache.addAll(APP_SHELL_URLS);
      })
  );
});

// Evento de activación: limpiar cachés antiguas
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando v4...');
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
    })
  );
  return self.clients.claim();
});

// Evento fetch: servir desde la caché, con fallback a la red (Cache then Network)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Si la respuesta está en la caché, la retornamos
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si no, la buscamos en la red
        return fetch(event.request).then(
          networkResponse => {
            // Si la petición a la red fue exitosa, la clonamos y la guardamos en caché
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            // Retornamos la respuesta de la red
            return networkResponse;
          }
        ).catch(error => {
          console.error('Fallo el fetch del Service Worker:', error);
          // Opcional: podrías retornar una respuesta de fallback aquí
        });
      })
  );
});