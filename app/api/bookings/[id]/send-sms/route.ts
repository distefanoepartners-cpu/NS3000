// app/api/bookings/[id]/send-sms/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import { sendBookingSmsToSupplier } from '@/lib/sms-service'

// Numero fisso NS3000 - riceve SEMPRE l'SMS
const NS3000_PHONE = process.env.NS3000_SMS_NUMBER || '+393881140189'
const NS3000_NAME = 'NS3000 Rent'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const bookingId = params.id

    // Carica prenotazione con relazioni
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name, boat_type),
        service:rental_services(id, name, description),
        skipper:skippers(id, first_name, last_name, phone),
        status:booking_statuses(id, name)
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json(
        { error: 'Prenotazione non trovata' },
        { status: 404 }
      )
    }

    // Verifica stato Confermata
    if (booking.status?.name !== 'Confermata') {
      return NextResponse.json(
        { error: `SMS non inviato: la prenotazione è in stato "${booking.status?.name || 'sconosciuto'}". Solo le prenotazioni Confermate possono inviare notifiche.` },
        { status: 400 }
      )
    }

    // Prepara dati SMS
    const smsData = {
      booking_number: booking.booking_number,
      customer_name: booking.customer 
        ? `${booking.customer.first_name} ${booking.customer.last_name}` 
        : 'N/A',
      boat_name: booking.boat?.name || 'Da assegnare',
      service_name: booking.service?.name || 'N/A',
      booking_date: booking.booking_date,
      time_slot: booking.time_slot || 'full_day',
      num_passengers: booking.num_passengers || 1,
      final_price: booking.final_price || 0,
      deposit_amount: booking.deposit_amount || 0,
      notes: booking.notes || undefined,
      lang: booking.lang || 'it',
    }

    const results: string[] = []
    const errors: string[] = []

    // 1. Invia SEMPRE a NS3000
    console.log(`📱 Invio SMS a NS3000 (${NS3000_PHONE})...`)
    const ns3000Result = await sendBookingSmsToSupplier(NS3000_PHONE, NS3000_NAME, smsData)
    if (ns3000Result.success) {
      results.push('NS3000')
      try {
        await supabaseAdmin.from('sms_logs').insert({
          booking_id: bookingId,
          phone_to: NS3000_PHONE,
          sms_type: 'ns3000_notification',
          sent_at: new Date().toISOString(),
          success: true,
          message_id: ns3000Result.messageId
        })
      } catch (logErr) {
        console.warn('⚠️ Log SMS non salvato:', logErr)
      }
    } else {
      errors.push(`NS3000: ${ns3000Result.error}`)
    }

    // 2. Skipper SMS disattivato
    // if (booking.skipper?.phone) {
    //   const skipperName = `${booking.skipper.first_name} ${booking.skipper.last_name}`
    //   console.log(`📱 Invio SMS a Skipper ${skipperName} (${booking.skipper.phone})...`)
    //   
    //   const skipperResult = await sendBookingSmsToSupplier(booking.skipper.phone, skipperName, smsData)
    //   if (skipperResult.success) {
    //     results.push(`Skipper ${skipperName}`)
    //     try {
    //       await supabaseAdmin.from('sms_logs').insert({
    //         booking_id: bookingId,
    //         phone_to: booking.skipper.phone,
    //         sms_type: 'skipper_notification',
    //         sent_at: new Date().toISOString(),
    //         success: true,
    //         message_id: skipperResult.messageId
    //       })
    //     } catch (logErr) {
    //       console.warn('⚠️ Log SMS skipper non salvato:', logErr)
    //     }
    //   } else {
    //     errors.push(`Skipper ${skipperName}: ${skipperResult.error}`)
    //   }
    // }

    // Risultato finale
    if (results.length === 0) {
      return NextResponse.json(
        { error: `Errore invio SMS: ${errors.join(', ')}` },
        { status: 500 }
      )
    }

    const message = `SMS inviato a: ${results.join(', ')}` + 
      (errors.length > 0 ? ` | Errori: ${errors.join(', ')}` : '')

    return NextResponse.json({
      success: true,
      message,
      sent_to: results,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('❌ Errore invio SMS prenotazione:', error)
    return NextResponse.json(
      { error: error.message || 'Errore invio SMS' },
      { status: 500 }
    )
  }
}