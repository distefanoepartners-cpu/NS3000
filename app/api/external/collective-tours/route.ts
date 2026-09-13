import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

/**
 * API Esterna - Tour Collettivi NS3000
 *
 * Endpoint: GET /api/external/collective-tours
 * Auth: API Key via header X-API-Key
 *
 * Parametri:
 *   ?date=2026-07-15           → singolo giorno
 *   ?start=2026-07-01&end=2026-07-31 → range date
 *
 * Risposta compatibile con /api/collective-tours/capacity (interno)
 * per permettere al backoffice Blu Alliance di consumare i dati.
 */

function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('X-API-Key')
  const validKey = process.env.NS3000_EXTERNAL_API_KEY
  if (!validKey) {
    console.error('NS3000 API: NS3000_EXTERNAL_API_KEY non configurata!')
    return false
  }
  return apiKey === validKey
}

export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'API Key mancante o non valida' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const singleDate = searchParams.get('date')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const dateFrom = singleDate || start || new Date().toISOString().split('T')[0]
    const dateTo = singleDate || end || dateFrom

    // 1. Servizi collettivi attivi
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

    const serviceIds = collectiveServices.map(s => s.id)

    // 2. Barche associate ai servizi collettivi
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

    // 3. Prenotazioni collettive nel range (non cancellate)
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
        booking_source,
        notes,
        customer:customers(id, first_name, last_name, email, phone),
        booking_status:booking_statuses(id, name, code),
        boat:boats(id, name, max_passengers)
      `)
      .in('service_id', serviceIds)
      .gte('booking_date', dateFrom)
      .lte('booking_date', dateTo)
     .not('booking_status.code', 'in', '("cancelled","cancelled_final")')
      .order('booking_date')
      .order('created_at')

    if (bookingsError) throw bookingsError

    // 4. Barche coinvolte
    const allBoatIds = [...new Set(
      (boatServiceLinks || [])
        .filter(l => l.boats && (l.boats as any).is_active === true)
        .map(l => l.boat_id)
    )]

    // 4a. Indisponibilità nel range
    let unavailabilities: any[] = []
    if (allBoatIds.length > 0) {
      const { data: unavailData } = await supabaseAdmin
        .from('boat_unavailabilities')
        .select('boat_id, date_from, date_to, reason')
        .in('boat_id', allBoatIds)
        .lte('date_from', dateTo)
        .gte('date_to', dateFrom)
      unavailabilities = unavailData || []
    }

    // 4b. Prenotazioni NON collettive (blocco reciproco)
    let otherBookings: any[] = []
    if (allBoatIds.length > 0) {
      const { data: otherBookingsData } = await supabaseAdmin
        .from('bookings')
        .select('boat_id, booking_date, service_id, booking_status:booking_statuses(code)')
        .in('boat_id', allBoatIds)
        .gte('booking_date', dateFrom)
        .lte('booking_date', dateTo)
        .not('booking_status.code', 'in', '("cancelled","cancelled_final")')
      otherBookings = otherBookingsData || []
    }

    // Mappa barche occupate da servizi non collettivi
    const boatsOccupiedByOthers: Record<string, Set<string>> = {}
    for (const ob of otherBookings) {
      if (serviceIds.includes(ob.service_id)) continue
      if (!boatsOccupiedByOthers[ob.booking_date]) {
        boatsOccupiedByOthers[ob.booking_date] = new Set()
      }
      boatsOccupiedByOthers[ob.booking_date].add(ob.boat_id)
    }

    // 5. Genera date nel range
    const dates: string[] = []
    const current = new Date(dateFrom)
    const endDate = new Date(dateTo)
    while (current <= endDate) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }

    // 6. Costruisci risposta per ogni data × servizio
    const result: any[] = []

    for (const dateStr of dates) {
      for (const service of collectiveServices) {
        // Barche del servizio (attive)
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
          .sort((a, b) => a.capacity - b.capacity)

        const occupiedByOthers = boatsOccupiedByOthers[dateStr] || new Set()

        // Barche disponibili (non in manutenzione, non occupate da altri)
        const availableBoats = serviceBoats.filter(boat => {
          const isUnavailable = unavailabilities.some(u =>
            u.boat_id === boat.id &&
            dateStr >= u.date_from &&
            dateStr <= u.date_to
          )
          if (isUnavailable) return false
          if (occupiedByOthers.has(boat.id)) return false
          return true
        })

        const excludedBoats = serviceBoats.filter(
          boat => !availableBoats.find(ab => ab.id === boat.id)
        )

        // Prenotazioni collettive per questo servizio+data
        const dayBookings = (bookings || []).filter(b =>
          b.service_id === service.id &&
          b.booking_date === dateStr
        )

        // Riempimento progressivo barche
        const boatsWithOccupancy = []
        let remainingBookings = [...dayBookings]

        for (const boat of availableBoats) {
          const assignedToThis = remainingBookings.filter(b => b.boat_id === boat.id)
          const unassigned = remainingBookings.filter(b => !b.boat_id)

          const assignedPax = assignedToThis.reduce((s, b) => s + (b.num_passengers || 0), 0)
          const remaining = Math.max(0, boat.capacity - assignedPax)

          let filledFromUnassigned = 0
          const unassignedForBoat: any[] = []
          for (const bk of unassigned) {
            if (filledFromUnassigned + (bk.num_passengers || 0) <= remaining) {
              filledFromUnassigned += bk.num_passengers || 0
              unassignedForBoat.push(bk)
            }
          }

          const usedIds = new Set([
            ...assignedToThis.map(b => b.id),
            ...unassignedForBoat.map(b => b.id),
          ])
          remainingBookings = remainingBookings.filter(b => !usedIds.has(b.id))

          const totalPax = assignedPax + filledFromUnassigned
          const allForBoat = [...assignedToThis, ...unassignedForBoat]

          boatsWithOccupancy.push({
            boat_id: boat.id,
            boat_name: boat.name,
            capacity: boat.capacity,
            passengers_booked: totalPax,
            passengers_available: Math.max(0, boat.capacity - totalPax),
            occupancy_percent: boat.capacity > 0 ? Math.round((totalPax / boat.capacity) * 100) : 0,
            is_full: totalPax >= boat.capacity,
            bookings: allForBoat.map(b => ({
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
              notes: b.notes,
            }))
          })
        }

        const overflowBookings = remainingBookings.map(b => ({
          id: b.id,
          booking_number: b.booking_number,
          num_passengers: b.num_passengers,
          customer_name: b.customer
            ? `${(b.customer as any).first_name} ${(b.customer as any).last_name}`
            : 'N/D',
          customer_phone: (b.customer as any)?.phone || '',
          final_price: b.final_price,
          status: (b.booking_status as any)?.code || 'pending',
          status_name: (b.booking_status as any)?.name || 'In Attesa',
          booking_source: b.booking_source,
          boat_assigned: false,
          notes: b.notes,
        }))

        const totalCapacity = availableBoats.reduce((s, b) => s + b.capacity, 0)
        const totalBooked = dayBookings.reduce((s, b) => s + (b.num_passengers || 0), 0)

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
          excluded_boats: excludedBoats.map(boat => {
            const isUnavail = unavailabilities.some(u =>
              u.boat_id === boat.id && dateStr >= u.date_from && dateStr <= u.date_to
            )
            return {
              boat_id: boat.id,
              boat_name: boat.name,
              capacity: boat.capacity,
              reason: isUnavail ? 'unavailable' : occupiedByOthers.has(boat.id) ? 'booked_other_service' : 'unknown',
              reason_label: isUnavail ? 'Indisponibile' : occupiedByOthers.has(boat.id) ? 'Prenotata per altro servizio' : 'Non disponibile',
            }
          }),
          overflow_bookings: overflowBookings,
          total_revenue: dayBookings.reduce((s, b) => s + (b.final_price || 0), 0),
          num_bookings: dayBookings.length,
        })
      }
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('NS3000 External Collective Tours Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}