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

    console.log('📋 Creazione briefing manuale per:', dateStr);

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

    // Ottieni prenotazioni
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(first_name, last_name, phone),
        boat:boats(name),
        service:rental_services(name),
        skipper:skippers(first_name, last_name, phone),
        booking_status:booking_statuses(name, code)
      `)
      .gte('booking_date', tomorrow.toISOString())
      .lte('booking_date', tomorrowEnd.toISOString())
      .in('booking_status.code', ['confirmed', 'pending'])
      .order('booking_date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching bookings:', error);
      throw error;
    }

    const totalPassengers = bookings?.reduce(
      (sum, b) => sum + (b.num_passengers || 0), 
      0
    ) || 0;

    console.log(`✅ Trovate ${bookings?.length || 0} prenotazioni per ${dateStr}`);

    // Crea briefing
    const { data: briefing, error: insertError } = await supabase
      .from('daily_briefings')
      .insert({
        date: dateStr,
        bookings_count: bookings?.length || 0,
        total_passengers: totalPassengers,
        content: bookings || []
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
      details: 'Controlla la console per maggiori dettagli'
    }, { status: 500 });
  }
}