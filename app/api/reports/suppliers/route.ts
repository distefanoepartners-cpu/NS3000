import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Lista tutti gli estratti conto
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('supplier_statements')
      .select(`
        *,
        supplier:suppliers(name, commission_percentage)
      `)
      .order('period_start', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Genera nuovo estratto conto
export async function POST(request: Request) {
  try {
    const { supplier_id, period_start, period_end } = await request.json()

    if (!supplier_id || !period_start || !period_end) {
      return NextResponse.json(
        { error: 'supplier_id, period_start e period_end richiesti' },
        { status: 400 }
      )
    }

    // Ottieni info fornitore
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from('suppliers')
      .select('name, commission_percentage')
      .eq('id', supplier_id)
      .single()

    if (supplierError) throw supplierError

    // Ottieni prenotazioni completate del fornitore nel periodo
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        booking_number,
        booking_date,
        final_price,
        booking_status:booking_statuses(code)
      `)
      .eq('supplier_id', supplier_id)
      .gte('booking_date', period_start)
      .lte('booking_date', period_end)
      .in('booking_status.code', ['completed', 'confirmed'])

    if (bookingsError) throw bookingsError

    // Calcola totali
    const totalBookings = bookings?.length || 0
    const totalRevenue = bookings?.reduce((sum, b) => sum + (b.final_price || 0), 0) || 0
    const commissionPercentage = supplier.commission_percentage || 0
    const totalCommission = (totalRevenue * commissionPercentage) / 100

    // Genera numero estratto conto
    const statementNumber = `EC-${supplier_id.substring(0, 8)}-${period_start}-${period_end}`

    // Crea estratto conto
    const { data: statement, error: statementError } = await supabaseAdmin
      .from('supplier_statements')
      .insert([{
        supplier_id,
        statement_number: statementNumber,
        period_start,
        period_end,
        total_bookings: totalBookings,
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        status: 'draft'
      }])
      .select()
      .single()

    if (statementError) throw statementError

    // Ritorna estratto conto con dettagli prenotazioni
    return NextResponse.json({
      statement,
      bookings,
      supplier
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}