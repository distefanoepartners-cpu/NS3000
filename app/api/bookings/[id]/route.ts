import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Recupera singola prenotazione
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Prima ottieni il booking base
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (bookingError) throw bookingError

    // Poi carica le relazioni separatamente (solo se non sono null)
    const relations: any = {}

    if (booking.customer_id) {
      const { data } = await supabaseAdmin.from('customers').select('id, first_name, last_name, email, phone').eq('id', booking.customer_id).single()
      relations.customer = data
    }

    if (booking.boat_id) {
      const { data } = await supabaseAdmin.from('boats').select('id, name, boat_type').eq('id', booking.boat_id).single()
      relations.boat = data
    }

    if (booking.service_id) {
      const { data } = await supabaseAdmin.from('services').select('id, name, type').eq('id', booking.service_id).single()
      relations.service = data
    }

    if (booking.supplier_id) {
      const { data } = await supabaseAdmin.from('suppliers').select('id, name').eq('id', booking.supplier_id).single()
      relations.supplier = data
    }

    if (booking.port_id) {
      const { data } = await supabaseAdmin.from('ports').select('id, name, code').eq('id', booking.port_id).single()
      relations.port = data
    }

    if (booking.time_slot_id) {
      const { data } = await supabaseAdmin.from('time_slots').select('id, name, start_time, end_time').eq('id', booking.time_slot_id).single()
      relations.time_slot = data
    }

    if (booking.booking_status_id) {
      const { data } = await supabaseAdmin.from('booking_statuses').select('id, name, code, color_code').eq('id', booking.booking_status_id).single()
      relations.booking_status = data
    }

    return NextResponse.json({ ...booking, ...relations })
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
    
    // DEBUG: Log del payload ricevuto
    console.log('PUT /api/bookings/[id] - Body received:', JSON.stringify(body, null, 2))

    const payload = {
      customer_id: body.customer_id,
      boat_id: body.boat_id,
      service_id: body.service_id,
      service_type: body.service_type || 'rental',
      supplier_id: body.supplier_id && body.supplier_id !== '' ? body.supplier_id : null,
      port_id: body.port_id,
      time_slot_id: body.time_slot_id,
      custom_time: body.custom_time || null,
      booking_status_id: body.booking_status_id,
      booking_date: body.booking_date,
      num_passengers: body.num_passengers ? parseInt(body.num_passengers) : null,
      base_price: body.base_price ? parseFloat(body.base_price) : 0,
      final_price: body.final_price ? parseFloat(body.final_price) : 0,
      deposit_amount: body.deposit_amount ? parseFloat(body.deposit_amount) : 0,
      balance_amount: body.balance_amount ? parseFloat(body.balance_amount) : 0,
      security_deposit: body.security_deposit ? parseFloat(body.security_deposit) : 0,
      payment_method_id: body.payment_method_id && body.payment_method_id !== '' ? body.payment_method_id : null,
      total_paid: body.total_paid ? parseFloat(body.total_paid) : 0,
      notes: body.notes || null
    }
    
    // DEBUG: Log del payload processato
    console.log('PUT /api/bookings/[id] - Payload to DB:', JSON.stringify(payload, null, 2))

    const { error } = await supabaseAdmin
      .from('bookings')
      .update(payload)
      .eq('id', params.id)

    if (error) {
      console.error('Supabase UPDATE error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: payload
      })
      throw error
    }
    
    return NextResponse.json({ success: true, id: params.id })
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