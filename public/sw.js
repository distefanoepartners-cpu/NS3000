// Service Worker per NS3000 RENT
const CACHE_NAME = 'ns3000-v1'
const urlsToCache = [
  '/login',
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
  // Ignora redirect e richieste non-GET
  if (event.request.method !== 'GET' || event.request.redirect === 'manual') {
    return
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request)
    })
  )
})