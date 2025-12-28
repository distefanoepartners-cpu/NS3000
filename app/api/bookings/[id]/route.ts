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
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('[Bookings API] GET error:', error)
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 })
    }

    // Carica relazioni separatamente
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
    console.error('[Bookings API] Error fetching booking:', error)
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

    // Campi opzionali - aggiorna solo se presenti e non vuoti
    if (body.customer_id && body.customer_id !== '') {
      updateData.customer_id = body.customer_id
    }
    if (body.boat_id && body.boat_id !== '') {
      updateData.boat_id = body.boat_id
    }
    if (body.service_id && body.service_id !== '') {
      updateData.service_id = body.service_id
    }
    if (body.time_slot_id && body.time_slot_id !== '') {
      updateData.time_slot_id = body.time_slot_id
    }
    if (body.booking_status_id && body.booking_status_id !== '') {
      updateData.booking_status_id = body.booking_status_id
    }
    if (body.payment_method_id && body.payment_method_id !== '') {
      updateData.payment_method_id = body.payment_method_id
    }
    if (body.security_deposit !== undefined) {
      updateData.security_deposit = body.security_deposit
    }

    console.log('[Bookings API] Updating booking:', params.id, updateData)

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) {
      console.error('[Bookings API] Update error:', error)
      throw error
    }

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
    console.error('[Bookings API] Error updating booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina prenotazione
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Bookings API] Deleting booking:', params.id)

    // Prima verifica che la prenotazione esista
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('id', params.id)
      .single()

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 })
    }

    // Elimina la prenotazione
    const { error } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('[Bookings API] Delete error:', error)
      
      // Se è un errore di foreign key, dai un messaggio chiaro
      if (error.code === '23503') {
        return NextResponse.json({ 
          error: 'Impossibile eliminare: la prenotazione è referenziata in altre tabelle' 
        }, { status: 400 })
      }
      
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Bookings API] Error deleting booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}