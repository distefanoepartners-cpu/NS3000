import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Ottieni URL base per le chiamate API interne
function getBaseUrl() {
  // SEMPRE usa il dominio production per le notifiche
  // Gli URL preview di Vercel non sono accessibili dalle API
  return 'https://ns-3000.vercel.app';
}

export async function POST(request: Request) {
  try {
    console.log('📋 Invio manuale briefing');

    // Leggi la data dal body (opzionale) - gestione sicura del JSON
    let customDate = null;
    try {
      const body = await request.json();
      customDate = body?.date || null;
    } catch (jsonError) {
      console.log('📅 Nessun body JSON, uso data di default (domani)');
    }

    // Calcola la data target (custom o domani)
    let tomorrow = new Date();
    if (customDate) {
      tomorrow = new Date(customDate);
      console.log('📅 Data personalizzata ricevuta:', customDate);
    } else {
      tomorrow.setDate(tomorrow.getDate() + 1);
      console.log('📅 Nessuna data personalizzata, uso domani');
    }
    tomorrow.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const dateStr = tomorrow.toISOString().split('T')[0];

    console.log('📅 Target date finale:', dateStr);

    // Verifica se esiste già
    const { data: existing } = await supabase
      .from('daily_briefings')
      .select('id')
      .eq('date', dateStr)
      .single();

    if (existing) {
      console.log('⚠️ Briefing esistente, lo aggiorno');
      const result = await updateBriefing(existing.id, tomorrow, tomorrowEnd, dateStr);
      return NextResponse.json(result);
    }

    // Crea nuovo briefing
    console.log('✅ Creo nuovo briefing');
    const result = await createBriefing(tomorrow, tomorrowEnd, dateStr);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('💥 Error in manual briefing:', error);
    return NextResponse.json({ 
      error: error.message,
      details: error.stack || 'Errore sconosciuto'
    }, { status: 500 });
  }
}

