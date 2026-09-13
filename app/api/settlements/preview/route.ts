// app/api/settlements/preview/route.ts
//
// Anteprima settlement: dato un partner + periodo, mostra le prenotazioni
// 'pending' candidate al batch + totali calcolati. Usato dal wizard creazione.
//
// GET /api/settlements/preview?supplier_id=X&period_start=YYYY-MM-DD&period_end=YYYY-MM-DD

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplier_id')
    const periodStart = searchParams.get('period_start')
    const periodEnd = searchParams.get('period_end')

    if (!supplierId) {
      return NextResponse.json({ error: 'supplier_id obbligatorio' }, { status: 400 })
    }
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'period_start e period_end obbligatori' }, { status: 400 })
    }

    // Carica scheda supplier
    const { data: supplier, error: supError } = await supabase
      .from('suppliers')
      .select('id, name, commission_percentage')
      .eq('id', supplierId)
      .single()

    if (supError || !supplier) {
      return NextResponse.json({ error: 'Supplier non trovato' }, { status: 404 })
    }

    // Carica prenotazioni 'pending' del partner nel periodo
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id, booking_number, booking_date, final_price, 
        supplier_commission_percentage, supplier_commission_amount,
        settlement_status, source,
        customer:customers(first_name, last_name, email),
        boat:boats(name)
      `)
      .eq('supplier_id', supplierId)
      .eq('settlement_status', 'pending')
      .gte('booking_date', periodStart)
      .lte('booking_date', periodEnd)
      .order('booking_date', { ascending: true })

    if (bookingsError) throw bookingsError

    // Calcola totali
    const totalGross = (bookings || []).reduce((sum, b) => sum + (parseFloat(String(b.final_price)) || 0), 0)
    const totalCommission = (bookings || []).reduce((sum, b) => sum + (parseFloat(String(b.supplier_commission_amount)) || 0), 0)
    const totalNet = totalGross - totalCommission

    return NextResponse.json({
      supplier,
      period_start: periodStart,
      period_end: periodEnd,
      bookings: bookings || [],
      totals: {
        bookings_count: (bookings || []).length,
        total_gross: totalGross.toFixed(2),
        total_commission: totalCommission.toFixed(2),
        total_net: totalNet.toFixed(2),
      },
    })
  } catch (error: any) {
    console.error('❌ [settlements/preview] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}