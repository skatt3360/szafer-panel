/* ════════════════════════════════════════════════
   Szafer Panel — Service Worker v10.3
   ════════════════════════════════════════════════ */
const CACHE_NAME = 'szafer-panel-v10.3';
const PRECACHE = ['/', '/index.html', '/css/style.css', '/js/app.js', '/js/ui.js', '/manifest.json'];

/* ── Install ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .catch(() => {}) // nie blokuj SW jeśli coś nie istnieje
  );
  self.skipWaiting();
});

/* ── Activate: usuń stare cache ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: cache-first dla własnych zasobów ── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Cache tylko własne zasoby (nie Firebase, Google Fonts, itp.)
  if (!url.origin.includes(self.location.hostname)) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

/* ── Push (serwer → przeglądarka) ──
   Wymagane dla background push na iOS 16.4+ i Android Chrome */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Szafer Panel', {
      body:    data.body  || '',
      tag:     data.tag   || 'szafer-' + Date.now(),
      icon:    '/icon.svg',
      badge:   '/icon.svg',
      renotify: true,
      requireInteraction: false
    })
  );
});

/* ── Notification click ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      return existing ? existing.focus() : clients.openWindow('/');
    })
  );
});

/* ── Wiadomości z głównego wątku (lokalny push bez serwera) ── */
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title || 'Szafer Panel', {
      body:     (body  || '').substring(0, 200),
      tag:      tag   || 'szafer-' + Date.now(),
      icon:     '/icon.svg',
      renotify: true
    });
  }
});