async function sendPushNotifications(title: string, message: string, data: any, tag: string) {
  try {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/notifications/send-push`;
    
    console.log('🔔 Invio notifiche push a:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, data, tag })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Notifiche inviate:', result);
      return result;
    } else {
      const errorText = await response.text();
      console.error('⚠️ Errore invio notifiche:', errorText);
      throw new Error(errorText);
    }
  } catch (error) {
    console.error('⚠️ Errore invio notifiche (non bloccante):', error);
    throw error;
  }
}

async function createBriefing(tomorrow: Date, tomorrowEnd: Date, dateStr: string) {
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, booking_date, time_slot, num_passengers, customer_id, boat_id, service_id, skipper_id, booking_status_id')
    .gte('booking_date', tomorrow.toISOString())
    .lte('booking_date', tomorrowEnd.toISOString())
    .order('time_slot', { ascending: true });

  if (bookingsError) {
    console.error('❌ Error fetching bookings:', bookingsError);
    throw new Error(`Errore caricamento prenotazioni: ${bookingsError.message}`);
  }

  console.log(`📦 Trovate ${bookings?.length || 0} prenotazioni totali`);

  const { data: validStatuses, error: statusError } = await supabase
    .from('booking_statuses')
    .select('id, code')
    .in('code', ['confirmed', 'pending']);

  if (statusError) {
    console.error('❌ Error fetching statuses:', statusError);
    throw new Error(`Errore caricamento status: ${statusError.message}`);
  }

  const validStatusIds = validStatuses?.map(s => s.id) || [];
  console.log('✅ Status validi:', validStatusIds);

  const filteredBookings = bookings?.filter(b => b.booking_status_id && validStatusIds.includes(b.booking_status_id)) || [];
  console.log(`✅ Prenotazioni filtrate (confirmed/pending): ${filteredBookings.length}`);

  const enrichedBookings = await Promise.all(
    filteredBookings.map(async (booking) => {
      const [customer, boat, service, skipper, status] = await Promise.all([
        booking.customer_id ? supabase.from('customers').select('first_name, last_name, phone').eq('id', booking.customer_id).single() : Promise.resolve({ data: null }),
        booking.boat_id ? supabase.from('boats').select('name').eq('id', booking.boat_id).single() : Promise.resolve({ data: null }),
        booking.service_id ? supabase.from('rental_services').select('name').eq('id', booking.service_id).single() : Promise.resolve({ data: null }),
        booking.skipper_id ? supabase.from('skippers').select('first_name, last_name, phone').eq('id', booking.skipper_id).single() : Promise.resolve({ data: null }),
        booking.booking_status_id ? supabase.from('booking_statuses').select('name, code').eq('id', booking.booking_status_id).single() : Promise.resolve({ data: null })
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

  console.log(`✅ Prenotazioni arricchite: ${enrichedBookings.length}`);
  console.log(`👥 Totale passeggeri: ${totalPassengers}`);

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
    throw new Error(`Errore creazione briefing: ${insertError.message}`);
  }

  console.log('✅ Briefing creato con successo:', briefing.id);

  // Invia notifiche push
  try {
    const dateFormatted = new Date(dateStr).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    await sendPushNotifications(
      '📋 Nuovo Promemoria Operativo',
      `Disponibile il promemoria per ${dateFormatted}. ${enrichedBookings.length} prenotazioni, ${totalPassengers} passeggeri.`,
      {
        type: 'briefing',
        briefingId: briefing.id,
        url: '/',
        date: dateStr
      },
      `briefing-${dateStr}`
    );
  } catch (notifyError) {
    // Non bloccare l'operazione se notifiche falliscono
    console.error('⚠️ Notifiche fallite ma briefing creato');
  }

  return {
    success: true,
    message: 'Briefing creato con successo!',
    briefing: {
      id: briefing.id,
      date: briefing.date,
      bookings_count: briefing.bookings_count,
      total_passengers: briefing.total_passengers
    }
  };
}

async function updateBriefing(briefingId: string, tomorrow: Date, tomorrowEnd: Date, dateStr: string) {
  console.log('🔄 AGGIORNAMENTO BRIEFING:', { briefingId, dateStr });
  
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, booking_date, time_slot, num_passengers, customer_id, boat_id, service_id, skipper_id, booking_status_id')
    .gte('booking_date', tomorrow.toISOString())
    .lte('booking_date', tomorrowEnd.toISOString())
    .order('booking_date', { ascending: true });

  if (bookingsError) {
    console.error('❌ Error fetching bookings (UPDATE):', bookingsError);
    throw new Error(`Errore caricamento prenotazioni: ${bookingsError.message}`);
  }

  const { data: validStatuses, error: statusError } = await supabase
    .from('booking_statuses')
    .select('id, code')
    .in('code', ['confirmed', 'pending']);

  if (statusError) {
    console.error('❌ Error fetching statuses (UPDATE):', statusError);
    throw new Error(`Errore caricamento status: ${statusError.message}`);
  }

  const validStatusIds = validStatuses?.map(s => s.id) || [];
  console.log('✅ Status validi (UPDATE):', validStatusIds);
  console.log(`📦 Trovate ${bookings?.length || 0} prenotazioni totali (UPDATE)`);
  
  const filteredBookings = bookings?.filter(b => b.booking_status_id && validStatusIds.includes(b.booking_status_id)) || [];
  console.log(`✅ Prenotazioni filtrate (UPDATE - confirmed/pending): ${filteredBookings.length}`);

  const enrichedBookings = await Promise.all(
    filteredBookings.map(async (booking) => {
      const [customer, boat, service, skipper, status] = await Promise.all([
        booking.customer_id ? supabase.from('customers').select('first_name, last_name, phone').eq('id', booking.customer_id).single() : Promise.resolve({ data: null }),
        booking.boat_id ? supabase.from('boats').select('name').eq('id', booking.boat_id).single() : Promise.resolve({ data: null }),
        booking.service_id ? supabase.from('rental_services').select('name').eq('id', booking.service_id).single() : Promise.resolve({ data: null }),
        booking.skipper_id ? supabase.from('skippers').select('first_name, last_name, phone').eq('id', booking.skipper_id).single() : Promise.resolve({ data: null }),
        booking.booking_status_id ? supabase.from('booking_statuses').select('name, code').eq('id', booking.booking_status_id).single() : Promise.resolve({ data: null })
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

  console.log(`✅ Prenotazioni arricchite (UPDATE): ${enrichedBookings.length}`);
  console.log(`👥 Totale passeggeri (UPDATE): ${totalPassengers}`);

  // Reset conferme
  const { error: deleteConfirmationsError } = await supabase
    .from('briefing_confirmations')
    .delete()
    .eq('briefing_id', briefingId);

  if (deleteConfirmationsError) {
    console.error('⚠️ Errore cancellazione conferme:', deleteConfirmationsError);
  } else {
    console.log('🔄 Conferme resettate - tutti gli utenti devono riconfermare');
  }

  // Aggiorna briefing
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
    throw new Error(`Errore aggiornamento briefing: ${updateError.message}`);
  }

  console.log('✅ Briefing aggiornato:', briefingId);

  // Invia notifiche push
  try {
    const dateFormatted = new Date(dateStr).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    await sendPushNotifications(
      '🔄 Promemoria Aggiornato - Riconferma Obbligatoria',
      `AGGIORNATO il promemoria per ${dateFormatted}. ${enrichedBookings.length} prenotazioni, ${totalPassengers} passeggeri. È necessaria una nuova conferma di lettura.`,
      {
        type: 'briefing_updated',
        briefingId: briefingId,
        url: '/',
        date: dateStr,
        requiresConfirmation: true
      },
      `briefing-${dateStr}-update-${Date.now()}`
    );
  } catch (notifyError) {
    console.error('⚠️ Notifiche fallite ma briefing aggiornato');
  }

  return {
    success: true,
    message: 'Briefing aggiornato con successo!',
    briefing: {
      id: briefingId,
      date: dateStr,
      bookings_count: enrichedBookings.length,
      total_passengers: totalPassengers
    }
  };
}