import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// POST - Segna lo scontrino come emesso (scontrino_verificato = true)
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ scontrino_verificato: true })
      .eq('id', params.id)
      .select('id, booking_number, scontrino_verificato')
      .single()
    if (error) throw error
    return NextResponse.json({ success: true, booking: data })
  } catch (error: any) {
    console.error('Errore aggiornamento scontrino:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}
