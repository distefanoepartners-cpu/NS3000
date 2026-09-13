// public/sw.js — Service Worker minimale NS3000 v2 (2026-05-22)
//
// Versione precedente gestiva push notifications con VAPID + showNotification.
// Funzione dismessa per decisione cliente. Questo SW mantiene solo il minimo
// indispensabile per:
//   • PWA installability (manifest + SW registrato = "Aggiungi a Home Screen")
//   • Auto-rimozione delle subscription push residue sui device già installati
//   • Cleanup cache vecchia (CACHE_NAME 'ns3000-v1' della versione precedente)
//
// Da rimuovere completamente solo se in futuro decidi di togliere anche PWA
// install (poco probabile — comporterebbe perdere l'app dalle home screen
// degli operatori).

const SW_VERSION = '2.0.0';

self.addEventListener('install', (event) => {
  console.log('[SW v2] Installing minimal worker', SW_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW v2] Activating', SW_VERSION);
  event.waitUntil(
    (async () => {
      // 1. Prendi controllo immediato di tutti i client
      await self.clients.claim();

      // 2. Cleanup: rimuovi qualunque cache della versione push
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        console.log('[SW v2] Cache puliti:', cacheNames);
      } catch (e) {
        console.warn('[SW v2] Errore cleanup cache:', e);
      }

      // 3. Cleanup: disiscrivi qualunque push subscription residua sul device
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          console.log('[SW v2] Push subscription rimossa');
        }
      } catch (e) {
        console.warn('[SW v2] Errore unsubscribe push:', e);
      }
    })()
  );
});

// Niente handler 'push' né 'notificationclick': la feature è dismessa.
// Eventuali push residue inviate dal provider (poco probabile dopo unsubscribe)
// verranno ignorate silenziosamente dal browser.

// Messaggi dall'app (utili per controllo aggiornamenti manuali)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});