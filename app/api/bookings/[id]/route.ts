import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name, boat_type),
        service:services(id, name, type),
        supplier:suppliers(id, name),
        port:ports(id, name, code),
        time_slot:time_slots(id, name, start_time, end_time),
        booking_status:booking_statuses(id, name, code, color_code)
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
      .update(body)
      .eq('id', id)
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