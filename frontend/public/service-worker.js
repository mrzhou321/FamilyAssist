const CACHE_NAME = 'family-assister-shell-v2'
const SHELL_URLS = [
  '/mobile/',
  '/favicon.svg',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(SHELL_URLS)
        await cacheEntryAssets(cache, ['/mobile/', '/admin/'])
      })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/mobile/', copy))
          return response
        })
        .catch(() => caches.match('/mobile/')),
    )
    return
  }

  if (request.method !== 'GET') return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.svg'))) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})

async function cacheEntryAssets(cache, entryUrls) {
  const assetUrls = new Set()
  await Promise.all(
    entryUrls.map(async (entryUrl) => {
      try {
        const response = await fetch(entryUrl, { cache: 'no-cache' })
        if (!response.ok) return
        const html = await response.clone().text()
        await cache.put(entryUrl, response)
        for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
          assetUrls.add(match[1])
        }
      } catch {
        // Best-effort asset warmup; the static shell cache still installs.
      }
    }),
  )
  await Promise.all([...assetUrls].map((assetUrl) => cache.add(assetUrl).catch(() => undefined)))
}
