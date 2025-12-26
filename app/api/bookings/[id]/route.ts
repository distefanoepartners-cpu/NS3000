import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Recupera singola prenotazione
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
        boat:boats(id, name, boat_type),
        service:services(id, name, type),
        supplier:suppliers(id, name),
        port:ports(id, name, code),
        time_slot:time_slots(id, name, start_time, end_time),
        booking_status:booking_statuses(id, name, code, color_code)
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore caricamento prenotazione:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Aggiorna prenotazione completa
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const payload = {
      customer_id: body.customer_id,
      boat_id: body.boat_id,
      service_id: body.service_id,
      service_type: body.service_type || 'rental',
      supplier_id: body.supplier_id || null,
      port_id: body.port_id,
      time_slot_id: body.time_slot_id,
      custom_time: body.custom_time || null,
      booking_status_id: body.booking_status_id,
      booking_date: body.booking_date,
      num_passengers: body.num_passengers || null,
      base_price: body.base_price || 0,
      final_price: body.final_price || 0,
      deposit_amount: body.deposit_amount || 0,
      balance_amount: body.balance_amount || 0,
      security_deposit: body.security_deposit || 0,
      payment_method_id: body.payment_method_id && body.payment_method_id !== '' ? body.payment_method_id : null,
      total_paid: body.total_paid || 0,
      notes: body.notes || null
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(payload)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore aggiornamento prenotazione:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Aggiorna solo alcuni campi
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore aggiornamento parziale prenotazione:', error)
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
    console.error('Errore eliminazione prenotazione:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}