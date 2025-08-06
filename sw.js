
const CACHE_NAME = 'ropeflow-viewer-cache-v1';

// Al instalar el Service Worker, cacheados los archivos principales de la app
self.addEventListener('install', event => {
    console.log('Service Worker: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Estos son los archivos base de la aplicación
            return cache.addAll([
                '/', // La página principal
                'index.html',
                'style.css',
                'script.js',
                'videos.json'
            ]);
        })
    );
    self.skipWaiting();
});

// Al activar el Service Worker, limpiamos cachés antiguas
self.addEventListener('activate', event => {
    console.log('Service Worker: Activando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Limpiando caché antigua:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Interceptamos las peticiones (fetch)
self.addEventListener('fetch', event => {
    // Solo nos interesan las peticiones GET (no POST, etc.)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            // 1. Buscar en la caché primero
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                // console.log('Service Worker: Recurso encontrado en caché:', event.request.url);
                return cachedResponse;
            }

            // 2. Si no está en caché, ir a la red
            // console.log('Service Worker: Recurso no encontrado en caché, buscando en red:', event.request.url);
            try {
                const networkResponse = await fetch(event.request);
                // Si la petición a la red tiene éxito, la guardamos en caché para el futuro
                if (networkResponse.ok) {
                    // console.log('Service Worker: Cacheando nuevo recurso:', event.request.url);
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            } catch (error) {
                console.error('Service Worker: Fallo al buscar en la red.', error);
                // Opcional: Devolver una página de "offline" si falla la red
            }
        })
    );
});
