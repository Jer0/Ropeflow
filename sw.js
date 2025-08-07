
const CACHE_NAME = 'ropeflow-viewer-cache-v2'; // Incrementamos la versión para forzar la actualización

// Archivos base de la aplicación que siempre se cachean
const APP_SHELL_FILES = [
    '/',
    'index.html',
    'style.css',
    'script.js',
    'videos.json'
];

self.addEventListener('install', event => {
    console.log('Service Worker: Instalando v2...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Service Worker: Cacheando el App Shell');
            return cache.addAll(APP_SHELL_FILES);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Activando v2...');
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
    // Si la petición tiene la cabecera 'range', es para streaming de video.
    // En este caso, NO la interceptamos y dejamos que el navegador la maneje.
    // Esto es crucial para que el streaming funcione en iOS y otros navegadores.
    if (event.request.headers.has('range')) {
        // console.log('Service Worker: Petición de rango detectada, omitiendo caché para:', event.request.url);
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            // 1. Buscar en la caché primero para archivos del App Shell
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                // console.log('Service Worker: Recurso encontrado en caché:', event.request.url);
                return cachedResponse;
            }

            // 2. Si no está en caché (ej. los videos la primera vez), ir a la red
            try {
                const networkResponse = await fetch(event.request);
                // Solo cacheamos respuestas válidas y que no sean opacas (de otros dominios sin CORS)
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    // console.log('Service Worker: Cacheando nuevo recurso:', event.request.url);
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            } catch (error) {
                console.error('Service Worker: Fallo al buscar en la red.', error);
                // Opcional: Devolver una página de "offline"
            }
        })
    );
});
