const CACHE_VERSION = 'v2';
const STATIC_CACHE = `gobalbilad-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `gobalbilad-runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/about-us.html',
  '/contact-us.html',
  '/privacy-policy.html',
  '/terms-of-service.html',
  '/login.html',
  '/account.html',
  '/auth-callback.html',
  '/assets/css/main.css',
  '/assets/js/main.js',
  '/assets/js/auth.js',
  '/assets/images/gb-icon.png',
  '/assets/images/gb-banner.webp',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Tajawal:wght@400;500;700&display=swap'
];

const OFFLINE_FALLBACK = '/index.html';

// Install - cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - purge old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    if (request.mode === 'navigate') {
      const offline = await caches.match(OFFLINE_FALLBACK);
      if (offline) {
        return offline;
      }
    }

    throw _error;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const fresh = await fetchPromise;
  if (fresh) {
    return fresh;
  }

  if (request.mode === 'navigate') {
    const offline = await caches.match(OFFLINE_FALLBACK);
    if (offline) {
      return offline;
    }
  }

  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

// Fetch - selective strategies by request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and unsupported protocols
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Network-first for HTML navigation and API calls
  if (request.mode === 'navigate' || url.hostname.includes('supabase')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Stale-while-revalidate for static assets and same-origin GET requests
  event.respondWith(staleWhileRevalidate(request));
});
