import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Security check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. Calcola domani
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const dateStr = tomorrow.toISOString().split('T')[0];

    // 2. Verifica se esiste già
    const { data: existing } = await supabase
      .from('daily_briefings')
      .select('id')
      .eq('date', dateStr)
      .single();

    if (existing) {
      console.log('Briefing already exists for', dateStr);
      return NextResponse.json({ 
        message: 'Briefing already exists',
        id: existing.id 
      });
    }

    // 3. Ottieni prenotazioni di domani
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
      console.error('Error fetching bookings:', error);
      throw error;
    }

    const totalPassengers = bookings?.reduce(
      (sum, b) => sum + (b.num_passengers || 0), 
      0
    ) || 0;

    console.log(`Found ${bookings?.length || 0} bookings for ${dateStr}`);

    // 4. Crea briefing
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
      console.error('Error creating briefing:', insertError);
      throw insertError;
    }

    console.log('✅ Briefing created:', briefing.id);

    // 5. Opzionale: Invia notifica push (se hai già il sistema notifiche)
    // Questo triggerera il modal quando gli utenti aprono l'app
    
    return NextResponse.json({ 
      success: true,
      briefing: {
        id: briefing.id,
        date: briefing.date,
        bookings_count: briefing.bookings_count,
        total_passengers: briefing.total_passengers
      }
    });

  } catch (error: any) {
    console.error('Briefing creation error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}