// app/api/notifications/send-push/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configura VAPID keys
webpush.setVapidDetails(
  'mailto:info@ns3000rent.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      title, 
      message, 
      userIds, // Array di user IDs a cui inviare
      data, // Dati extra (bookingId, briefingId, etc)
      tag = 'ns3000-notification'
    } = body;

    if (!title || !message) {
      return NextResponse.json({ 
        error: 'title e message sono richiesti' 
      }, { status: 400 });
    }

    console.log('📤 Invio notifiche push a', userIds?.length || 'tutti', 'utenti');

    // Ottieni subscriptions
    let query = supabase.from('push_subscriptions').select('*');
    
    if (userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error('❌ Errore caricamento subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️ Nessuna subscription trovata');
      return NextResponse.json({ 
        success: true,
        message: 'Nessun utente da notificare',
        sent: 0
      });
    }

    console.log(`📱 Trovate ${subscriptions.length} subscriptions`);

    // Prepara payload notifica
    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      data: {
        ...data,
        url: data?.url || '/',
        timestamp: new Date().toISOString()
      }
    });

    // Invia notifiche a tutti
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          // Verifica che subscription non sia null o vuota
          if (!sub.subscription) {
            console.warn(`⚠️ Subscription vuota per user ${sub.user_id}, skip`);
            return { userId: sub.user_id, status: 'skipped', error: 'Empty subscription' };
          }

          // Parse subscription gestendo doppio encoding
          let subscription = sub.subscription;
          
          // Se è stringa, fai il primo parse
          if (typeof subscription === 'string') {
            try {
              subscription = JSON.parse(subscription);
            } catch (parseError) {
              console.error(`❌ Errore parsing subscription per user ${sub.user_id}:`, parseError);
              return { userId: sub.user_id, status: 'failed', error: 'Invalid JSON' };
            }
          }
          
          // Se dopo il primo parse è ancora stringa, fai il secondo parse
          if (typeof subscription === 'string') {
            try {
              subscription = JSON.parse(subscription);
            } catch (parseError) {
              console.error(`❌ Errore secondo parsing per user ${sub.user_id}:`, parseError);
              return { userId: sub.user_id, status: 'failed', error: 'Invalid nested JSON' };
            }
          }

          // Verifica che subscription abbia endpoint
          if (!subscription || !subscription.endpoint) {
            console.error(`❌ Subscription senza endpoint per user ${sub.user_id}`);
            return { userId: sub.user_id, status: 'failed', error: 'Missing endpoint' };
          }

          console.log(`📤 Sending to user ${sub.user_id}:`, subscription.endpoint?.substring(0, 50) + '...');

          await webpush.sendNotification(subscription, payload);
          
          // Log successo
          const logData: any = {
            user_id: sub.user_id,
            type: data?.type || 'push',
            title,
            body: message,
            delivery_status: 'sent',
            metadata: data
          };
          
          // Includi booking_id solo se presente
          if (data?.bookingId) {
            logData.booking_id = data.bookingId;
          }
          
          await supabase.from('notification_logs').insert(logData);

          console.log(`✅ Sent to user ${sub.user_id}`);
          return { userId: sub.user_id, status: 'sent' };
        } catch (error: any) {
          console.error(`❌ Errore invio a user ${sub.user_id}:`, error.message);
          
          // Log errore
          const logData: any = {
            user_id: sub.user_id,
            type: data?.type || 'push',
            title,
            body: message,
            delivery_status: 'failed',
            error_message: error.message,
            metadata: data
          };
          
          // Includi booking_id solo se presente
          if (data?.bookingId) {
            logData.booking_id = data.bookingId;
          }
          
          await supabase.from('notification_logs').insert(logData);

          // Se subscription non valida, eliminala
          if (error.statusCode === 410) {
            console.log(`🗑️ Subscription scaduta, rimuovo user ${sub.user_id}`);
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }

          return { userId: sub.user_id, status: 'failed', error: error.message };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.status === 'sent').length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'failed')).length;

    console.log(`✅ Inviate: ${sent}, ❌ Fallite: ${failed}`);

    return NextResponse.json({
      success: true,
      message: `Notifiche inviate a ${sent} utenti`,
      sent,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'failed' })
    });

  } catch (error: any) {
    console.error('💥 Errore invio notifiche:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}