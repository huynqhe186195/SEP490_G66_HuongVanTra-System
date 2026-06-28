// HuongVanTra POS Service Worker
// Handles: static asset caching + offline fallback for API calls

const CACHE_NAME = 'hvt-static-v1'

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(['/', '/index.html'])
    )
  )
})

// ── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: intercept strategy ────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET — handled by app-level offline queue
  if (request.method !== 'GET') return

  // Skip API calls — IndexedDB handles data caching
  if (url.pathname.startsWith('/api')) return

  // Skip Vite dev server internals so hot reload always works
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules') ||
    url.searchParams.has('t') ||
    url.host !== self.location.host
  ) return

  // App shell + static assets — cache first, fallback to index.html when offline
  event.respondWith(cacheFirst(request))
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    // Only cache successful same-origin responses for real assets (not JS modules from Vite dev)
    if (response.ok && response.type === 'basic') {
      const url = new URL(request.url)
      // Only cache HTML and final build assets; skip Vite-transformed .js/.ts modules in dev
      if (url.pathname === '/' || url.pathname.endsWith('.html') ||
          url.pathname.match(/\.(css|woff2?|png|jpg|jpeg|svg|ico)$/)) {
        const cache = await caches.open(CACHE_NAME)
        cache.put(request, response.clone())
      }
    }
    return response
  } catch {
    // Offline — return cached index.html for SPA navigation
    const fallback = await caches.match('/index.html')
    return fallback ?? new Response('Offline', { status: 503 })
  }
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
