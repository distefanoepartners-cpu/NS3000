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
      .select('*')
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
        deposit_payment_method_id: body.deposit_payment_method_id || null,
        balance_payment_method_id: body.balance_payment_method_id || null,
        booking_status_id: body.booking_status_id,
        notes: body.notes
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