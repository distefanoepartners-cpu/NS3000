import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Singola prenotazione
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        boat:boats(*),
        service:services(*),
        supplier:suppliers(*),
        port:ports(*),
        time_slot:time_slots(*),
        booking_status:booking_statuses(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Aggiorna prenotazione
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        customer_id: body.customer_id,
        boat_id: body.boat_id,
        service_id: body.service_id,
        supplier_id: body.supplier_id,
        port_id: body.port_id,
        time_slot_id: body.time_slot_id,
        custom_time: body.custom_time,
        booking_status_id: body.booking_status_id,
        booking_date: body.booking_date,
        num_passengers: body.num_passengers,
        base_price: body.base_price,
        final_price: body.final_price,
        deposit_amount: body.deposit_amount,
        balance_amount: body.balance_amount,
        security_deposit: body.security_deposit,
        notes: body.notes
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina prenotazione
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { error } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}