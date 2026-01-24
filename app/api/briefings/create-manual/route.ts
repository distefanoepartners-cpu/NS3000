import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // Ottieni data dal body (opzionale)
    const body = await request.json().catch(() => ({}));
    const targetDate = body.date ? new Date(body.date) : null;

    // Calcola domani (o usa data fornita)
    const tomorrow = targetDate || new Date();
    if (!targetDate) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    tomorrow.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const dateStr = tomorrow.toISOString().split('T')[0];

    console.log('📋 Creazione briefing per:', dateStr);

    // Verifica se esiste già
    const { data: existing } = await supabase
      .from('daily_briefings')
      .select('id')
      .eq('date', dateStr)
      .single();

    if (existing) {
      console.log('⚠️ Briefing già esistente per', dateStr);
      return NextResponse.json({ 
        message: 'Briefing already exists for this date',
        id: existing.id,
        date: dateStr
      });
    }

    // STEP 1: Ottieni gli ID degli status validi
    const { data: validStatuses } = await supabase
      .from('booking_statuses')
      .select('id, code')
      .in('code', ['confirmed', 'pending']);

    const validStatusIds = validStatuses?.map(s => s.id) || [];
    
    console.log('✅ Status validi:', validStatusIds);

    if (validStatusIds.length === 0) {
      console.warn('⚠️ Nessuno status valido trovato');
    }

    // STEP 2: Ottieni prenotazioni filtrate per status_id
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
      .gte('booking_date', tomorrow.toISOString())
      .lte('booking_date', tomorrowEnd.toISOString())
      .in('status_id', validStatusIds)
      .order('booking_date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching bookings:', error);
      throw error;
    }

    console.log(`📦 Trovate ${bookings?.length || 0} prenotazioni grezze`);

    // STEP 3: Arricchisci con i dati delle relazioni
    const enrichedBookings = await Promise.all(
      (bookings || []).map(async (booking) => {
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

    const totalPassengers = enrichedBookings.reduce(
      (sum, b) => sum + (b.num_passengers || 0), 
      0
    );

    console.log(`✅ ${enrichedBookings.length} prenotazioni arricchite per ${dateStr}`);
    console.log(`👥 Totale passeggeri: ${totalPassengers}`);

    // STEP 4: Crea briefing
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

    console.log('✅ Briefing creato con successo:', briefing.id);

    return NextResponse.json({ 
      success: true,
      message: 'Briefing creato con successo!',
      briefing: {
        id: briefing.id,
        date: briefing.date,
        bookings_count: briefing.bookings_count,
        total_passengers: briefing.total_passengers
      }
    });

  } catch (error: any) {
    console.error('❌ Briefing creation error:', error);
    return NextResponse.json({ 
      error: error.message,
      details: error.stack || 'Controlla la console per maggiori dettagli'
    }, { status: 500 });
  }
}