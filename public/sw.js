// Service Worker per NS3000 RENT
const CACHE_NAME = 'ns3000-v1'
const urlsToCache = [
  '/',
  '/boats',
  '/services',
  '/bookings',
  '/customers',
  '/suppliers',
  '/planning',
  '/reports'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  )
})