
const CACHE_NAME = 'ropeflow-viewer-cache-v3'; // Versión 3: Estrategia de caché explícita
const APP_SHELL_FILES = [
    '/',
    'index.html',
    'style.css',
    'script.js',
    'videos.json'
];

self.addEventListener('install', event => {
    console.log('Service Worker: Instalando v3...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(APP_SHELL_FILES);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Activando v3...');
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

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Ignorar completamente las peticiones de video. Serán manejadas por el script principal.
    if (url.pathname.endsWith('.mp4')) {
        return;
    }

    // Para el App Shell, usar estrategia de caché primero.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request).then(networkResponse => {
                // No es necesario cachear aquí, ya se hace en la instalación.
                return networkResponse;
            });
        })
    );
});
