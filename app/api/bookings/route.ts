import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista prenotazioni
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const boat_id = searchParams.get('boat_id')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    let query = supabaseAdmin
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: true }) // Dalla più vicina alla più lontana
      .order('created_at', { ascending: false })

    // Filtri opzionali
    if (boat_id) {
      query = query.eq('boat_id', boat_id)
    }
    if (start && end) {
      query = query
        .gte('booking_date', start)
        .lte('booking_date', end)
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

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_id: body.customer_id,
        boat_id: body.boat_id,
        service_id: body.service_id,
        service_type: body.service_type || 'rental',
        booking_date: body.booking_date,
        time_slot: body.time_slot || null,
        num_passengers: body.num_passengers || 1,
        base_price: body.base_price || 0,
        final_price: body.final_price || 0,
        deposit_amount: body.deposit_amount || 0,
        balance_amount: body.balance_amount || 0,
        deposit_payment_method_id: body.deposit_payment_method_id || null,
        balance_payment_method_id: body.balance_payment_method_id || null,
        booking_status_id: body.booking_status_id || null,
        notes: body.notes || null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error creating booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}