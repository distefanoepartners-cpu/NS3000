// components/NotificationManager.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { notifyNewBooking, initializeNotifications } from '@/lib/notifications';
import { createBrowserClient } from '@supabase/ssr';

// Inizializza client Supabase nel componente
const getSupabaseClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

interface Notification {
  id: string;
  type: 'new_booking' | 'booking_update' | 'booking_cancel' | 'system';
  title: string;
  message: string;
  bookingId?: string;
  timestamp: string;
  read: boolean;
}

interface NotificationManagerProps {
  userId: string;
}

export default function NotificationManager({ userId }: NotificationManagerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('disconnected');
  const [usingFallback, setUsingFallback] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);

  // Carica notifiche salvate al mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ns3000_notifications');
      if (saved) {
        const savedNotifications = JSON.parse(saved);
        setNotifications(savedNotifications);
        setUnreadCount(savedNotifications.filter((n: Notification) => !n.read).length);
      }
    } catch (error) {
      console.error('Errore caricamento notifiche salvate:', error);
    }
  }, []);

  // Salva notifiche quando cambiano
  useEffect(() => {
    try {
      if (notifications.length > 0) {
        // Salva solo le ultime 50 notifiche
        const toSave = notifications.slice(0, 50);
        localStorage.setItem('ns3000_notifications', JSON.stringify(toSave));
      }
    } catch (error) {
      console.error('Errore salvataggio notifiche:', error);
    }
  }, [notifications]);

  // Funzione per riprodurre suono notifica
  const playNotificationSound = useCallback(() => {
    try {
      // Usa un beep sonoro semplice con Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configurazione suono: beep a 800Hz
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      // Volume moderato
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      // Riproduci per 0.5 secondi
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('Impossibile riprodurre suono:', error);
    }
  }, []);

  // Inizializza sistema notifiche push
  useEffect(() => {
    const initPush = async () => {
      try {
        console.log('🔔 Inizializzazione notifiche push...');
        
        // Registra Service Worker se non è già registrato
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker registrato:', registration.scope);
          } catch (swError) {
            console.warn('Service Worker già registrato o errore:', swError);
          }
        }
        
        const granted = await initializeNotifications(userId);
        setPermissionGranted(granted);
        if (granted) {
          console.log('✅ Notifiche push abilitate');
        } else {
          console.log('⚠️ Notifiche push non abilitate (potrebbe richiedere interazione utente)');
        }
      } catch (error) {
        console.error('Errore inizializzazione push:', error);
      }
    };

    initPush();
  }, [userId]);

  // Listener per messaggi dal Service Worker (quando arriva una notifica push)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Messaggio da Service Worker:', event.data);
        
        if (event.data && event.data.type === 'notification-clicked') {
          // Quando l'utente clicca su una notifica push, aggiungila al pannello
          const { bookingId, title, body, timestamp } = event.data;
          
          // Verifica se non è già nel pannello
          setNotifications(prev => {
            const exists = prev.some(n => n.bookingId === bookingId);
            if (exists) return prev;
            
            const newNotif: Notification = {
              id: `booking-${bookingId}`,
              type: 'new_booking',
              title: title || 'Nuova Prenotazione',
              message: body || '',
              bookingId: bookingId,
              timestamp: timestamp || new Date().toISOString(),
              read: false
            };
            
            return [newNotif, ...prev];
          });
          
          setUnreadCount(prev => prev + 1);
        }
      });
    }
  }, []);

  // 🔄 FALLBACK POLLING - Quando WebSocket non funziona (mobile)
  const checkForNewBookingsPolling = useCallback(async () => {
    if (!usingFallback) return;
    
    try {
      const response = await fetch(
        `/api/bookings?created_after=${lastCheck.toISOString()}`
      );
      
      if (!response.ok) return;
      
      const bookings = await response.json();
      
      if (bookings && bookings.length > 0) {
        const notifiedIds = JSON.parse(
          localStorage.getItem('ns3000_notified_bookings') || '[]'
        );
        
        const newBookings = bookings.filter(
          (booking: any) => !notifiedIds.includes(booking.id)
        );
        
        if (newBookings.length === 0) {
          setLastCheck(new Date());
          return;
        }
        
        const newNotifications: Notification[] = newBookings.map((booking: any) => ({
          id: `booking-${booking.id}`,
          type: 'new_booking',
          title: 'Nuova Prenotazione',
          message: `${booking.customer?.first_name || ''} ${booking.customer?.last_name || ''} - ${booking.boat?.name || 'Barca'}`,
          bookingId: booking.id,
          timestamp: booking.created_at || new Date().toISOString(),
          read: false
        }));
        
        const updatedNotifiedIds = [...notifiedIds, ...newBookings.map((b: any) => b.id)].slice(-100);
        localStorage.setItem('ns3000_notified_bookings', JSON.stringify(updatedNotifiedIds));
        
        setNotifications(prev => [...newNotifications, ...prev]);
        setUnreadCount(prev => prev + newNotifications.length);
        
        console.log('📊 [Polling] Nuove prenotazioni:', newBookings.length);
        
        playNotificationSound();
        for (const booking of newBookings) {
          await notifyNewBooking(booking);
        }
      }
      
      setLastCheck(new Date());
    } catch (error) {
      console.error('[Polling] Errore:', error);
    }
  }, [usingFallback, lastCheck, playNotificationSound]);

  // Setup polling fallback
  useEffect(() => {
    if (!usingFallback) return;
    
    console.log('📊 Fallback polling attivo (15s)');
    const interval = setInterval(checkForNewBookingsPolling, 15000);
    return () => clearInterval(interval);
  }, [usingFallback, checkForNewBookingsPolling]);

  // 🔌 WEBSOCKET REALTIME - Sottoscrizione a nuove prenotazioni
  useEffect(() => {
    // Previeni esecuzioni multiple
    if (isSubscribedRef.current) return;
    
    console.log('🔌 Connessione WebSocket Supabase Realtime...');
    
    const supabase = getSupabaseClient();
    
    // Timeout: se dopo 10 secondi non è connesso, usa fallback polling
    fallbackTimeoutRef.current = setTimeout(() => {
      if (!isSubscribedRef.current) {
        console.warn('⚠️ WebSocket timeout, attivo fallback polling');
        setUsingFallback(true);
        setRealtimeStatus('fallback');
      }
    }, 10000);
    
    const channel = supabase
      .channel('bookings-realtime-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('⚡ Nuova prenotazione REAL-TIME:', payload.new);
          
          const booking = payload.new as any;
          
          // Verifica se già notificata
          const notifiedIds = JSON.parse(
            localStorage.getItem('ns3000_notified_bookings') || '[]'
          );
          
          if (notifiedIds.includes(booking.id)) {
            console.log('ℹ️ Prenotazione già notificata, skip');
            return;
          }
          
          try {
            // Recupera dati completi con relazioni (customer, boat)
            const { data: fullBooking, error } = await supabase
              .from('bookings')
              .select(`
                *,
                customer:customers(id, first_name, last_name, email, phone),
                boat:boats(id, name, boat_type)
              `)
              .eq('id', booking.id)
              .single();
            
            if (error) {
              console.error('Errore recupero dati prenotazione:', error);
              return;
            }
            
            if (!fullBooking) {
              console.warn('Prenotazione non trovata:', booking.id);
              return;
            }
            
            console.log('📦 Dati completi prenotazione:', fullBooking);
            
            // Crea notifica
            const newNotif: Notification = {
              id: `booking-${booking.id}`,
              type: 'new_booking',
              title: 'Nuova Prenotazione',
              message: `${fullBooking.customer?.first_name || ''} ${fullBooking.customer?.last_name || ''} - ${fullBooking.boat?.name || 'Barca'}`,
              bookingId: booking.id,
              timestamp: booking.created_at || new Date().toISOString(),
              read: false
            };
            
            // Aggiungi al pannello
            setNotifications(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            // Salva tracking
            const updatedNotifiedIds = [...notifiedIds, booking.id].slice(-100);
            localStorage.setItem(
              'ns3000_notified_bookings',
              JSON.stringify(updatedNotifiedIds)
            );
            
            console.log('✅ Notifica aggiunta al pannello');
            
            // Riproduci suono
            playNotificationSound();
            
            // Invia notifica push
            await notifyNewBooking(fullBooking);
            
          } catch (err) {
            console.error('Errore gestione nuova prenotazione:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 WebSocket status:', status);
        setRealtimeStatus(status);
        
        // Cancella timeout se connesso
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
          }
          setUsingFallback(false);
        }
        
        switch (status) {
          case 'SUBSCRIBED':
            console.log('✅ Connesso al real-time Supabase');
            break;
          case 'CHANNEL_ERROR':
            console.error('❌ Errore connessione WebSocket, uso fallback');
            setUsingFallback(true);
            break;
          case 'TIMED_OUT':
            console.warn('⏱️ Timeout WebSocket, uso fallback');
            setUsingFallback(true);
            break;
          case 'CLOSED':
            console.log('🔌 Connessione WebSocket chiusa, uso fallback');
            setUsingFallback(true);
            break;
        }
      });

    // Cleanup alla chiusura
    return () => {
      console.log('🔌 Disconnessione WebSocket');
      isSubscribedRef.current = false;
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
      channel.unsubscribe();
    };
  }, [playNotificationSound]);

  // Marca notifica come letta
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Marca tutte come lette
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Rimuovi notifica
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id);
      if (notif && !notif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  // Richiedi permesso notifiche
  const requestPermission = async () => {
    try {
      console.log('🔔 Richiesta permesso notifiche...');
      console.log('Browser:', navigator.userAgent);
      console.log('Notification supportato:', 'Notification' in window);
      console.log('ServiceWorker supportato:', 'serviceWorker' in navigator);
      
      const granted = await initializeNotifications(userId);
      setPermissionGranted(granted);
      
      console.log('Permesso concesso:', granted);
      
      if (granted) {
        alert('✅ Notifiche abilitate! Riceverai avvisi per nuove prenotazioni in tempo reale.');
      } else {
        const permission = 'Notification' in window ? Notification.permission : 'denied';
        console.log('Permesso attuale:', permission);
        
        if (permission === 'denied') {
          alert('⚠️ Notifiche bloccate.\n\nPer abilitarle:\n1. Vai nelle impostazioni del browser\n2. Cerca "Notifiche" o "Autorizzazioni"\n3. Consenti notifiche per questo sito');
        } else {
          alert('⚠️ Impossibile abilitare le notifiche. Verifica le impostazioni del browser.');
        }
      }
    } catch (error) {
      console.error('Errore richiesta permesso:', error);
      alert('❌ Errore: ' + (error instanceof Error ? error.message : 'Impossibile abilitare notifiche'));
    }
  };

  return (
    <>
      {/* Badge notifiche */}
      <div className="relative">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Notifiche"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          {/* Indicatore connessione real-time */}
          <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
            realtimeStatus === 'SUBSCRIBED' 
              ? 'bg-green-500' 
              : usingFallback 
                ? 'bg-yellow-500' 
                : 'bg-gray-400'
          }`} />
        </button>

        {/* Pannello notifiche */}
        {showPanel && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowPanel(false)}
            />

            {/* Pannello */}
            <div className="absolute right-0 mt-2 w-full sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                    Notifiche
                    {unreadCount > 0 && (
                      <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                        ({unreadCount})
                      </span>
                    )}
                  </h3>
                  {/* Status real-time */}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    realtimeStatus === 'SUBSCRIBED' 
                      ? 'bg-green-100 text-green-700' 
                      : usingFallback
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}>
                    {realtimeStatus === 'SUBSCRIBED' 
                      ? '🟢 Live' 
                      : usingFallback 
                        ? '📊 Polling' 
                        : '🔴 Off'}
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap flex-shrink-0"
                  >
                    Segna tutte
                  </button>
                )}
              </div>

              {/* Lista notifiche */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>Nessuna notifica</p>
                    {realtimeStatus === 'SUBSCRIBED' && (
                      <p className="text-xs mt-2 text-green-600">
                        ✅ Sistema real-time attivo
                      </p>
                    )}
                    {usingFallback && (
                      <p className="text-xs mt-2 text-yellow-600">
                        📊 Controllo ogni 15 secondi
                      </p>
                    )}
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`p-3 sm:p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        !notif.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              !notif.read ? 'bg-blue-500' : 'bg-gray-300'
                            }`} />
                            <h4 className="text-sm sm:text-base font-medium text-gray-900 truncate">
                              {notif.title}
                            </h4>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 mb-2 break-words">
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(notif.timestamp).toLocaleString('it-IT')}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {!notif.read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Segna come letta"
                            >
                              <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => removeNotification(notif.id)}
                            className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                            title="Rimuovi"
                          >
                            <X className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                      {notif.bookingId && (
                        <a
                          href={`/bookings?id=${notif.bookingId}`}
                          className="mt-2 inline-block text-xs sm:text-sm text-blue-600 hover:text-blue-700"
                          onClick={() => setShowPanel(false)}
                        >
                          Visualizza →
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                {!permissionGranted && (
                  <button
                    onClick={requestPermission}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded-lg transition-colors"
                  >
                    🔔 Abilita Notifiche Push
                  </button>
                )}
                {permissionGranted && (
                  <p className="text-xs text-center text-gray-500">
                    ✅ Notifiche push abilitate • 
                    {realtimeStatus === 'SUBSCRIBED' 
                      ? ' 🟢 Real-time attivo' 
                      : usingFallback 
                        ? ' 📊 Polling attivo (15s)' 
                        : ' 🔴 Real-time offline'}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}