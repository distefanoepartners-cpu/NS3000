import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Planning settimanale disponibilità
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate e endDate richiesti' }, { status: 400 })
    }

    // Ottieni tutte le barche attive
    const { data: boats, error: boatsError } = await supabaseAdmin
      .from('boats')
      .select('id, name, boat_type')
      .eq('is_active', true)
      .order('name')

    if (boatsError) throw boatsError

    // Ottieni slot orari
    const { data: slots, error: slotsError } = await supabaseAdmin
      .from('time_slots')
      .select('*')
      .eq('is_active', true)
      .order('start_time')

    if (slotsError) throw slotsError

    // Ottieni tutte le prenotazioni nel range con stati che bloccano
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(first_name, last_name),
        service:services(name),
        booking_status:booking_statuses(name, code, color_code, blocks_availability)
      `)
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)

    if (bookingsError) throw bookingsError

    // Ottieni indisponibilità barche
    const { data: unavailability, error: unavailError } = await supabaseAdmin
      .from('boat_unavailability')
      .select('*')
      .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`)

    if (unavailError) throw unavailError

    return NextResponse.json({
      boats: boats || [],
      slots: slots || [],
      bookings: bookings || [],
      unavailability: unavailability || []
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}