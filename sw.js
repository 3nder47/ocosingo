// Service worker Kiosko v7
// - Shell (HTML/CSS/JS): red primero con timeout de 3.5 s; sin señal, caché. Nada de esperar a 2G.
// - La versión nueva NO se activa sola bajo una pestaña viva: espera el mensaje SKIP_WAITING
//   (app.js avisa con un toast y recarga al cambiar de controlador). Así HTML y JS nunca se desfasan.
// - Fotos de producto (Drive): caché primero para siempre (cada subida crea URL nueva) · máx. 120.
// - Al cambiar de versión, actualizar CACHE y los ?v= de SHELL junto con index.html.
// UNICO lugar que hay que tocar al subir version, junto con los ?v= de index.html y APP_VERSION de app.js.
const V = '10.1';
const CACHE = 'kiosko-shell-' + V;
const IMG_CACHE = 'ocosingo-img-v2';
const SHELL = ['./', './index.html', './styles.css?v=' + V, './app.js?v=' + V, './manifest.json', './config.js', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  // allSettled: si un ícono falla, el resto del shell se precachea igual (addAll era todo o nada)
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function podarImagenes(c) { const keys = await c.keys(); if (keys.length > 120) for (const k of keys.slice(0, keys.length - 120)) await c.delete(k); }

// Red con límite de tiempo: en 2G la app arranca con el caché en vez de quedarse en blanco.
function redConTimeout(req, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); res(r); }, err => { clearTimeout(t); rej(err); });
  });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  // Fotos: caché primero (URL inmutable), red solo la primera vez
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
        const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Shell: red primero (máx. 3.5 s), luego caché; el HTML de respaldo solo aplica a navegaciones
  if (url.origin === self.location.origin) {
    e.respondWith(
      redConTimeout(e.request, 3500).then(r => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return r;
      }).catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then(r => {
          if (r) return r;
          if (e.request.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504 });
        })
      )
    );
  }
});
