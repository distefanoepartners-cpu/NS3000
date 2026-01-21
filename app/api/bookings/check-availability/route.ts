import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function POST(request: Request) {
  try {
    const { boat_id, booking_date, booking_id, time_slot } = await request.json()

    if (!boat_id || !booking_date) {
      return NextResponse.json({ 
        available: false, 
        reason: 'Parametri mancanti' 
      }, { status: 400 })
    }

    // 1. Controlla se c'è già una prenotazione per quella barca/data
    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('id, booking_number, booking_status_id, time_slot')
      .eq('boat_id', boat_id)
      .eq('booking_date', booking_date)

    // Se stiamo modificando, escludi la prenotazione corrente
    if (booking_id) {
      bookingsQuery = bookingsQuery.neq('id', booking_id)
    }

    const { data: existingBookings, error: bookingError } = await bookingsQuery

    if (bookingError) throw bookingError

    // Controlla se ci sono prenotazioni attive (non cancellate/annullate)
    const activeBookings = existingBookings?.filter((b: any) => {
      // Considera tutte le prenotazioni come attive
      // Migliora con logica stati se necessario
      return true
    })

    if (activeBookings && activeBookings.length > 0) {
      // LOGICA FASCE ORARIE
      const hasFullDay = activeBookings.some((b: any) => b.time_slot === 'full_day')
      const hasMorning = activeBookings.some((b: any) => b.time_slot === 'morning')
      const hasAfternoon = activeBookings.some((b: any) => b.time_slot === 'afternoon')
      
      // Se c'è full day → sempre occupato
      if (hasFullDay) {
        return NextResponse.json({
          available: false,
          reason: `Barca già prenotata full day per questa data`
        })
      }
      
      // Se voglio prenotare full day ma c'è già qualcosa → occupato
      if (time_slot === 'full_day' && (hasMorning || hasAfternoon)) {
        return NextResponse.json({
          available: false,
          reason: `Barca già prenotata per mezza giornata`
        })
      }
      
      // Se voglio prenotare mattina ma c'è già mattina → occupato
      if (time_slot === 'morning' && hasMorning) {
        return NextResponse.json({
          available: false,
          reason: `Mattina già prenotata per questa data`
        })
      }
      
      // Se voglio prenotare pomeriggio ma c'è già pomeriggio → occupato
      if (time_slot === 'afternoon' && hasAfternoon) {
        return NextResponse.json({
          available: false,
          reason: `Pomeriggio già prenotato per questa data`
        })
      }
      
      // Se voglio prenotare mattina e c'è solo pomeriggio → OK!
      // Se voglio prenotare pomeriggio e c'è solo mattina → OK!
      // Se time_slot è personalizzato (custom) → OK (non controlliamo conflitti)
    }

    // 2. Controlla se c'è un'indisponibilità
    const { data: unavailabilities, error: unavailError } = await supabaseAdmin
      .from('unavailabilities')
      .select('id, reason')
      .eq('boat_id', boat_id)
      .lte('date_from', booking_date)
      .gte('date_to', booking_date)

    if (unavailError) throw unavailError

    if (unavailabilities && unavailabilities.length > 0) {
      return NextResponse.json({
        available: false,
        reason: `Barca non disponibile: ${unavailabilities[0].reason || 'Manutenzione'}`
      })
    }

    // Tutto OK!
    return NextResponse.json({
      available: true
    })

  } catch (error: any) {
    console.error('Error checking availability:', error)
    return NextResponse.json({ 
      available: false, 
      reason: 'Errore controllo disponibilità' 
    }, { status: 500 })
  }
}