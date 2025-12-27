import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(first_name, last_name, email, phone),
        boat:boats(name, boat_type),
        service:services(name, type),
        booking_status:booking_statuses(name),
        payment_method:payment_methods(name)
      `)
      .order('booking_date', { ascending: false })

    if (start && end) {
      query = query.gte('booking_date', start).lte('booking_date', end)
    }

    const { data: bookings, error } = await query

    if (error) throw error

    // Converti in formato CSV
    const headers = [
      'Numero',
      'Data',
      'Cliente',
      'Email',
      'Telefono',
      'Servizio',
      'Barca',
      'Passeggeri',
      'Prezzo Totale',
      'Acconto',
      'Saldo',
      'Da Ricevere',
      'Metodo Pagamento',
      'Stato'
    ]

    const rows = bookings?.map(b => [
      b.booking_number || '',
      b.booking_date || '',
      `${b.customer?.first_name || ''} ${b.customer?.last_name || ''}`,
      b.customer?.email || '',
      b.customer?.phone || '',
      b.service?.name || '',
      b.boat?.name || '',
      b.num_passengers || 0,
      b.final_price || 0,
      b.deposit_amount || 0,
      b.balance_amount || 0,
      ((b.final_price || 0) - (b.deposit_amount || 0) - (b.balance_amount || 0)),
      b.payment_method?.name || '',
      b.booking_status?.name || ''
    ]) || []

    // Crea CSV
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Aggiungi BOM per supporto UTF-8 in Excel
    const bom = '\uFEFF'
    const csvWithBom = bom + csv

    return new NextResponse(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="prenotazioni_${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error: any) {
    console.error('Error exporting:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}