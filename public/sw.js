const CACHE_NAME = 'handoverly-v1';

// Assets to cache for offline availability
const APP_SHELL = [
  '/',
  '/login',
  '/shift',
  '/tasks',
  '/offline',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(APP_SHELL).catch(err => console.warn('Cache addAll failed, continuing anyway:', err));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests, API requests, and non-GET requests
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.method !== 'GET' ||
      event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        // Also fetch in background to update cache (Stale-While-Revalidate)
        fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res));
          }
        }).catch(() => {});
        return response;
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((res) => {
        // Don't cache if not a valid response
        if (!res || res.status !== 200 || res.type !== 'basic') {
          return res;
        }

        // Clone response to cache it
        const responseToCache = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return res;
      }).catch(() => {
        // If network fails and it's a page request, return offline page or root
        if (event.request.mode === 'navigate') {
          return caches.match('/offline').then(res => res || caches.match('/'));
        }
        return new Response('Network error happened', { status: 408, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});
