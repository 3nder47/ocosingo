// Service worker Tienda Ocosingo
// - App shell (HTML, CSS, JS, manifest, íconos): cache-first, se actualiza al cambiar CACHE.
// - Fuentes de Google: stale-while-revalidate.
// - API de Apps Script: no se intercepta; el respaldo offline lo maneja localStorage en app.js.
const CACHE = 'ocosingo-v5';
const IMG_CACHE = 'ocosingo-img-v1';
async function podarImagenes(c) { const keys = await c.keys(); if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) await c.delete(k); }
const SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.json', './config.js', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  // Fotos de producto (Drive): caché primero; si no está, red y se guarda (máx. ~300)
  if (url.hostname === 'drive.google.com' && url.pathname.startsWith('/thumbnail')) {
    e.respondWith(
      caches.open(IMG_CACHE).then(async c => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try {
          const r = await fetch(e.request);
          if (r.ok || r.type === 'opaque') { c.put(e.request, r.clone()); podarImagenes(c); }
          return r;
        } catch (err) { return new Response('', { status: 504 }); }
      })
    );
    return;
  }

  // Fuentes: sirve caché y refresca en segundo plano
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(e.request);
        const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const copia = r.clone(); c.put(e.request, copia); } return r; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // App shell: red primero para tener siempre la última versión; caché si no hay señal
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return r;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
  }
});
