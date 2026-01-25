import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Questo endpoint viene chiamato da Vercel Cron alle 07:00
export async function GET(request: Request) {
  try {
    // Verifica autorizzazione cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕖 07:00 Cron - Reminder briefing di oggi');

    // Oggi
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const dateStr = today.toISOString().split('T')[0];

    console.log('📅 Target date:', dateStr);

    // Verifica se esiste briefing per oggi
    const { data: existing } = await supabase
      .from('daily_briefings')
      .select('id')
      .eq('date', dateStr)
      .single();

    if (!existing) {
      console.log('⚠️ Nessun briefing per oggi, lo creo ora');
      
      // Crea briefing per oggi
      const result = await createBriefing(today, todayEnd, dateStr);
      return NextResponse.json(result);
    }

    // Briefing esiste già, lo aggiorno con dati freschi
    console.log('✅ Briefing esiste, lo aggiorno con dati freschi');
    const result = await updateBriefing(existing.id, today, todayEnd, dateStr);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('💥 Error in 07:00 cron:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

async function createBriefing(today: Date, todayEnd: Date, dateStr: string) {
  // Ottieni prenotazioni di oggi
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
      status_id
    `)
    .gte('booking_date', today.toISOString())
    .lte('booking_date', todayEnd.toISOString())
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
  const filteredBookings = bookings?.filter(b => validStatusIds.includes(b.status_id)) || [];

  console.log(`📦 Trovate ${filteredBookings.length} prenotazioni per oggi`);

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
        booking.status_id
          ? supabase.from('booking_statuses').select('name, code').eq('id', booking.status_id).single()
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

  console.log('✅ Briefing creato per oggi:', briefing.id);

  return {
    success: true,
    message: '✅ Reminder inviato (07:00)',
    briefing: {
      id: briefing.id,
      date: briefing.date,
      bookings_count: briefing.bookings_count,
      total_passengers: briefing.total_passengers
    }
  };
}

async function updateBriefing(briefingId: string, today: Date, todayEnd: Date, dateStr: string) {
  // Aggiorna con dati freschi
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_date, time_slot, num_passengers, customer_id, boat_id, service_id, skipper_id, status_id')
    .gte('booking_date', today.toISOString())
    .lte('booking_date', todayEnd.toISOString())
    .order('booking_date', { ascending: true });

  const { data: validStatuses } = await supabase
    .from('booking_statuses')
    .select('id')
    .in('code', ['confirmed', 'pending']);

  const validStatusIds = validStatuses?.map(s => s.id) || [];
  const filteredBookings = bookings?.filter(b => validStatusIds.includes(b.status_id)) || [];

  const enrichedBookings = await Promise.all(
    filteredBookings.map(async (booking) => {
      const [customer, boat, service, skipper, status] = await Promise.all([
        booking.customer_id ? supabase.from('customers').select('first_name, last_name, phone').eq('id', booking.customer_id).single() : null,
        booking.boat_id ? supabase.from('boats').select('name').eq('id', booking.boat_id).single() : null,
        booking.service_id ? supabase.from('rental_services').select('name').eq('id', booking.service_id).single() : null,
        booking.skipper_id ? supabase.from('skippers').select('first_name, last_name, phone').eq('id', booking.skipper_id).single() : null,
        booking.status_id ? supabase.from('booking_statuses').select('name, code').eq('id', booking.status_id).single() : null
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
    throw updateError;
  }

  console.log('✅ Briefing aggiornato per oggi:', briefingId);

  return {
    success: true,
    message: '✅ Reminder aggiornato (07:00)',
    briefing: {
      id: briefingId,
      date: dateStr,
      bookings_count: enrichedBookings.length,
      total_passengers: totalPassengers
    }
  };
}