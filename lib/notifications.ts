// lib/notifications.ts
// Sistema di notifiche per NS3000

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
}

// Verifica se le notifiche sono supportate
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

// Richiedi permesso per le notifiche
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    throw new Error('Le notifiche non sono supportate da questo browser');
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Verifica lo stato del permesso
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  return Notification.permission;
}

// Invia una notifica locale
export async function sendLocalNotification(payload: NotificationPayload): Promise<void> {
  const permission = getNotificationPermission();
  
  if (permission !== 'granted') {
    console.warn('Permesso notifiche non concesso');
    return;
  }

  try {
    // Se c'è un service worker registrato, usa quello
    const registration = await navigator.serviceWorker.ready;
    
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/icon-96x96.png',
      data: payload.data,
      tag: payload.tag || 'ns3000-notification',
      requireInteraction: payload.requireInteraction || true,
      vibrate: [200, 100, 200], // Pattern di vibrazione per mobile
      actions: [
        {
          action: 'view',
          title: 'Visualizza',
          icon: '/icons/view.png'
        },
        {
          action: 'close',
          title: 'Chiudi',
          icon: '/icons/close.png'
        }
      ]
    });
  } catch (error) {
    console.error('Errore invio notifica:', error);
    
    // Fallback: notifica browser base
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      tag: payload.tag || 'ns3000-notification'
    });
  }
}

// Riproduci suono di notifica
export function playNotificationSound(soundType: 'success' | 'alert' | 'info' = 'alert'): void {
  try {
    const audio = new Audio(`/sounds/${soundType}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(err => console.warn('Impossibile riprodurre suono:', err));
  } catch (error) {
    console.warn('Errore riproduzione suono:', error);
  }
}

// Notifica per nuova prenotazione
export async function notifyNewBooking(booking: any): Promise<void> {
  const customerName = booking.customer 
    ? `${booking.customer.first_name} ${booking.customer.last_name}`
    : 'Cliente';
  
  const boatName = booking.boat?.name || 'Imbarcazione';
  
  const bookingDate = new Date(booking.booking_date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  await sendLocalNotification({
    title: '🆕 Nuova Prenotazione!',
    body: `${customerName} ha prenotato ${boatName} per il ${bookingDate}`,
    icon: '/icon-192x192.png',
    tag: `booking-${booking.id}`,
    requireInteraction: true,
    data: {
      type: 'new_booking',
      bookingId: booking.id,
      url: `/bookings?id=${booking.id}`
    }
  });

  // Riproduci suono
  playNotificationSound('alert');
}

// Notifica per modifica prenotazione
export async function notifyBookingUpdate(booking: any, changes: string): Promise<void> {
  const customerName = booking.customer 
    ? `${booking.customer.first_name} ${booking.customer.last_name}`
    : 'Cliente';

  await sendLocalNotification({
    title: '📝 Prenotazione Modificata',
    body: `Prenotazione di ${customerName}: ${changes}`,
    icon: '/icon-192x192.png',
    tag: `booking-update-${booking.id}`,
    data: {
      type: 'booking_update',
      bookingId: booking.id,
      url: `/bookings?id=${booking.id}`
    }
  });

  playNotificationSound('info');
}

// Notifica per cancellazione prenotazione
export async function notifyBookingCancellation(booking: any): Promise<void> {
  const customerName = booking.customer 
    ? `${booking.customer.first_name} ${booking.customer.last_name}`
    : 'Cliente';

  await sendLocalNotification({
    title: '❌ Prenotazione Annullata',
    body: `La prenotazione di ${customerName} è stata annullata`,
    icon: '/icon-192x192.png',
    tag: `booking-cancel-${booking.id}`,
    data: {
      type: 'booking_cancellation',
      bookingId: booking.id,
      url: '/bookings'
    }
  });

  playNotificationSound('alert');
}

// Salva token push per notifiche server
export async function savePushToken(userId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Configurazione VAPID (dovrai generare le chiavi)
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    
    if (!vapidPublicKey) {
      console.warn('VAPID public key non configurata');
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // Salva la subscription su Supabase
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        subscription: JSON.stringify(subscription)
      })
    });

    if (!response.ok) {
      throw new Error('Errore salvataggio subscription');
    }
  } catch (error) {
    console.error('Errore salvataggio push token:', error);
  }
}

// Helper per convertire VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Inizializza sistema notifiche
export async function initializeNotifications(userId: string): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn('Notifiche non supportate');
    return false;
  }

  try {
    const permission = await requestNotificationPermission();
    
    if (permission === 'granted') {
      await savePushToken(userId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Errore inizializzazione notifiche:', error);
    return false;
  }
}
