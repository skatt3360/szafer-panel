/* ════════════════════════════════════════════════
   Szafer Panel — Service Worker v11.0
   STRATEGIA: network-first zawsze — żadnego cache na JS/CSS/HTML
   Zmiany są widoczne natychmiast po deploy bez potrzeby ręcznego czyszczenia
════════════════════════════════════════════════ */
const CACHE_NAME = 'szafer-panel-v11.0';

/* ── Install — minimal, szybki ── */
self.addEventListener('install', event => {
  self.skipWaiting();
});

/* ── Activate — usuń wszystkie stare cache ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch — network-first dla wszystkiego własnego ── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Zewnętrzne zasoby (Firebase, Fonts) — bez ingerencji
  if (!url.origin.includes(self.location.hostname)) return;

  // Zawsze sieć pierwsza — cache tylko jako fallback offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

/* ── Push notifications ── */
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

/* ── Lokalny push bez serwera ── */
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
