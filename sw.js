const CACHE_NAME = 'control-espacio-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './manifest-pc.json',
    'https://i.ibb.co/pBwLqf1v/Dise-o-sin-t-tulo.png',
    'https://i.ibb.co/5h1j0fr3/Dise-o-sin-t-tulo.png'
];

// Instalación del Service Worker e inyección de caché estática inicial
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Abriendo caché interna y guardando archivos críticos...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Limpieza de cachés antiguas al actualizar versiones
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Eliminando caché obsoleta:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Interceptación de peticiones para modo Offline (Estrategia: Cache First)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Gestión centralizada de alertas nativas del sistema cuando la ventana está cerrada
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('./');
        })
    );
});
