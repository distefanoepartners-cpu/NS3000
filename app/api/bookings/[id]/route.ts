import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Singola prenotazione
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        boat:boats(*),
        service:rental_services(*),
        booking_status:booking_statuses(*),
        deposit_payment_method:payment_methods!bookings_deposit_payment_method_id_fkey(*),
        balance_payment_method:payment_methods!bookings_balance_payment_method_id_fkey(*),
        caution_payment_method:payment_methods!bookings_caution_payment_method_id_fkey(*)
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        customer_id: body.customer_id,
        boat_id: body.boat_id,
        service_id: body.service_id,
        service_type: body.service_type,
        booking_date: body.booking_date,
        time_slot: body.time_slot || null,
        num_passengers: body.num_passengers,
        base_price: body.base_price,
        final_price: body.final_price,
        deposit_amount: body.deposit_amount,
        balance_amount: body.balance_amount,
        caution_amount: body.caution_amount || 0,
        deposit_payment_method_id: body.deposit_payment_method_id || null,
        balance_payment_method_id: body.balance_payment_method_id || null,
        caution_payment_method_id: body.caution_payment_method_id || null,
        deposit_payment_date: body.deposit_payment_date || null,
        balance_payment_date: body.balance_payment_date || null,
        booking_status_id: body.booking_status_id,
        notes: body.notes,
        // NUOVI CAMPI v1.4.0+
        payment_type: body.payment_type || 'deposit',
        deposit_percentage: body.deposit_percentage || 30,
        booking_source: body.booking_source || 'online',
        supplier_id: body.supplier_id || null,
        skipper_id: body.skipper_id || null
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina prenotazione
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
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