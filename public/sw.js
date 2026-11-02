// Service Worker for МойСклад Касса POS
const CACHE_NAME = 'moysklad-pos-v1';

// Essential assets to cache on install for offline functionality and Windows PWA installability
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/icon.svg',
  '/favicon.ico',
];

// Install event: Precache shell and skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('PWA: Non-fatal precache error:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: Clean up previous caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event: Required for Windows Chrome/Edge installability criteria
// Uses network-first with cache fallback for HTML navigations, and stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests with http/https schemes
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Skip Firestore and WebSocket realtime connections so live sync is never hindered
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('vite-hmr')
  ) {
    return;
  }

  // Navigation requests: Network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // Static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, return cached response if present
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
