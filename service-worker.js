const CACHE = 'haven-shell-v0.5.13';
const SHELL = ['/', '/index.html', '/styles.css?v=0.5.13', '/settings.css?v=0.5.13', '/security.css?v=0.5.13', '/version.css?v=0.5.13', '/keycloak.css?v=0.5.13', '/recovery.css?v=0.5.13', '/app-manager.css?v=0.5.13', '/integrations.css?v=0.5.13', '/app.js?v=0.5.13', '/vendor/keycloak.js', '/manifest.webmanifest', '/icons/haven.svg', '/icons/haven-192.png', '/icons/haven-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const pathname = new URL(event.request.url).pathname;
  if (event.request.method !== 'GET' || pathname === '/config.js') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }
  if (pathname === '/app.js' || pathname.endsWith('.css')) {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
