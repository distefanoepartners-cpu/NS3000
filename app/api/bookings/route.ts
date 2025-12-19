import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Lista tutte le prenotazioni
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name, boat_type),
        service:services(id, name, type),
        supplier:suppliers(id, name),
        port:ports(id, name, code),
        time_slot:time_slots(id, name, start_time, end_time),
        booking_status:booking_statuses(id, name, code, color_code)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea nuova prenotazione
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Estrai e rimuovi il metadata _is_full_day
    const isFullDay = body._is_full_day
    delete body._is_full_day

    // Verifica disponibilità
    let slotsToCheck = [body.time_slot_id]
    
    if (isFullDay) {
      const { data: allSlots } = await supabaseAdmin
        .from('time_slots')
        .select('id, name')
        .in('name', ['Mattina', 'Pomeriggio'])

      if (allSlots) {
        slotsToCheck = allSlots.map(s => s.id)
      }
    }

    // Verifica disponibilità per tutti gli slot necessari
for (const slotId of slotsToCheck) {
  const { data: existing } = await supabaseAdmin
    .from('bookings')
    .select(`
      id,
      booking_status:booking_statuses!inner(blocks_availability)
    `)
    .eq('boat_id', body.boat_id)
    .eq('booking_date', body.booking_date)
    .eq('time_slot_id', slotId)
    .maybeSingle()

  // Cast tramite unknown per risolvere il tipo
  const status = existing?.booking_status as unknown as { blocks_availability: boolean } | null
  
  if (existing && status?.blocks_availability) {
    return NextResponse.json(
      { error: 'Barca non disponibile per questo slot/data' },
      { status: 409 }
    )
  }
}

    // Se è Full Day, crea 2 prenotazioni (Mattina + Pomeriggio)
    if (isFullDay) {
      const { data: morningAfternoonSlots } = await supabaseAdmin
        .from('time_slots')
        .select('*')
        .in('name', ['Mattina', 'Pomeriggio'])
        .order('start_time')

      if (!morningAfternoonSlots || morningAfternoonSlots.length !== 2) {
        return NextResponse.json(
          { error: 'Slot Mattina/Pomeriggio non configurati correttamente' },
          { status: 400 }
        )
      }

      const bookings = []

      for (const slot of morningAfternoonSlots) {
        const bookingData = {
          ...body,
          time_slot_id: slot.id,
          notes: body.notes ? `${body.notes} [Full Day]` : '[Full Day]'
        }

        const { data: booking, error } = await supabaseAdmin
          .from('bookings')
          .insert([bookingData])
          .select()
          .single()

        if (error) throw error
        bookings.push(booking)
      }

      return NextResponse.json({
        success: true,
        bookings,
        message: 'Prenotazione Full Day creata (Mattina + Pomeriggio)'
      }, { status: 201 })
    } else {
      // Prenotazione singola slot
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .insert([body])
        .select()
        .single()

      if (error) throw error

      return NextResponse.json(data, { status: 201 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}