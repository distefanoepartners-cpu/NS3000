import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

/**
 * API Esterna - Disponibilità Barche NS3000
 * 
 * Endpoint: GET /api/external/availability
 * Auth: API Key via header X-API-Key
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
    const date = searchParams.get('date')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const boatId = searchParams.get('boat_id')
    const timeSlot = searchParams.get('time_slot')

    if (!date && !dateFrom) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Parametro "date" o "date_from" richiesto' },
        { status: 400 }
      )
    }

    const startDate = date || dateFrom!
    const endDate = date || dateTo || dateFrom!

    // 2. Recupera tutte le barche attive con prezzi
    let boatsQuery = supabaseAdmin
      .from('boats')
      .select(`
        id, name, boat_type, max_passengers, length_meters,
        has_rental, has_charter, has_collective, requires_license, can_go_capri,
        is_active, image_url,
        price_rental_apr_may_oct_half_day, price_rental_apr_may_oct_full_day,
        price_rental_june_half_day, price_rental_june_full_day,
        price_rental_july_sept_half_day, price_rental_july_sept_full_day,
        price_rental_august_half_day, price_rental_august_full_day,
        price_charter_apr_may_oct_half_day, price_charter_apr_may_oct_full_day,
        price_charter_june_half_day, price_charter_june_full_day,
        price_charter_july_sept_half_day, price_charter_july_sept_full_day,
        price_charter_august_half_day, price_charter_august_full_day
      `)
      .eq('is_active', true)
      .order('name')

    if (boatId) {
      boatsQuery = boatsQuery.eq('id', boatId)
    }

    const { data: boats, error: boatsError } = await boatsQuery

    if (boatsError) throw boatsError
    if (!boats || boats.length === 0) {
      return NextResponse.json({ boats: [], period: { from: startDate, to: endDate } })
    }

    const boatIds = boats.map(b => b.id)

    // 3. Recupera prenotazioni nel periodo
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('boat_id, booking_date, time_slot')
      .in('boat_id', boatIds)
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)

    if (bookingsError) throw bookingsError

    // 4. Recupera indisponibilità nel periodo
    const { data: unavailabilities, error: unavailError } = await supabaseAdmin
      .from('unavailabilities')
      .select('boat_id, date_from, date_to, reason')
      .in('boat_id', boatIds)
      .lte('date_from', endDate)
      .gte('date_to', startDate)

    if (unavailError) throw unavailError

    // 5. Genera le date nel range
    const dates: string[] = []
    const current = new Date(startDate)
    const end = new Date(endDate)
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }

    // 6. Costruisci risposta per ogni barca
    const result = boats.map(boat => {
      const availability: Record<string, {
        available: boolean
        slots: { morning: boolean; afternoon: boolean; full_day: boolean }
        reason?: string
      }> = {}

      dates.forEach(d => {
        const isUnavailable = unavailabilities?.some(
          u => u.boat_id === boat.id && u.date_from <= d && u.date_to >= d
        )

        if (isUnavailable) {
          const unavail = unavailabilities?.find(
            u => u.boat_id === boat.id && u.date_from <= d && u.date_to >= d
          )
          availability[d] = {
            available: false,
            slots: { morning: false, afternoon: false, full_day: false },
            reason: unavail?.reason || 'Non disponibile'
          }
          return
        }

        const dayBookings = bookings?.filter(
          b => b.boat_id === boat.id && b.booking_date === d
        ) || []

        const hasFullDay = dayBookings.some(b => b.time_slot === 'full_day')
        const hasMorning = dayBookings.some(b => b.time_slot === 'morning')
        const hasAfternoon = dayBookings.some(b => b.time_slot === 'afternoon')

        const morningFree = !hasFullDay && !hasMorning
        const afternoonFree = !hasFullDay && !hasAfternoon
        const fullDayFree = !hasFullDay && !hasMorning && !hasAfternoon

        availability[d] = {
          available: morningFree || afternoonFree,
          slots: {
            morning: morningFree,
            afternoon: afternoonFree,
            full_day: fullDayFree
          }
        }
      })

      if (timeSlot) {
        Object.keys(availability).forEach(d => {
          const slot = availability[d].slots
          if (timeSlot === 'morning') {
            availability[d].available = slot.morning
          } else if (timeSlot === 'afternoon') {
            availability[d].available = slot.afternoon
          } else if (timeSlot === 'full_day') {
            availability[d].available = slot.full_day
          }
        })
      }

      return {
        boat_id: boat.id,
        name: boat.name,
        boat_type: boat.boat_type,
        max_passengers: boat.max_passengers,
        length_meters: boat.length_meters,
        has_rental: boat.has_rental,
        has_charter: boat.has_charter,
        has_collective: boat.has_collective,
        requires_license: boat.requires_license,
        can_go_capri: boat.can_go_capri,
        image_url: boat.image_url,
        availability,
        pricing: {
          rental: {
            apr_may_oct: { half_day: boat.price_rental_apr_may_oct_half_day, full_day: boat.price_rental_apr_may_oct_full_day },
            june: { half_day: boat.price_rental_june_half_day, full_day: boat.price_rental_june_full_day },
            july_sept: { half_day: boat.price_rental_july_sept_half_day, full_day: boat.price_rental_july_sept_full_day },
            august: { half_day: boat.price_rental_august_half_day, full_day: boat.price_rental_august_full_day },
          },
          charter: {
            apr_may_oct: { half_day: boat.price_charter_apr_may_oct_half_day, full_day: boat.price_charter_apr_may_oct_full_day },
            june: { half_day: boat.price_charter_june_half_day, full_day: boat.price_charter_june_full_day },
            july_sept: { half_day: boat.price_charter_july_sept_half_day, full_day: boat.price_charter_july_sept_full_day },
            august: { half_day: boat.price_charter_august_half_day, full_day: boat.price_charter_august_full_day },
          }
        }
      }
    })

    return NextResponse.json({
      boats: result,
      period: { from: startDate, to: endDate },
      generated_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('NS3000 API External Availability Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Errore nel recupero disponibilità' },
      { status: 500 }
    )
  }
}