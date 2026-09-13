// app/api/bookings/close-invoiced/route.ts
// Chiusura massiva: porta le prenotazioni "Da Fatturare" (to_invoice) di un
// dato source e mese allo stato "Chiusa" (completed).
// Usato a fine mese dopo la fatturazione al fornitore (es. Blu Alliance).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

const STATUS_TO_INVOICE = 'b3d304b7-0feb-425f-9fbe-281ca6767540' // Da Fatturare
const STATUS_COMPLETED  = 'e7798e9d-fcea-4f91-9661-454e403e673e' // Chiusa

// GET — conta quante prenotazioni verrebbero chiuse (per l'anteprima nel pulsante)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const month = searchParams.get('month') // formato 'YYYY-MM'
    if (!source || !month) {
      return NextResponse.json({ error: 'source e month obbligatori' }, { status: 400 })
    }
    const start = `${month}-01`
    const end = endOfMonth(month)

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('source', source)
      .eq('booking_status_id', STATUS_TO_INVOICE)
      .gte('booking_date', start)
      .lte('booking_date', end)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ count: data?.length || 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — esegue la chiusura massiva
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, month } = body
    if (!source || !month) {
      return NextResponse.json({ error: 'source e month obbligatori' }, { status: 400 })
    }
    const start = `${month}-01`
    const end = endOfMonth(month)

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ booking_status_id: STATUS_COMPLETED, updated_at: new Date().toISOString() })
      .eq('source', source)
      .eq('booking_status_id', STATUS_TO_INVOICE)
      .gte('booking_date', start)
      .lte('booking_date', end)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, closed: data?.length || 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Ultimo giorno del mese 'YYYY-MM' in formato 'YYYY-MM-DD'
function endOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate() // giorno 0 del mese successivo = ultimo del corrente
  return `${month}-${String(last).padStart(2, '0')}`
}