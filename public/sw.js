// public/sw.js
// Service Worker per Push Notifications NS3000

const CACHE_NAME = 'ns3000-v1';
const NOTIFICATION_TAG = 'booking-notification';

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    clients.claim()
  );
});

// Push event - riceve notifiche push dal server
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let notification = {
    title: 'NS3000 Rent',
    body: 'Hai ricevuto una nuova prenotazione!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: NOTIFICATION_TAG,
    data: {
      url: '/prenotazioni'
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notification = {
        title: data.title || 'NS3000 Rent',
        body: data.body || 'Nuova prenotazione ricevuta',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: NOTIFICATION_TAG,
        data: {
          url: data.url || '/prenotazioni',
          bookingId: data.bookingId
        },
        requireInteraction: true, // Rimane visibile fino a interazione
        actions: [
          {
            action: 'view',
            title: 'Visualizza'
          },
          {
            action: 'close',
            title: 'Chiudi'
          }
        ]
      };
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notification.title, notification)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Apri o porta in focus la pagina
  const urlToOpen = event.notification.data?.url || '/';
  const bookingId = event.notification.data?.bookingId;
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((clientList) => {
      // Invia messaggio a tutti i client aperti per aggiungere notifica al pannello
      clientList.forEach(client => {
        client.postMessage({
          type: 'notification-clicked',
          bookingId: bookingId,
          title: event.notification.title,
          body: event.notification.body,
          timestamp: new Date().toISOString()
        });
      });
      
      // Cerca una finestra già aperta
      for (let client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (bookingId) {
            client.navigate(`/bookings?id=${bookingId}`);
          }
          return;
        }
      }
      
      // Se non c'è, apri una nuova finestra
      if (clients.openWindow) {
        const finalUrl = bookingId ? `/bookings?id=${bookingId}` : urlToOpen;
        return clients.openWindow(finalUrl);
      }
    })
  );
});

// Background sync per operazioni offline (opzionale)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-bookings') {
    event.waitUntil(syncBookings());
  }
});

async function syncBookings() {
  // Implementa sincronizzazione prenotazioni offline se necessario
  console.log('[Service Worker] Syncing bookings...');
}