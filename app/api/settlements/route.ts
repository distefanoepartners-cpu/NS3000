// app/api/settlements/route.ts
//
// API per gestione batch settlement partner (Blu Alliance, Salerno Tourist Hub, ecc.)
//
// GET  /api/settlements                → Lista batch (filtri opzionali: supplier_id, status, year)
// POST /api/settlements                → Crea nuovo batch (raggruppa N prenotazioni 'pending')

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── GET: Lista batch settlement ─────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplier_id')
    const status = searchParams.get('status')
    const year = searchParams.get('year')

    let query = supabase
      .from('partner_settlements')
      .select(`
        *,
        supplier:suppliers(id, name, commission_percentage)
      `)
      .order('period_end', { ascending: false })

    if (supplierId) query = query.eq('supplier_id', supplierId)
    if (status) query = query.eq('status', status)
    if (year) {
      query = query
        .gte('period_start', `${year}-01-01`)
        .lte('period_end', `${year}-12-31`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ settlements: data || [] })
  } catch (error: any) {
    console.error('❌ [settlements] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── POST: Crea nuovo batch settlement ───────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      supplier_id, 
      period_start, 
      period_end, 
      booking_ids,
      notes,
      created_by_name,
    } = body

    // Validazioni
    if (!supplier_id) {
      return NextResponse.json({ error: 'supplier_id obbligatorio' }, { status: 400 })
    }
    if (!period_start || !period_end) {
      return NextResponse.json({ error: 'periodo obbligatorio' }, { status: 400 })
    }
    if (!booking_ids || !Array.isArray(booking_ids) || booking_ids.length === 0) {
      return NextResponse.json({ error: 'Almeno una prenotazione richiesta' }, { status: 400 })
    }

    // Carica prenotazioni e verifica che siano tutte 'pending' del supplier giusto
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, booking_number, supplier_id, settlement_status, final_price, supplier_commission_percentage, supplier_commission_amount')
      .in('id', booking_ids)

    if (bookingsError) throw bookingsError
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ error: 'Nessuna prenotazione trovata' }, { status: 404 })
    }

    // Verifica integrità
    for (const b of bookings) {
      if (b.supplier_id !== supplier_id) {
        return NextResponse.json(
          { error: `Prenotazione ${b.booking_number} non appartiene a questo partner` },
          { status: 400 }
        )
      }
      if (b.settlement_status !== 'pending') {
        return NextResponse.json(
          { error: `Prenotazione ${b.booking_number} non è in stato 'pending' (stato attuale: ${b.settlement_status})` },
          { status: 400 }
        )
      }
    }

    // Calcola totali
    const totalGross = bookings.reduce((sum, b) => sum + (parseFloat(String(b.final_price)) || 0), 0)
    const totalCommission = bookings.reduce((sum, b) => sum + (parseFloat(String(b.supplier_commission_amount)) || 0), 0)
    const totalNet = totalGross - totalCommission

    // Crea batch
    const { data: newBatch, error: insertError } = await supabase
      .from('partner_settlements')
      .insert({
        supplier_id,
        period_start,
        period_end,
        total_gross: totalGross.toFixed(2),
        total_commission: totalCommission.toFixed(2),
        total_net: totalNet.toFixed(2),
        bookings_count: bookings.length,
        status: 'draft',
        notes: notes || null,
        created_by_name: created_by_name || null,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Aggiorna prenotazioni: passa a 'reported', collega al batch
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        settlement_status: 'reported',
        settlement_batch_id: newBatch.id,
      })
      .in('id', booking_ids)

    if (updateError) {
      // Rollback: cancella il batch appena creato
      await supabase.from('partner_settlements').delete().eq('id', newBatch.id)
      throw new Error(`Errore aggiornamento prenotazioni: ${updateError.message}`)
    }

    console.log(`✅ [settlements] Batch creato: ${newBatch.id} (${bookings.length} prenotazioni, €${totalNet.toFixed(2)} netti)`)

    return NextResponse.json({
      success: true,
      settlement: newBatch,
      message: `Batch creato: ${bookings.length} prenotazioni per €${totalNet.toFixed(2)} netti`
    }, { status: 201 })

  } catch (error: any) {
    console.error('❌ [settlements] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}