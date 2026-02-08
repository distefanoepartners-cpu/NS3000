// app/api/bookings/[id]/send-email/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import { sendBookingConfirmation } from '@/lib/email-service'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const bookingId = params.id

    // Carica prenotazione con tutti i dati necessari
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name, boat_type),
        service:rental_services(id, name, description),
        skipper:skippers(id, first_name, last_name, phone)
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json(
        { error: 'Prenotazione non trovata' },
        { status: 404 }
      )
    }

    // Verifica che ci sia un'email cliente
    if (!booking.customer?.email) {
      return NextResponse.json(
        { error: 'Email cliente non presente' },
        { status: 400 }
      )
    }

    // Prepara dati per email
    const emailData = {
      booking_number: booking.booking_number,
      customer: {
        first_name: booking.customer.first_name,
        last_name: booking.customer.last_name,
        email: booking.customer.email,
        phone: booking.customer.phone || undefined,
      },
      boat: {
        name: booking.boat.name,
        boat_type: booking.boat.boat_type || undefined,
      },
      service: {
        name: booking.service.name,
        description: booking.service.description || undefined,
      },
      booking_date: booking.booking_date,
      time_slot: booking.time_slot || 'full_day',
      num_passengers: booking.num_passengers || 1,
      num_minors: booking.num_minors || undefined,
      final_price: booking.final_price || 0,
      deposit_amount: booking.deposit_amount || 0,
      balance_amount: booking.balance_amount || 0,
      caution_amount: booking.caution_amount || undefined,
      notes: booking.notes || undefined,
      skipper: booking.skipper ? {
        first_name: booking.skipper.first_name,
        last_name: booking.skipper.last_name,
        phone: booking.skipper.phone || undefined,
      } : undefined,
    }

    // Invia email
    const result = await sendBookingConfirmation(emailData)

    // Log invio email
    await supabaseAdmin
      .from('email_logs')
      .insert({
        booking_id: bookingId,
        email_to: booking.customer.email,
        email_type: 'booking_confirmation',
        sent_at: new Date().toISOString(),
        success: true,
        email_id: result.emailId
      })
      .then(() => console.log('✅ Log email salvato'))
      .catch(err => console.warn('⚠️ Errore salvataggio log email:', err))

    return NextResponse.json({
      success: true,
      message: 'Email inviata con successo',
      emailId: result.emailId
    })

  } catch (error: any) {
    console.error('❌ Errore invio email prenotazione:', error)
    
    // Log errore
    const params = await context.params
    await supabaseAdmin
      .from('email_logs')
      .insert({
        booking_id: params.id,
        email_type: 'booking_confirmation',
        sent_at: new Date().toISOString(),
        success: false,
        error_message: error.message
      })
      .then(() => console.log('✅ Log errore salvato'))
      .catch(err => console.warn('⚠️ Errore salvataggio log errore:', err))

    return NextResponse.json(
      { error: error.message || 'Errore invio email' },
      { status: 500 }
    )
  }
}