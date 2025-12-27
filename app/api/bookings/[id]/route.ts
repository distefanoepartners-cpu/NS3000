import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Singola prenotazione
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
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
      .eq('id', params.id)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Aggiorna prenotazione
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const updateData: any = {
      booking_date: body.booking_date,
      num_passengers: body.num_passengers || 1,
      base_price: body.base_price || 0,
      final_price: body.final_price || 0,
      deposit_amount: body.deposit_amount || 0,
      balance_amount: body.balance_amount || 0,
      notes: body.notes || null,
      service_type: body.service_type || 'rental'
    }

    // Campi opzionali - aggiorna solo se presenti
    if (body.customer_id) updateData.customer_id = body.customer_id
    if (body.boat_id) updateData.boat_id = body.boat_id
    if (body.service_id) updateData.service_id = body.service_id
    if (body.time_slot_id) updateData.time_slot_id = body.time_slot_id
    if (body.booking_status_id) updateData.booking_status_id = body.booking_status_id
    if (body.payment_method_id) updateData.payment_method_id = body.payment_method_id
    if (body.security_deposit !== undefined) updateData.security_deposit = body.security_deposit

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
      .eq('id', params.id)
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
      console.error('Supabase update error:', error)
      throw error
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina prenotazione
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}