// app/api/settlements/[id]/route.ts
//
// API per singolo batch settlement
//
// GET    /api/settlements/[id]           → Dettaglio batch + prenotazioni incluse
// PUT    /api/settlements/[id]           → Marca come 'paid' o aggiorna invoice
// DELETE /api/settlements/[id]           → Annulla batch (riporta prenotazioni a 'pending')

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── GET: Dettaglio batch + prenotazioni ─────────────────────────
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const settlementId = params.id

    // Batch
    const { data: settlement, error } = await supabase
      .from('partner_settlements')
      .select(`
        *,
        supplier:suppliers(id, name, commission_percentage)
      `)
      .eq('id', settlementId)
      .single()

    if (error || !settlement) {
      return NextResponse.json({ error: 'Batch non trovato' }, { status: 404 })
    }

    // Prenotazioni del batch
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id, booking_number, booking_date, final_price, 
        supplier_commission_percentage, supplier_commission_amount, 
        settlement_status, source,
        customer:customers(first_name, last_name, email),
        boat:boats(name)
      `)
      .eq('settlement_batch_id', settlementId)
      .order('booking_date', { ascending: true })

    if (bookingsError) throw bookingsError

    return NextResponse.json({
      settlement,
      bookings: bookings || [],
    })
  } catch (error: any) {
    console.error('❌ [settlements/id] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── PUT: Aggiorna stato/dati batch ──────────────────────────────
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const settlementId = params.id
    const body = await request.json()
    const { 
      action,
      invoice_number,
      invoice_date,
      payment_reference,
      paid_at,
      notes,
    } = body

    // Carica batch corrente
    const { data: current, error: fetchError } = await supabase
      .from('partner_settlements')
      .select('*')
      .eq('id', settlementId)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Batch non trovato' }, { status: 404 })
    }

    if (action === 'mark_paid') {
      // Segna batch come pagato
      const paymentDate = paid_at || new Date().toISOString()

      // Aggiorna batch
      const { data: updated, error: updateError } = await supabase
        .from('partner_settlements')
        .update({
          status: 'paid',
          paid_at: paymentDate,
          payment_reference: payment_reference || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settlementId)
        .select()
        .single()

      if (updateError) throw updateError

      // Aggiorna prenotazioni del batch: passa a 'settled'
      const { error: bookingsError } = await supabase
        .from('bookings')
        .update({
          settlement_status: 'settled',
          settlement_paid_at: paymentDate,
        })
        .eq('settlement_batch_id', settlementId)

      if (bookingsError) throw bookingsError

      console.log(`✅ [settlements/id] Batch ${settlementId} marcato come pagato`)

      return NextResponse.json({
        success: true,
        settlement: updated,
        message: 'Batch e prenotazioni segnate come pagate',
      })

    } else if (action === 'update_invoice') {
      // Aggiorna dati fattura (senza cambiare status)
      const newStatus = invoice_number && current.status === 'draft' ? 'invoiced' : current.status

      const { data: updated, error: updateError } = await supabase
        .from('partner_settlements')
        .update({
          invoice_number: invoice_number || null,
          invoice_date: invoice_date || null,
          notes: notes !== undefined ? notes : current.notes,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settlementId)
        .select()
        .single()

      if (updateError) throw updateError

      return NextResponse.json({
        success: true,
        settlement: updated,
      })

    } else {
      return NextResponse.json({ error: 'Azione non valida. Usa "mark_paid" o "update_invoice".' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('❌ [settlements/id] PUT error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── DELETE: Annulla batch ───────────────────────────────────────
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const settlementId = params.id

    const { data: current, error: fetchError } = await supabase
      .from('partner_settlements')
      .select('id, status, bookings_count')
      .eq('id', settlementId)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Batch non trovato' }, { status: 404 })
    }

    // Non si può cancellare un batch già pagato
    if (current.status === 'paid') {
      return NextResponse.json(
        { error: 'Impossibile cancellare un batch già pagato' },
        { status: 400 }
      )
    }

    // Riporta le prenotazioni a 'pending' e scollega dal batch
    const { error: bookingsError } = await supabase
      .from('bookings')
      .update({
        settlement_status: 'pending',
        settlement_batch_id: null,
      })
      .eq('settlement_batch_id', settlementId)

    if (bookingsError) throw bookingsError

    // Cancella il batch
    const { error: deleteError } = await supabase
      .from('partner_settlements')
      .delete()
      .eq('id', settlementId)

    if (deleteError) throw deleteError

    console.log(`✅ [settlements/id] Batch ${settlementId} annullato (${current.bookings_count} prenotazioni riportate a pending)`)

    return NextResponse.json({
      success: true,
      message: `Batch annullato. ${current.bookings_count} prenotazioni riportate in attesa.`,
    })
  } catch (error: any) {
    console.error('❌ [settlements/id] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}