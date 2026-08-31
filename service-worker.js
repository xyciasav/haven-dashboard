const CACHE = 'haven-shell-v0.11.1-1';
const SHELL = ['/', '/index.html', '/styles.css?v=0.11.1', '/settings.css?v=0.11.1', '/security.css?v=0.11.1', '/version.css?v=0.11.1', '/keycloak.css?v=0.11.1', '/recovery.css?v=0.11.1', '/app-manager.css?v=0.11.1', '/integrations.css?v=0.11.1', '/event.css?v=0.11.1', '/responsibilities.css?v=0.11.1', '/command-palette.css?v=0.11.1', '/app.js?v=0.11.1', '/responsibilities-ui.js', '/command-palette.js', '/vendor/keycloak.js', '/manifest.webmanifest', '/icons/haven.svg', '/icons/haven-192.png', '/icons/haven-512.png'];

SHELL.push('/resilience.css?v=0.11.1', '/diagnostics.css?v=0.11.1', '/attention.css?v=0.11.1', '/display-settings.css?v=0.11.1', '/onboarding.css?v=0.11.1', '/resilience.js', '/diagnostics-ui.js', '/attention-ui.js', '/display-settings.js', '/onboarding.js', '/offline-data.js', '/daily-planner.js');

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
  if (pathname.endsWith('.js') || pathname.endsWith('.css')) {
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
