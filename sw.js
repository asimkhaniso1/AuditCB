// ============================================
// SERVICE WORKER - AuditCB360 Offline Mode
// ============================================

const CACHE_NAME = 'auditcb-v1';
const ASSETS_TO_CACHE = [
    './index.html',
    './styles.css',
    './auth-manager.js',
    './data-sync.js',
    './backup-manager.js',
    './planning-module.js',
    './execution-module.js',
    './reporting-module.js',
    './dashboard-module.js',
    './clients-module.js',
    './checklist-module.js',
    './settings-module.js',
    './notifications-module.js',
    './audit-trail-module.js',
    './offline-manager.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install Event - Cache Assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event - Cleanup Old Caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// Fetch Event - Network First, then Cache for API; Cache First for Assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Ignore browser extension requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Strategy 1: Stale-While-Revalidate for critical code files (ensure updates)
    if (ASSETS_TO_CACHE.some(asset => url.pathname.endsWith(asset.replace('./', '')))) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                }).catch(() => cachedResponse); // Fallback to cache if network fails

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // Strategy 2: Network First, Fallback to Cache for everything else (Navigation, etc.)
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Cache the fresh response
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                // If offline, try to return from cache
                return caches.match(event.request);
            })
    );
});
