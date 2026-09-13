// app/api/bookings/mark-invoiced/route.ts
//
// Bulk update: cambia stato di un set di prenotazioni da "Da Fatturare" a "Chiusa".
// Usato dalla pagina /reports/invoice dopo emissione fattura aggregata mensile.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingIds: string[] = body.booking_ids || []

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return NextResponse.json(
        { error: 'booking_ids deve essere un array non vuoto' },
        { status: 400 }
      )
    }

    // Risolvi l'id dello stato "Chiusa" (code = 'completed')
    const { data: closedStatus, error: statusError } = await supabaseAdmin
      .from('booking_statuses')
      .select('id')
      .eq('code', 'completed')
      .single()

    if (statusError || !closedStatus) {
      return NextResponse.json(
        { error: 'Stato "Chiusa" non trovato' },
        { status: 500 }
      )
    }

    // Update bulk
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        booking_status_id: closedStatus.id,
        updated_at: new Date().toISOString(),
      })
      .in('id', bookingIds)
      .select('id, booking_number')

    if (error) throw error

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
      booking_numbers: (data || []).map((b: any) => b.booking_number),
    })
  } catch (error: any) {
    console.error('Error mark-invoiced:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}