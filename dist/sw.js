// public/sw.js
// Perin Service Worker — cache versioning
//
// Every deploy gets a new CACHE_VERSION. Old caches are deleted automatically.
// This prevents users from being stuck on stale builds.
//
// To update: bump CACHE_VERSION before deploying. 
// Best practice: set this to your build timestamp or git commit short hash.
// Your deploy.sh can inject this automatically (see comment below).

// ── VERSION — bump this on every deploy ───────────────────────────────────────
// To auto-inject from deploy.sh, add this line before vite build:
//   sed -i '' "s/CACHE_VERSION = .*/CACHE_VERSION = '$(date +%s)'/" public/sw.js
const CACHE_VERSION = 'perin-v1'
const CACHE_NAME = `perin-${CACHE_VERSION}`

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
]

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    }).then(() => {
      // Take control immediately — don't wait for old SW to die
      return self.skipWaiting()
    })
  )
})

// ── Activate — delete old caches ─────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('perin-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim()
    })
  )
})

// ── Fetch — network first, cache fallback ─────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never intercept API calls — always go to network
  if (
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('elevenlabs.io') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('stripe.com')
  ) {
    return // let the browser handle it
  }

  // For same-origin requests: network first, fall back to cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful GET responses
          if (event.request.method === 'GET' && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          // Network failed — serve from cache
          return caches.match(event.request).then((cached) => {
            if (cached) return cached
            // Final fallback for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html')
            }
          })
        })
    )
  }
})

// ── Message — force update from app ──────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
