// components/InAppNotificationHandler.tsx
'use client';

import { useEffect } from 'react';
import { toast } from 'sonner'; // O usa il tuo sistema di toast

export default function InAppNotificationHandler() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.log('⚠️ Service Worker non supportato');
      return;
    }

    // Listener per messaggi dal Service Worker
    const handleMessage = (event: MessageEvent) => {
      console.log('📨 Messaggio da Service Worker:', event.data);

      // Messaggio di tipo "push-notification" = notifica in-app
      if (event.data && event.data.type === 'push-notification') {
        const { title, body, data } = event.data;

        console.log('🔔 In-app notification:', title, body);

        // Mostra toast/banner in-app
        showInAppNotification(title, body, data);
      }

      // Messaggio quando utente clicca notifica push
      if (event.data && event.data.type === 'notification-clicked') {
        const { title, body, briefingId, bookingId } = event.data;
        
        console.log('👆 Notification clicked:', { briefingId, bookingId });

        // Gestisci navigazione o azione
        if (briefingId) {
          // Ricarica la pagina per mostrare il modal
          window.location.reload();
        } else if (bookingId) {
          window.location.href = `/bookings?id=${bookingId}`;
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  return null; // Componente invisibile
}

function showInAppNotification(title: string, body: string, data: any) {
  // Opzione 1: Usa Sonner toast (se installato)
  if (typeof toast !== 'undefined') {
    toast.info(body, {
      description: title,
      duration: 5000,
      action: data?.url ? {
        label: 'Visualizza',
        onClick: () => {
          window.location.href = data.url;
        }
      } : undefined
    });
    return;
  }

  // Opzione 2: Notifica browser nativa (come fallback)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'ns3000-in-app',
        requireInteraction: false
      });

      notification.onclick = () => {
        if (data?.url) {
          window.location.href = data.url;
        }
        notification.close();
      };

      // Auto-chiudi dopo 5 secondi
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Errore mostrando notifica:', error);
      // Fallback: alert o custom banner
      showCustomBanner(title, body);
    }
  } else {
    // Fallback: custom banner
    showCustomBanner(title, body);
  }
}

function showCustomBanner(title: string, body: string) {
  // Crea un banner in-app custom
  const banner = document.createElement('div');
  banner.className = 'fixed top-4 right-4 z-[9999] bg-blue-600 text-white rounded-lg shadow-2xl p-4 max-w-sm animate-slide-in';
  banner.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
        </svg>
      </div>
      <div class="flex-1">
        <h4 class="font-bold mb-1">${title}</h4>
        <p class="text-sm text-blue-100">${body}</p>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="flex-shrink-0 text-white hover:text-blue-200">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `;

  // Aggiungi stile animazione
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .animate-slide-in {
      animation: slide-in 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(banner);

  // Rimuovi dopo 5 secondi
  setTimeout(() => {
    banner.style.opacity = '0';
    banner.style.transform = 'translateX(100%)';
    banner.style.transition = 'all 0.3s ease-out';
    setTimeout(() => banner.remove(), 300);
  }, 5000);
}