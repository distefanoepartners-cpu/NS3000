import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista prenotazioni
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name, boat_type, rental_price_high_season, rental_price_mid_season, rental_price_low_season, charter_price_high_season, charter_price_mid_season, charter_price_low_season),
        service:services(id, name, type),
        time_slot:time_slots(id, name, start_time, end_time),
        booking_status:booking_statuses(id, name, code),
        payment_method:payment_methods(id, name, code)
      `)
      .order('booking_date', { ascending: false })

    if (start && end) {
      query = query.gte('booking_date', start).lte('booking_date', end)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea nuova prenotazione
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Genera booking number
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

    // Campi opzionali - aggiungi solo se presenti
    if (body.time_slot_id) insertData.time_slot_id = body.time_slot_id
    if (body.booking_status_id) insertData.booking_status_id = body.booking_status_id
    if (body.payment_method_id) insertData.payment_method_id = body.payment_method_id
    if (body.security_deposit) insertData.security_deposit = body.security_deposit

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert(insertData)
      .select(`
        *,
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name, boat_type),
        service:services(id, name, type),
        time_slot:time_slots(id, name, start_time, end_time),
        booking_status:booking_statuses(id, name, code),
        payment_method:payment_methods(id, name, code)
      `)
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      throw error
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error creating booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}