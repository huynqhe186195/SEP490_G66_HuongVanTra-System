// HuongVanTra POS Service Worker
// Handles: static asset caching + offline fallback for API calls

const CACHE_NAME = 'hvt-static-v2'

// ── Install: chỉ nạp offline fallback, không cache '/' ───────────────────────
// Cache '/' khiến trang được phục vụ từ bản HTML cũ, trỏ tới file asset băm tên
// đã bị xoá sau lần build mới → CSS 404, giao diện mất style ở lần vào đầu.
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.add(new Request('/index.html', { cache: 'reload' }))
    ).catch(() => {})
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

  // Skip Vite/dev module graph — never cache transformed sources
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules') ||
    url.searchParams.has('t') ||
    url.host !== self.location.host
  ) return

  // Điều hướng trang: luôn lấy HTML mới từ mạng để thẻ <link> CSS khớp bản build
  // hiện tại; chỉ dùng cache khi mất mạng.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstForDocument(request))
    return
  }

  // App shell + static assets — cache first, fallback to index.html when offline
  event.respondWith(cacheFirst(request))
})

async function networkFirstForDocument(request) {
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME)
      cache.put('/index.html', response.clone())
    }
    return response
  } catch {
    const fallback = await caches.match('/index.html')
    return fallback ?? new Response('Offline', { status: 503 })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      const url = new URL(request.url)
      // Chỉ cache asset băm tên của bản build; HTML do networkFirstForDocument lo.
      if (url.pathname.match(/\.(css|js|woff2?|png|jpg|jpeg|svg|ico)$/)) {
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
