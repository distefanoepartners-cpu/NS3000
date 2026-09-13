import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Questo endpoint viene chiamato da Vercel Cron alle 20:00 (18:00 UTC)
export async function GET(request: Request) {
  try {
    // Verifica autorizzazione cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🌙 20:00 Cron - Creazione briefing per domani');

    // Calcola domani
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const dateStr = tomorrow.toISOString().split('T')[0];

    console.log('📅 Target date:', dateStr);

    // Verifica se esiste già
    const { data: existing } = await supabase
      .from('daily_briefings')
      .select('id')
      .eq('date', dateStr)
      .single();

    if (existing) {
      console.log('⚠️ Briefing già esistente, lo aggiorno');
      const result = await updateBriefing(existing.id, tomorrow, tomorrowEnd, dateStr);
      return NextResponse.json(result);
    }

    // Crea nuovo briefing
    const result = await createBriefing(tomorrow, tomorrowEnd, dateStr);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('💥 Error in 20:00 cron:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

async function createBriefing(tomorrow: Date, tomorrowEnd: Date, dateStr: string) {
  // Ottieni prenotazioni
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_date,
      time_slot,
      num_passengers,
      customer_id,
      boat_id,
      service_id,
      skipper_id,
      booking_status_id
    `)
    .eq('booking_date', dateStr)
    .order('booking_date', { ascending: true });

  if (error) {
    console.error('❌ Error fetching bookings:', error);
    throw error;
  }

  // Filtra solo confermate/pending
  const { data: validStatuses } = await supabase
    .from('booking_statuses')
    .select('id')
    .in('code', ['confirmed', 'pending']);

  const validStatusIds = validStatuses?.map(s => s.id) || [];
  const filteredBookings = bookings?.filter(b => validStatusIds.includes(b.booking_status_id)) || [];

  console.log(`📦 Trovate ${filteredBookings.length} prenotazioni`);

  // Arricchisci prenotazioni
  const enrichedBookings = await Promise.all(
    filteredBookings.map(async (booking) => {
      const [customer, boat, service, skipper, status] = await Promise.all([
        booking.customer_id 
          ? supabase.from('customers').select('first_name, last_name, phone').eq('id', booking.customer_id).single()
          : null,
        booking.boat_id
          ? supabase.from('boats').select('name').eq('id', booking.boat_id).single()
          : null,
        booking.service_id
          ? supabase.from('rental_services').select('name').eq('id', booking.service_id).single()
          : null,
        booking.skipper_id
          ? supabase.from('skippers').select('first_name, last_name, phone').eq('id', booking.skipper_id).single()
          : null,
        booking.booking_status_id
          ? supabase.from('booking_statuses').select('name, code').eq('id', booking.booking_status_id).single()
          : null
      ]);

      return {
        id: booking.id,
        booking_date: booking.booking_date,
        time_slot: booking.time_slot,
        num_passengers: booking.num_passengers,
        customer: customer?.data || null,
        boat: boat?.data || null,
        service: service?.data || null,
        skipper: skipper?.data || null,
        booking_status: status?.data || null
      };
    })
  );

  const totalPassengers = enrichedBookings.reduce((sum, b) => sum + (b.num_passengers || 0), 0);

  // Crea briefing
  const { data: briefing, error: insertError } = await supabase
    .from('daily_briefings')
    .insert({
      date: dateStr,
      bookings_count: enrichedBookings.length,
      total_passengers: totalPassengers,
      content: enrichedBookings
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Error creating briefing:', insertError);
    throw insertError;
  }

  console.log('✅ Briefing creato:', briefing.id);

  // ⭐ Invia push notification serale
  await sendBriefingPush(enrichedBookings.length, totalPassengers, briefing.id, 'domani');

  return {
    success: true,
    message: '✅ Briefing serale completato (20:00)',
    briefing: {
      id: briefing.id,
      date: briefing.date,
      bookings_count: briefing.bookings_count,
      total_passengers: briefing.total_passengers
    }
  };
}

async function updateBriefing(briefingId: string, tomorrow: Date, tomorrowEnd: Date, dateStr: string) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_date, time_slot, num_passengers, customer_id, boat_id, service_id, skipper_id, booking_status_id')
   .eq('booking_date', dateStr)
    .order('booking_date', { ascending: true });

  const { data: validStatuses } = await supabase
    .from('booking_statuses')
    .select('id')
    .in('code', ['confirmed', 'pending']);

  const validStatusIds = validStatuses?.map(s => s.id) || [];
  const filteredBookings = bookings?.filter(b => validStatusIds.includes(b.booking_status_id)) || [];

  const enrichedBookings = await Promise.all(
    filteredBookings.map(async (booking) => {
      const [customer, boat, service, skipper, status] = await Promise.all([
        booking.customer_id ? supabase.from('customers').select('first_name, last_name, phone').eq('id', booking.customer_id).single() : null,
        booking.boat_id ? supabase.from('boats').select('name').eq('id', booking.boat_id).single() : null,
        booking.service_id ? supabase.from('rental_services').select('name').eq('id', booking.service_id).single() : null,
        booking.skipper_id ? supabase.from('skippers').select('first_name, last_name, phone').eq('id', booking.skipper_id).single() : null,
        booking.booking_status_id ? supabase.from('booking_statuses').select('name, code').eq('id', booking.booking_status_id).single() : null
      ]);

      return {
        id: booking.id,
        booking_date: booking.booking_date,
        time_slot: booking.time_slot,
        num_passengers: booking.num_passengers,
        customer: customer?.data || null,
        boat: boat?.data || null,
        service: service?.data || null,
        skipper: skipper?.data || null,
        booking_status: status?.data || null
      };
    })
  );

  const totalPassengers = enrichedBookings.reduce((sum, b) => sum + (b.num_passengers || 0), 0);

  const { error: updateError } = await supabase
    .from('daily_briefings')
    .update({
      bookings_count: enrichedBookings.length,
      total_passengers: totalPassengers,
      content: enrichedBookings
    })
    .eq('id', briefingId);

  if (updateError) {
    console.error('❌ Error updating briefing:', updateError);
    throw updateError;
  }

  console.log('✅ Briefing aggiornato:', briefingId);

  // ⭐ Invia push notification serale
  await sendBriefingPush(enrichedBookings.length, totalPassengers, briefingId, 'domani');

  return {
    success: true,
    message: '✅ Briefing serale aggiornato (20:00)',
    briefing: {
      id: briefingId,
      date: dateStr,
      bookings_count: enrichedBookings.length,
      total_passengers: totalPassengers
    }
  };
}

// ⭐ Invia push notification per il briefing
async function sendBriefingPush(bookingsCount: number, totalPassengers: number, briefingId: string, quando: string = 'domani') {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .in('role', ['admin', 'staff'])
      .eq('is_active', true);

    if (!users || users.length === 0) {
      console.log('⚠️ Nessun utente admin/staff trovato per push');
      return;
    }

    const userIds = users.map(u => u.id);

    const targetDate = new Date();
    if (quando === 'domani') {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const dateLabel = targetDate.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    const title = quando === 'domani' 
      ? `🌙 Briefing ${dateLabel}` 
      : `📋 Briefing oggi`;
    
    const message = bookingsCount > 0
      ? `${quando === 'domani' ? 'Domani' : 'Oggi'} ${bookingsCount} prenotazioni, ${totalPassengers} passeggeri`
      : `Nessuna prenotazione per ${quando}`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

    const res = await fetch(`${baseUrl}/api/notifications/send-push`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      body: JSON.stringify({
        title,
        message,
        userIds,
        tag: 'briefing-daily',
        data: { type: 'briefing', briefingId, url: '/' }
      })
    });

    if (res.ok) {
      const result = await res.json();
      console.log(`📤 Push briefing inviate: ${result.sent} successi, ${result.failed} fallite`);
    } else {
      console.error('❌ Errore invio push briefing:', await res.text());
    }
  } catch (error) {
    console.error('❌ Errore sendBriefingPush:', error);
  }
}