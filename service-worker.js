const CACHE = 'haven-shell-v0.8.1';
const SHELL = ['/', '/index.html', '/styles.css?v=0.8.1', '/settings.css?v=0.8.1', '/security.css?v=0.8.1', '/version.css?v=0.8.1', '/keycloak.css?v=0.8.1', '/recovery.css?v=0.8.1', '/app-manager.css?v=0.8.1', '/integrations.css?v=0.8.1', '/app.js?v=0.8.1', '/vendor/keycloak.js', '/manifest.webmanifest', '/icons/haven.svg', '/icons/haven-192.png', '/icons/haven-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const pathname = new URL(event.request.url).pathname;
  // API responses are private and dynamic. Never cache them or replace a failed
  // API request with the HTML application shell.
  if (pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
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
