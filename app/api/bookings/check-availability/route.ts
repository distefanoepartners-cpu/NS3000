import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function POST(request: Request) {
  try {
    const { 
      boat_id, 
      booking_date, 
      booking_end_date, 
      booking_id, 
      time_slot,
      is_collective,
      service_id,
      num_passengers
    } = await request.json()

    const requestedPax = parseInt(num_passengers) || 1

    if (!boat_id || !booking_date) {
      return NextResponse.json({ 
        available: false, 
        reason: 'Parametri mancanti' 
      }, { status: 400 })
    }

    const startDate = booking_date
    const endDate = booking_end_date || booking_date

    // Carica statuses attivi (per filtro)
    const { data: activeStatuses } = await supabaseAdmin
      .from('booking_statuses')
      .select('id, code')
      .in('code', ['pending', 'confirmed', 'option', 'in_progress'])

    const activeStatusIds = (activeStatuses || []).map(s => s.id)

    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('id, booking_number, booking_status_id, time_slot, booking_date, booking_end_date, num_days, num_passengers, service_type, booking_type, service_id')
      .eq('boat_id', boat_id)

    if (booking_id) {
      bookingsQuery = bookingsQuery.neq('id', booking_id)
    }

    if (activeStatusIds.length > 0) {
      bookingsQuery = bookingsQuery.in('booking_status_id', activeStatusIds)
    }

    const { data: existingBookings, error: bookingError } = await bookingsQuery

    if (bookingError) throw bookingError

    // Filtra prenotazioni che si sovrappongono al range richiesto
    const overlappingBookings = existingBookings?.filter((b: any) => {
      const existStart = b.booking_date
      const existEnd = b.booking_end_date || b.booking_date
      return existStart <= endDate && existEnd >= startDate
    }) || []

    // ⭐ FIX 2026-04-30: Helper per identificare prenotazione collettiva
    const isBookingCollective = (b: any) => 
      b.booking_type === 'collective' || b.service_type === 'collective'

    if (overlappingBookings.length > 0) {
      const isSingleDay = startDate === endDate
      
      // ═══════════════════════════════════════════════════════════════════
      // ⭐ CASE 1: La nuova prenotazione è un COLLETTIVO
      // ═══════════════════════════════════════════════════════════════════
      if (is_collective && isSingleDay && service_id) {
        // Trova capienza max in collective_tour_boats
        const { data: ctb } = await supabaseAdmin
          .from('collective_tour_boats')
          .select('max_passengers')
          .eq('boat_id', boat_id)
          .eq('service_id', service_id)
          .eq('is_active', true)
          .maybeSingle()

        if (!ctb) {
          return NextResponse.json({
            available: false,
            reason: 'Questa barca non è abilitata per questo tour collettivo'
          })
        }

        const maxPax = ctb.max_passengers

        // Filtra prenotazioni collettive nello stesso slot/data/servizio
        const sameSlotCollective = overlappingBookings.filter((b: any) =>
          isBookingCollective(b) &&
          b.service_id === service_id &&
          b.time_slot === time_slot &&
          b.booking_date === startDate
        )

        // Verifica conflitto con prenotazioni NON collettive sullo stesso slot
        const sameSlotNonCollective = overlappingBookings.filter((b: any) =>
          !isBookingCollective(b) &&
          (b.time_slot === time_slot || b.time_slot === 'full_day' || time_slot === 'full_day')
        )

        if (sameSlotNonCollective.length > 0) {
          return NextResponse.json({
            available: false,
            reason: `Barca già prenotata per altro servizio (${sameSlotNonCollective[0].booking_number})`
          })
        }

        // Verifica conflitto con altri tour collettivi (diverso service_id)
        const otherCollective = overlappingBookings.filter((b: any) =>
          isBookingCollective(b) &&
          b.service_id !== service_id &&
          b.time_slot === time_slot
        )

        if (otherCollective.length > 0) {
          return NextResponse.json({
            available: false,
            reason: `Barca già impegnata in altro tour collettivo`
          })
        }

        // OK collettivo: somma pax e verifica capienza
        const usedPax = sameSlotCollective.reduce((sum, b) => sum + (b.num_passengers || 0), 0)
        const remaining = maxPax - usedPax

    if (remaining <= 0) {
          return NextResponse.json({
            available: false,
            reason: `Tour collettivo pieno (${usedPax}/${maxPax} pax)`
          })
        }

        // ⭐ Verifica che i pax richiesti rientrino nei posti residui
        if (requestedPax > remaining) {
          return NextResponse.json({
            available: false,
            reason: `Posti insufficienti: richiesti ${requestedPax}, disponibili ${remaining} (${usedPax}/${maxPax} occupati)`
          })
        }

        // ✅ Disponibile per collettivo
        return NextResponse.json({
          available: true,
          collective_remaining: remaining,
          collective_used: usedPax,
          collective_max: maxPax
        })
      }

      // ═══════════════════════════════════════════════════════════════════
      // ⭐ CASE 2: La nuova prenotazione è NON collettiva
      // ⚠️ Verifica conflitti con TUTTE le prenotazioni esistenti
      // (anche collettive, perché bloccano la barca dall'essere usata per altro)
      // ═══════════════════════════════════════════════════════════════════
      if (isSingleDay) {
        const hasFullDay = overlappingBookings.some((b: any) => b.time_slot === 'full_day')
        const hasMorning = overlappingBookings.some((b: any) => b.time_slot === 'morning')
        const hasAfternoon = overlappingBookings.some((b: any) => b.time_slot === 'afternoon')
        const hasMultiDay = overlappingBookings.some((b: any) => (b.num_days || 1) > 1)
        
        if (hasFullDay || hasMultiDay) {
          return NextResponse.json({
            available: false,
            reason: `Barca già prenotata per questa data (${overlappingBookings[0].booking_number})`
          })
        }
        
        if (time_slot === 'full_day' && (hasMorning || hasAfternoon)) {
          return NextResponse.json({
            available: false,
            reason: `Barca già prenotata per mezza giornata`
          })
        }
        
        if (time_slot === 'morning' && hasMorning) {
          return NextResponse.json({
            available: false,
            reason: `Mattina già prenotata per questa data`
          })
        }
        
        if (time_slot === 'afternoon' && hasAfternoon) {
          return NextResponse.json({
            available: false,
            reason: `Pomeriggio già prenotato per questa data`
          })
        }
      } else {
        // Multi-day: qualsiasi sovrapposizione blocca
        const conflictNumbers = overlappingBookings.map((b: any) => b.booking_number).join(', ')
        return NextResponse.json({
          available: false,
          reason: `Barca occupata nel periodo richiesto. Conflitto con: ${conflictNumbers}`
        })
      }
    }

    // 2. Controlla indisponibilità nel range
    const { data: unavailabilities, error: unavailError } = await supabaseAdmin
      .from('unavailabilities')
      .select('id, reason, date_from, date_to')
      .eq('boat_id', boat_id)
      .lte('date_from', endDate)
      .gte('date_to', startDate)

    if (unavailError) throw unavailError

    if (unavailabilities && unavailabilities.length > 0) {
      return NextResponse.json({
        available: false,
        reason: `Barca non disponibile: ${unavailabilities[0].reason || 'Manutenzione'}`
      })
    }

    // 3. Controlla assegnazioni tour collettivi (legacy)
    // ⚠️ Salta questo check se la nuova prenotazione è essa stessa collettiva
    if (!is_collective) {
      const { data: collectiveAssignments } = await supabaseAdmin
        .from('collective_boat_assignments')
        .select('id, service_id, booking_date')
        .eq('boat_id', boat_id)
        .lte('booking_date', endDate)
        .gte('booking_date', startDate)

      if (collectiveAssignments && collectiveAssignments.length > 0) {
        return NextResponse.json({
          available: false,
          reason: 'Barca assegnata a tour collettivo per questa data'
        })
      }
    }

    // Tutto OK!
    return NextResponse.json({ available: true })

  } catch (error: any) {
    console.error('Error checking availability:', error)
    return NextResponse.json({ 
      available: false, 
      reason: 'Errore controllo disponibilità' 
    }, { status: 500 })
  }
}