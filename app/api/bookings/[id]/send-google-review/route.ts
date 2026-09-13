// app/api/bookings/[id]/send-google-review/route.ts
//
// Invia richiesta recensione Google via WhatsApp al cliente di una prenotazione.
// Usa il template Twilio approvato da Meta tramite l'helper sendGoogleReviewWhatsApp
// definito in lib/whatsapp-service.ts (coerente con caution / welcome / desk-notification).
//
// Tracking: aggiorna google_review_sent_at, send_count e operatore su `bookings`.
// Idempotenza: nessun blocco — l'operatore puo' rinviare consapevolmente
// (la UI mostra "gia' inviato" come hint visivo).
//
// ⚠️ Next.js 16 — params e' una Promise, va awaited.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import { sendGoogleReviewWhatsApp } from '@/lib/whatsapp-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ------------------------------------------------------------------
    // 1) Recupera prenotazione + dati cliente
    // ------------------------------------------------------------------
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        booking_number,
        booking_date,
        lang,
        google_review_send_count,
        customer:customers(id, first_name, last_name, phone)
      `)
      .eq('id', id)
      .single()

    if (fetchError || !booking) {
      console.error('❌ [google-review] Booking non trovato:', id, fetchError)
      return NextResponse.json(
        { error: 'Prenotazione non trovata' },
        { status: 404 }
      )
    }

    const customer = booking.customer as any
    if (!customer) {
      return NextResponse.json(
        { error: 'Cliente non collegato alla prenotazione' },
        { status: 400 }
      )
    }
    if (!customer.phone) {
      return NextResponse.json(
        { error: 'Il cliente non ha un numero di telefono registrato' },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------------
    // 2) Invio via helper centralizzato
    // ------------------------------------------------------------------
    const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Cliente'

    console.log('📤 [google-review] Invio:', {
      booking: booking.booking_number,
      to: customer.phone,
      lang: booking.lang || 'it',
    })

    const result = await sendGoogleReviewWhatsApp(customer.phone, {
      customer_name: customer.first_name || 'Cliente',
      booking_date: booking.booking_date,
      lang: booking.lang || 'it',
    })

    if (!result.success) {
      console.error('❌ [google-review] Twilio errore:', result.error)
      return NextResponse.json(
        { error: result.error || 'Errore invio WhatsApp' },
        { status: 500 }
      )
    }

    console.log('✅ [google-review] Inviato, SID:', result.messageId)

    // ------------------------------------------------------------------
    // 3) Tracking — aggiorna booking
    // ------------------------------------------------------------------
    const body = await request.json().catch(() => ({} as any))
    const newCount = (booking.google_review_send_count || 0) + 1

    const updatePayload: any = {
      google_review_sent_at: new Date().toISOString(),
      google_review_send_count: newCount,
    }
    if (body.user_id) updatePayload.google_review_sent_by = body.user_id
    if (body.user_name) updatePayload.google_review_sent_by_name = body.user_name

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update(updatePayload)
      .eq('id', id)

    if (updateError) {
      console.warn('⚠️ [google-review] Errore tracking (non bloccante):', updateError)
    }

    return NextResponse.json({
      success: true,
      message: `⭐ Recensione richiesta a ${customerName}`,
      sid: result.messageId,
      send_count: newCount,
    })
  } catch (error: any) {
    console.error('❌ [google-review] Errore generico:', error)
    return NextResponse.json(
      {
        error: error.message || 'Errore invio WhatsApp',
        twilio_code: error.code,
        twilio_more_info: error.moreInfo,
      },
      { status: 500 }
    )
  }
}