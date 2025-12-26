import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista tutte le prenotazioni
export async function GET() {
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
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Errore caricamento prenotazioni:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea nuova prenotazione
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Genera numero prenotazione
    const date = new Date()
    const booking_number = `BK-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${Date.now().toString().slice(-6)}`

    const payload = {
      booking_number,
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

    // Se è Full Day, verifica disponibilità
    if (body._is_full_day) {
      const { data: existing } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('boat_id', body.boat_id)
        .eq('booking_date', body.booking_date)
        .neq('booking_status_id', (await supabaseAdmin.from('booking_statuses').select('id').eq('code', 'cancelled').single()).data?.id)

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: 'Barca già prenotata per questa data' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Errore creazione prenotazione:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}