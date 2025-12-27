import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista prenotazioni
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    console.log('[Bookings API] Fetching bookings with params:', { start, end })

    // Query semplice senza JOIN
    let query = supabaseAdmin
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: false })

    if (start && end) {
      query = query.gte('booking_date', start).lte('booking_date', end)
    }

    const { data: bookings, error } = await query

    if (error) {
      console.error('[Bookings API] Supabase error:', error)
      return NextResponse.json([])
    }

    console.log('[Bookings API] Found bookings:', bookings?.length || 0)

    if (!bookings || bookings.length === 0) {
      return NextResponse.json([])
    }

    // Carica relazioni separatamente
    const customerIds = [...new Set(bookings.map(b => b.customer_id).filter(Boolean))]
    const boatIds = [...new Set(bookings.map(b => b.boat_id).filter(Boolean))]
    const serviceIds = [...new Set(bookings.map(b => b.service_id).filter(Boolean))]
    const timeSlotIds = [...new Set(bookings.map(b => b.time_slot_id).filter(Boolean))]
    const statusIds = [...new Set(bookings.map(b => b.booking_status_id).filter(Boolean))]
    const paymentMethodIds = [...new Set(bookings.map(b => b.payment_method_id).filter(Boolean))]

    // Fetch in parallelo
    const [customers, boats, services, timeSlots, statuses, paymentMethods] = await Promise.all([
      customerIds.length > 0 
        ? supabaseAdmin.from('customers').select('*').in('id', customerIds)
        : { data: [] },
      boatIds.length > 0
        ? supabaseAdmin.from('boats').select('*').in('id', boatIds)
        : { data: [] },
      serviceIds.length > 0
        ? supabaseAdmin.from('services').select('*').in('id', serviceIds)
        : { data: [] },
      timeSlotIds.length > 0
        ? supabaseAdmin.from('time_slots').select('*').in('id', timeSlotIds)
        : { data: [] },
      statusIds.length > 0
        ? supabaseAdmin.from('booking_statuses').select('*').in('id', statusIds)
        : { data: [] },
      paymentMethodIds.length > 0
        ? supabaseAdmin.from('payment_methods').select('*').in('id', paymentMethodIds)
        : { data: [] }
    ])

    // Crea mappe per lookup veloce
    const customerMap = new Map((customers.data || []).map((c: any) => [c.id, c]))
    const boatMap = new Map((boats.data || []).map((b: any) => [b.id, b]))
    const serviceMap = new Map((services.data || []).map((s: any) => [s.id, s]))
    const timeSlotMap = new Map((timeSlots.data || []).map((t: any) => [t.id, t]))
    const statusMap = new Map((statuses.data || []).map((s: any) => [s.id, s]))
    const paymentMethodMap = new Map((paymentMethods.data || []).map((p: any) => [p.id, p]))

    // Combina i dati
    const enrichedBookings = bookings.map((booking: any) => ({
      ...booking,
      customer: customerMap.get(booking.customer_id) || null,
      boat: boatMap.get(booking.boat_id) || null,
      service: serviceMap.get(booking.service_id) || null,
      time_slot: timeSlotMap.get(booking.time_slot_id) || null,
      booking_status: statusMap.get(booking.booking_status_id) || null,
      payment_method: paymentMethodMap.get(booking.payment_method_id) || null
    }))

    console.log('[Bookings API] Enriched bookings:', enrichedBookings.length)
    
    return NextResponse.json(enrichedBookings)
  } catch (error: any) {
    console.error('[Bookings API] Unexpected error:', error)
    return NextResponse.json([])
  }
}

// POST - Crea nuova prenotazione
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('[Bookings API] Creating booking with data:', body)

    const bookingNumber = `BK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    const insertData: any = {
      booking_number: bookingNumber,
      customer_id: body.customer_id,
      boat_id: body.boat_id,
      service_id: body.service_id,
      service_type: body.service_type || 'rental',
      booking_date: body.booking_date,
      num_passengers: body.num_passengers || 1,
      base_price: body.base_price || 0,
      final_price: body.final_price || 0,
      deposit_amount: body.deposit_amount || 0,
      balance_amount: body.balance_amount || 0,
      notes: body.notes || null
    }

    if (body.time_slot_id && body.time_slot_id !== '') {
      insertData.time_slot_id = body.time_slot_id
    }
    if (body.booking_status_id && body.booking_status_id !== '') {
      insertData.booking_status_id = body.booking_status_id
    }
    if (body.payment_method_id && body.payment_method_id !== '') {
      insertData.payment_method_id = body.payment_method_id
    }
    if (body.security_deposit) {
      insertData.security_deposit = body.security_deposit
    }

    console.log('[Bookings API] Insert data:', insertData)

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert(insertData)
      .select('*')
      .single()

    if (error) {
      console.error('[Bookings API] Insert error:', error)
      throw error
    }

    console.log('[Bookings API] Booking created:', data.id)

    // Carica relazioni
    const [customer, boat, service, timeSlot, status, paymentMethod] = await Promise.all([
      data.customer_id 
        ? supabaseAdmin.from('customers').select('*').eq('id', data.customer_id).single()
        : { data: null },
      data.boat_id
        ? supabaseAdmin.from('boats').select('*').eq('id', data.boat_id).single()
        : { data: null },
      data.service_id
        ? supabaseAdmin.from('services').select('*').eq('id', data.service_id).single()
        : { data: null },
      data.time_slot_id
        ? supabaseAdmin.from('time_slots').select('*').eq('id', data.time_slot_id).single()
        : { data: null },
      data.booking_status_id
        ? supabaseAdmin.from('booking_statuses').select('*').eq('id', data.booking_status_id).single()
        : { data: null },
      data.payment_method_id
        ? supabaseAdmin.from('payment_methods').select('*').eq('id', data.payment_method_id).single()
        : { data: null }
    ])

    const enrichedBooking = {
      ...data,
      customer: customer.data,
      boat: boat.data,
      service: service.data,
      time_slot: timeSlot.data,
      booking_status: status.data,
      payment_method: paymentMethod.data
    }

    return NextResponse.json(enrichedBooking)
  } catch (error: any) {
    console.error('[Bookings API] Error creating booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}