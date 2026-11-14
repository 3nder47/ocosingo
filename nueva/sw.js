// Puente de nueva/ (cambio definitivo): reemplaza al service worker de la versión de prueba, manda las ventanas
// abiertas de nueva/ a la misma página en la raíz y se da de baja. Solo borra la caché de la versión de prueba
// (kn-shell-12.7); la de la raíz es otra.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    await caches.delete('kn-shell-12.7');
    await self.clients.claim();
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      const u = new URL(v.url);
      if (u.pathname.indexOf('/nueva/') < 0) continue;
      u.pathname = u.pathname.replace('/nueva/', '/');
      try { await v.navigate(u.href); } catch (err) {}
    }
    await self.registration.unregister();
  })());
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.mode === 'navigate' && u.pathname.indexOf('/nueva/') > -1) {
    u.pathname = u.pathname.replace('/nueva/', '/');
    e.respondWith(Response.redirect(u.href, 302));
  }
});
