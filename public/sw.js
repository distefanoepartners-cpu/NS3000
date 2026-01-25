// public/sw.js
// Service Worker per Push Notifications NS3000

const CACHE_NAME = 'ns3000-v1';
const NOTIFICATION_TAG = 'ns3000-notification';

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

// Push event - riceve notifiche push dal server
self.addEventListener('push', async (event) => {
  console.log('[Service Worker] 🔔 Push received');

  let notificationData = {
    title: 'NS3000 Rent',
    body: 'Nuovo promemoria disponibile',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: NOTIFICATION_TAG,
    data: {
      url: '/',
      type: 'briefing'
    }
  };

  // Parse push data
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || 'NS3000 Rent',
        body: data.body || 'Nuovo promemoria disponibile',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag || NOTIFICATION_TAG,
        data: {
          url: data.url || '/',
          type: data.type || 'briefing',
          briefingId: data.briefingId,
          bookingId: data.bookingId
        },
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: '👁️ Visualizza',
            icon: '/icon-192.png'
          },
          {
            action: 'close',
            title: '✕ Chiudi'
          }
        ]
      };
    } catch (error) {
      console.error('[Service Worker] ❌ Error parsing push data:', error);
    }
  }

  event.waitUntil(
    handlePushNotification(notificationData)
  );
});

async function handlePushNotification(notificationData) {
  try {
    // Ottieni tutti i client (tab/finestre) aperti
    const allClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    console.log('[Service Worker] 📱 Found', allClients.length, 'open clients');

    // Controlla se c'è almeno un client VISIBILE (focused)
    const hasVisibleClient = allClients.some(client => {
      return client.focused || client.visibilityState === 'visible';
    });

    if (hasVisibleClient) {
      console.log('[Service Worker] ✅ App is VISIBLE - sending in-app notification');
      
      // App visibile → Invia messaggio in-app invece di notifica push
      allClients.forEach(client => {
        client.postMessage({
          type: 'push-notification',
          data: notificationData.data,
          title: notificationData.title,
          body: notificationData.body,
          timestamp: new Date().toISOString()
        });
      });

      // Non mostrare notifica push
      return;
    }

    // App NON visibile (chiusa o in background) → Mostra notifica push
    console.log('[Service Worker] 🔔 App is HIDDEN - showing push notification');
    
    await self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      vibrate: [200, 100, 200], // Vibrazione
      silent: false
    });

  } catch (error) {
    console.error('[Service Worker] ❌ Error handling notification:', error);
    
    // Fallback: mostra comunque la notifica
    await self.registration.showNotification(notificationData.title, notificationData);
  }
}

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] 🖱️ Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';
  const briefingId = event.notification.data?.briefingId;
  const bookingId = event.notification.data?.bookingId;
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((clientList) => {
      console.log('[Service Worker] 📱 Found', clientList.length, 'clients to notify');
      
      // Invia messaggio a tutti i client aperti
      clientList.forEach(client => {
        client.postMessage({
          type: 'notification-clicked',
          briefingId: briefingId,
          bookingId: bookingId,
          title: event.notification.title,
          body: event.notification.body,
          timestamp: new Date().toISOString()
        });
      });
      
      // Cerca una finestra già aperta con NS3000
      for (let client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('[Service Worker] ✅ Focusing existing window');
          return client.focus().then(() => {
            // Naviga se necessario
            if (briefingId) {
              client.navigate(`/?briefing=${briefingId}`);
            } else if (bookingId) {
              client.navigate(`/bookings?id=${bookingId}`);
            }
          });
        }
      }
      
      // Nessuna finestra aperta → aprila
      if (clients.openWindow) {
        console.log('[Service Worker] 🆕 Opening new window');
        let finalUrl = urlToOpen;
        if (briefingId) {
          finalUrl = `/?briefing=${briefingId}`;
        } else if (bookingId) {
          finalUrl = `/bookings?id=${bookingId}`;
        }
        return clients.openWindow(finalUrl);
      }
    })
  );
});

// Message event - messaggi dall'app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] 💬 Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync per operazioni offline (opzionale)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] 🔄 Background sync:', event.tag);
  
  if (event.tag === 'sync-briefings') {
    event.waitUntil(syncBriefings());
  }
});

async function syncBriefings() {
  console.log('[Service Worker] 🔄 Syncing briefings...');
  // TODO: Implementa sincronizzazione se necessario
}