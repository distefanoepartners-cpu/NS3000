// app/api/collective-tours/capacity/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

/**
 * GET /api/collective-tours/capacity?date=2026-07-15
 * oppure
 * GET /api/collective-tours/capacity?start=2026-07-01&end=2026-07-31
 * 
 * Restituisce per ogni tour collettivo attivo:
 * - Barche assegnabili (con capienza)
 * - Prenotazioni già effettuate per quel giorno
 * - Riempimento progressivo barca per barca
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const singleDate = searchParams.get('date')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    // Determina range date
    const dateFrom = singleDate || start || new Date().toISOString().split('T')[0]
    const dateTo = singleDate || end || dateFrom

    // 1. Carica tutti i servizi collettivi attivi
    const { data: collectiveServices, error: servicesError } = await supabaseAdmin
      .from('rental_services')
      .select('id, name, service_type, price_per_person, duration, description')
      .eq('service_type', 'collective')
      .eq('is_active', true)
      .order('name')

    if (servicesError) throw servicesError
    if (!collectiveServices || collectiveServices.length === 0) {
      return NextResponse.json([])
    }

    // 2. Per ogni servizio collettivo, carica le barche associate via boat_rental_services
    const serviceIds = collectiveServices.map(s => s.id)

    const { data: boatServiceLinks, error: linksError } = await supabaseAdmin
      .from('boat_rental_services')
      .select(`
        service_id,
        boat_id,
        is_active,
        boats(id, name, max_passengers, is_active)
      `)
      .in('service_id', serviceIds)
      .eq('is_active', true)

    if (linksError) throw linksError

    // 3. Carica prenotazioni collettive nel range di date (solo non cancellate)
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        booking_number,
        booking_date,
        service_id,
        boat_id,
        num_passengers,
        final_price,
        deposit_amount,
        balance_amount,
        booking_type,
        notes,
        booking_source,
        customer:customers(id, first_name, last_name, email, phone),
        booking_status:booking_statuses(id, name, code),
        boat:boats(id, name, max_passengers)
      `)
      .in('service_id', serviceIds)
      .gte('booking_date', dateFrom)
      .lte('booking_date', dateTo)
      .not('booking_status.code', 'eq', 'cancelled')
      .order('booking_date')
      .order('created_at')

    if (bookingsError) throw bookingsError

    // 4. Carica indisponibilità barche nel range
    // Estrai tutti i boat_id coinvolti (solo barche attive)
    const allBoatIds = [...new Set(
      (boatServiceLinks || [])
        .filter(l => l.boats && (l.boats as any).is_active === true)
        .map(l => l.boat_id)
    )]

    let unavailabilities: any[] | null = null
    if (allBoatIds.length > 0) {
      const { data: unavailData, error: unavailError } = await supabaseAdmin
        .from('boat_unavailabilities')
        .select('boat_id, date_from, date_to, reason')
        .in('boat_id', allBoatIds)
        .lte('date_from', dateTo)
        .gte('date_to', dateFrom)

      if (unavailError) {
        console.warn('Nota: boat_unavailabilities query fallita, continuo senza:', unavailError.message)
      } else {
        unavailabilities = unavailData
      }
    }

    // 4b. ⭐ CRITICO: Carica prenotazioni NON collettive (locazione, tour privati, charter)
    // sulle stesse barche nel range date.
    // Una barca già prenotata per locazione/tour privato NON è disponibile per i collettivi.
    // I tour collettivi occupano sempre full_day, quindi qualsiasi prenotazione sulla barca
    // (morning, afternoon, evening, full_day) la rende indisponibile.
    let otherBookings: any[] | null = null
    if (allBoatIds.length > 0) {
      const { data: otherBookingsData, error: otherBookingsError } = await supabaseAdmin
        .from('bookings')
        .select('boat_id, booking_date, time_slot, service_id, booking_status:booking_statuses(code)')
        .in('boat_id', allBoatIds)
        .gte('booking_date', dateFrom)
        .lte('booking_date', dateTo)
        .not('booking_status.code', 'eq', 'cancelled')

      if (otherBookingsError) {
        console.warn('Nota: query prenotazioni non-collettive fallita:', otherBookingsError.message)
      } else {
        otherBookings = otherBookingsData
      }
    }

    // Mappa: { "YYYY-MM-DD": Set<boat_id> } per barche occupate da servizi non collettivi
    const boatsOccupiedByOtherServices: Record<string, Set<string>> = {}
    if (otherBookings) {
      for (const ob of otherBookings) {
        // Ignora le prenotazioni che SONO collettive (stesso service_id dei nostri tour)
        if (serviceIds.includes(ob.service_id)) continue
        // Se la barca ha una qualsiasi prenotazione non-collettiva per quel giorno, è occupata
        if (!boatsOccupiedByOtherServices[ob.booking_date]) {
          boatsOccupiedByOtherServices[ob.booking_date] = new Set()
        }
        boatsOccupiedByOtherServices[ob.booking_date].add(ob.boat_id)
      }
    }

    // 5. Costruisci la risposta strutturata
    const result: any[] = []

    // Genera array di date nel range
    const dates: string[] = []
    const current = new Date(dateFrom)
    const endDate = new Date(dateTo)
    while (current <= endDate) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }

    for (const dateStr of dates) {
      for (const service of collectiveServices) {
        // Barche associate a questo servizio (attive)
        const serviceBoats = (boatServiceLinks || [])
          .filter(l => 
            l.service_id === service.id && 
            l.boats && 
            (l.boats as any).is_active === true
          )
          .map(l => ({
            id: (l.boats as any).id,
            name: (l.boats as any).name,
            capacity: (l.boats as any).max_passengers || 0,
          }))
          // Ordina per capienza crescente (riempi prima le più piccole)
          .sort((a, b) => a.capacity - b.capacity)

        // ⭐ Barche occupate da altri servizi per questa data
        const occupiedByOthers = boatsOccupiedByOtherServices[dateStr] || new Set()

        // Filtra barche indisponibili per questa data
        const availableBoats = serviceBoats.filter(boat => {
          const isUnavailable = (unavailabilities || []).some(u =>
            u.boat_id === boat.id &&
            dateStr >= u.date_from &&
            dateStr <= u.date_to
          )
          if (isUnavailable) return false
          if (occupiedByOthers.has(boat.id)) return false
          return true
        })

        // Barche escluse (per info nel frontend)
        const excludedBoats = serviceBoats.filter(boat => !availableBoats.find(ab => ab.id === boat.id))

        // Prenotazioni per questo servizio+data
        const dayBookings = (bookings || []).filter(b =>
          b.service_id === service.id &&
          b.booking_date === dateStr
        )

        // Calcola riempimento progressivo
        const boatsWithOccupancy = []
        let remainingBookings = [...dayBookings]

        for (const boat of availableBoats) {
          // Prenotazioni già assegnate a questa barca specifica
          const assignedToThis = remainingBookings.filter(b => b.boat_id === boat.id)
          // Prenotazioni senza barca assegnata (da distribuire)
          const unassigned = remainingBookings.filter(b => !b.boat_id || b.boat_id === null)

          const assignedPassengers = assignedToThis.reduce((sum, b) => sum + (b.num_passengers || 0), 0)
          
          const remainingCapacity = Math.max(0, boat.capacity - assignedPassengers)
          let filledFromUnassigned = 0
          const unassignedForThisBoat: any[] = []

          for (const booking of unassigned) {
            if (filledFromUnassigned + (booking.num_passengers || 0) <= remainingCapacity) {
              filledFromUnassigned += booking.num_passengers || 0
              unassignedForThisBoat.push(booking)
            }
          }

          const usedBookingIds = new Set([
            ...assignedToThis.map(b => b.id),
            ...unassignedForThisBoat.map(b => b.id)
          ])
          remainingBookings = remainingBookings.filter(b => !usedBookingIds.has(b.id))

          const totalPassengers = assignedPassengers + filledFromUnassigned
          const allBookingsForBoat = [...assignedToThis, ...unassignedForThisBoat]

          boatsWithOccupancy.push({
            boat_id: boat.id,
            boat_name: boat.name,
            capacity: boat.capacity,
            passengers_booked: totalPassengers,
            passengers_available: Math.max(0, boat.capacity - totalPassengers),
            occupancy_percent: boat.capacity > 0 ? Math.round((totalPassengers / boat.capacity) * 100) : 0,
            is_full: totalPassengers >= boat.capacity,
            bookings: allBookingsForBoat.map(b => ({
              id: b.id,
              booking_number: b.booking_number,
              num_passengers: b.num_passengers,
              customer_name: b.customer
                ? `${(b.customer as any).first_name} ${(b.customer as any).last_name}`
                : 'N/D',
              customer_phone: (b.customer as any)?.phone || '',
              customer_email: (b.customer as any)?.email || '',
              final_price: b.final_price,
              deposit_amount: b.deposit_amount,
              balance_amount: b.balance_amount,
              status: (b.booking_status as any)?.code || 'pending',
              status_name: (b.booking_status as any)?.name || 'In Attesa',
              booking_source: b.booking_source,
              boat_assigned: !!b.boat_id,
              notes: b.notes
            }))
          })
        }

        // Prenotazioni rimaste senza barca (overflow)
        const overflowBookings = remainingBookings.map(b => ({
          id: b.id,
          booking_number: b.booking_number,
          num_passengers: b.num_passengers,
          customer_name: b.customer
            ? `${(b.customer as any).first_name} ${(b.customer as any).last_name}`
            : 'N/D',
          customer_phone: (b.customer as any)?.phone || '',
          customer_email: (b.customer as any)?.email || '',
          final_price: b.final_price,
          status: (b.booking_status as any)?.code || 'pending',
          status_name: (b.booking_status as any)?.name || 'In Attesa',
          booking_source: b.booking_source,
          boat_assigned: false,
          notes: b.notes
        }))

        const totalCapacity = availableBoats.reduce((sum, b) => sum + b.capacity, 0)
        const totalBooked = dayBookings.reduce((sum, b) => sum + (b.num_passengers || 0), 0)

        result.push({
          date: dateStr,
          service_id: service.id,
          service_name: service.name,
          price_per_person: service.price_per_person,
          total_capacity: totalCapacity,
          total_booked: totalBooked,
          total_available: Math.max(0, totalCapacity - totalBooked),
          num_boats_available: availableBoats.length,
          num_boats_total: serviceBoats.length,
          boats: boatsWithOccupancy,
          overflow_bookings: overflowBookings,
          excluded_boats: excludedBoats.map(boat => {
            const isUnavail = (unavailabilities || []).some(u =>
              u.boat_id === boat.id && dateStr >= u.date_from && dateStr <= u.date_to
            )
            const occupiedByOthersSet = boatsOccupiedByOtherServices[dateStr] || new Set()
            return {
              boat_id: boat.id,
              boat_name: boat.name,
              capacity: boat.capacity,
              reason: isUnavail ? 'unavailable' : occupiedByOthersSet.has(boat.id) ? 'booked_other_service' : 'unknown',
              reason_label: isUnavail ? 'Indisponibile' : occupiedByOthersSet.has(boat.id) ? 'Prenotata per altro servizio' : 'Non disponibile'
            }
          }),
          total_revenue: dayBookings.reduce((sum, b) => sum + (b.final_price || 0), 0),
          num_bookings: dayBookings.length,
        })
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching collective tour capacity:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}