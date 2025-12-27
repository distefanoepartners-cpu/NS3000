import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista prenotazioni
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    console.log('[Bookings API] Fetching bookings with params:', { start, end })

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customers!customer_id(id, first_name, last_name, email, phone),
        boats!boat_id(id, name, boat_type, rental_price_high_season, rental_price_mid_season, rental_price_low_season, charter_price_high_season, charter_price_mid_season, charter_price_low_season),
        services!service_id(id, name, type),
        time_slots!time_slot_id(id, name, start_time, end_time),
        booking_statuses!booking_status_id(id, name, code),
        payment_methods!payment_method_id(id, name, code)
      `)
      .order('booking_date', { ascending: false })

    if (start && end) {
      query = query.gte('booking_date', start).lte('booking_date', end)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Bookings API] Supabase error:', error)
      return NextResponse.json([])
    }

    console.log('[Bookings API] Found bookings:', data?.length || 0)

    // Rinomina i campi per compatibilità con il frontend
    const bookings = (data || []).map((booking: any) => ({
      ...booking,
      customer: booking.customers,
      boat: booking.boats,
      service: booking.services,
      time_slot: booking.time_slots,
      booking_status: booking.booking_statuses,
      payment_method: booking.payment_methods
    }))
    
    return NextResponse.json(bookings)
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
      .select(`
        *,
        customers!customer_id(id, first_name, last_name, email, phone),
        boats!boat_id(id, name, boat_type),
        services!service_id(id, name, type),
        time_slots!time_slot_id(id, name, start_time, end_time),
        booking_statuses!booking_status_id(id, name, code),
        payment_methods!payment_method_id(id, name, code)
      `)
      .single()

    if (error) {
      console.error('[Bookings API] Insert error:', error)
      throw error
    }

    console.log('[Bookings API] Booking created:', data.id)

    // Rinomina campi
    const booking = {
      ...data,
      customer: data.customers,
      boat: data.boats,
      service: data.services,
      time_slot: data.time_slots,
      booking_status: data.booking_statuses,
      payment_method: data.payment_methods
    }

    return NextResponse.json(booking)
  } catch (error: any) {
    console.error('[Bookings API] Error creating booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}