/* Service worker for the ZeroForex INR converter.
 *
 * - App shell (same-origin files) is precached so the app opens offline.
 * - Tailwind runtime and Google Fonts are cached on first successful load and
 *   refreshed in the background.
 * - Exchange-rate API calls are never intercepted; the page keeps its own
 *   last-known rates in localStorage and shows a "Cached rates" indicator.
 *
 * Bump CACHE_VERSION whenever a precached file changes.
 */
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `zeroforex-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `zeroforex-runtime-${CACHE_VERSION}`;

const APP_PAGE = './converter.html';
const SHELL_FILES = [
  './',
  APP_PAGE,
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

// Cross-origin assets the page needs to render. Cached opaquely (no-cors).
const RUNTIME_ORIGINS = new Set([
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);
const WARM_URLS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

const API_HOST = 'open.er-api.com';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // Required files: a failure here should fail the install so we never
    // activate a half-populated shell.
    await shell.addAll(SHELL_FILES);

    // Best effort: warm the third-party assets, but don't block installation
    // if the user is on a flaky connection.
    const runtime = await caches.open(RUNTIME_CACHE);
    await Promise.allSettled(WARM_URLS.map(async (url) => {
      const response = await fetch(new Request(url, { mode: 'no-cors' }));
      await runtime.put(url, response);
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith('zeroforex-') && !keep.has(name))
           .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Live rates: let the page handle failures and fall back to its own cache.
  if (url.hostname === API_HOST) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (RUNTIME_ORIGINS.has(url.origin)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});

// Prefer a fresh page, but fall back quickly to the cached copy when offline
// or on a slow connection.
async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetchWithTimeout(request, 3000);
    if (response.ok) cache.put(APP_PAGE, response.clone());
    return response;
  } catch (err) {
    return (await cache.match(request, { ignoreSearch: true }))
        || (await cache.match(APP_PAGE))
        || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    // Opaque (no-cors) responses report status 0 but are still cacheable.
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
  }).catch(() => undefined);

  if (cached) {
    refresh.catch(() => {});
    return cached;
  }
  return (await refresh) || Response.error();
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
