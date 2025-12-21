import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Dettaglio estratto conto con prenotazioni
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Carica l'estratto conto
    const { data: statement, error: statementError } = await supabaseAdmin
      .from('supplier_statements')
      .select(`
        *,
        supplier:suppliers(name, email, commission_percentage)
      `)
      .eq('id', id)
      .single()

    if (statementError) throw statementError

    // Carica le prenotazioni del periodo
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        booking_number,
        booking_date,
        final_price,
        customer:customers(first_name, last_name),
        service:services(name),
        boat:boats(name),
        booking_status:booking_statuses(name, code)
      `)
      .eq('supplier_id', statement.supplier_id)
      .gte('booking_date', statement.period_start)
      .lte('booking_date', statement.period_end)
      .order('booking_date')

    if (bookingsError) throw bookingsError

    return NextResponse.json({
      statement,
      bookings: bookings || []
    })
  } catch (error: any) {
    console.error('Errore caricamento dettaglio:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Aggiorna estratto conto (rigenera con nuovi parametri)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Carica prenotazioni per il nuovo periodo
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('final_price')
      .eq('supplier_id', body.supplier_id)
      .gte('booking_date', body.period_start)
      .lte('booking_date', body.period_end)

    const total_bookings = bookings?.length || 0
    const total_revenue = bookings?.reduce((sum, b) => sum + (b.final_price || 0), 0) || 0

    // Prendi commission_percentage dal fornitore
    const { data: supplier } = await supabaseAdmin
      .from('suppliers')
      .select('commission_percentage')
      .eq('id', body.supplier_id)
      .single()

    const commission_percentage = supplier?.commission_percentage || 0
    const total_commission = (total_revenue * commission_percentage) / 100

    // Aggiorna l'estratto
    const { data, error } = await supabaseAdmin
      .from('supplier_statements')
      .update({
        supplier_id: body.supplier_id,
        period_start: body.period_start,
        period_end: body.period_end,
        total_bookings,
        total_revenue,
        total_commission
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore aggiornamento estratto:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Aggiorna solo lo stato
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updateData: any = { status: body.status }
    
    if (body.status === 'sent') {
      updateData.sent_at = new Date().toISOString()
    } else if (body.status === 'paid') {
      updateData.paid_at = new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from('supplier_statements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore aggiornamento stato:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina estratto conto
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { error } = await supabaseAdmin
      .from('supplier_statements')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Errore eliminazione:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}