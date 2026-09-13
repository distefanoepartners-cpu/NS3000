// app/api/bookings/[id]/send-email/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { sendBookingNotificationToDesk } from '@/lib/whatsapp-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

// ⭐ FIX 2026-04-30: numero NS3000 fisso per notifica WhatsApp prenotazione
const NS3000_PHONE = process.env.NS3000_WHATSAPP_NUMBER || process.env.NS3000_SMS_NUMBER || '+393881140189'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const bookingId = params.id

    // Leggi lingua dal body (se presente), altrimenti dal record DB
    let requestLang = 'it'
    try {
      const body = await request.json()
      if (body.lang) requestLang = body.lang
    } catch {
      // Body vuoto, usa default
    }

    console.log('📧 [send-email] Booking ID:', bookingId)

    // Carica prenotazione con tutti i dati necessari
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name, boat_type),
        service:rental_services(id, name, description),
        skipper:skippers(id, first_name, last_name, phone),
        booking_status:booking_statuses(id, name, code)
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      console.log('❌ [send-email] Booking not found:', error)
      return NextResponse.json(
        { error: 'Prenotazione non trovata' },
        { status: 404 }
      )
    }

    if (!booking.customer?.email) {
      return NextResponse.json(
        { error: 'Email cliente non disponibile' },
        { status: 400 }
      )
    }

    // PRIORITÀ LINGUA: 1) dalla request, 2) dal record DB, 3) default 'it'
    const lang = requestLang || booking.lang || 'it'
    console.log('🌐 [send-email] Language:', lang)

    const t = translations[lang] || translations['it']
    const customerName = `${booking.customer.first_name} ${booking.customer.last_name}`
    const bookingNumber = booking.booking_number || booking.id.slice(0, 8).toUpperCase()

    // Formatta data
    const bookingDate = booking.booking_date 
      ? formatDate(booking.booking_date, lang)
      : '-'
    
    // Data fine (per multi-giorno)
    const bookingEndDate = booking.booking_end_date && booking.booking_end_date !== booking.booking_date
      ? formatDate(booking.booking_end_date, lang)
      : null

    const timeSlotLabel = getTimeSlotLabel(booking.time_slot, lang)
    const finalPrice = booking.final_price || 0
    const boardingPort = booking.boarding_port || 'Porto Masuccio Salernitano - Salerno'
    const depositAmount = booking.deposit_amount || 0
    const balanceAmount = booking.balance_amount || 0
    const remaining = Math.max(0, finalPrice - depositAmount - balanceAmount)

    // ⭐ Label giorni localizzata (con ES)
    const daysLabel = lang === 'en' ? 'days' : lang === 'es' ? 'días' : 'giorni'

    const subject = `✅ ${t.confirmationTitle} ${bookingNumber} - NS3000 Rent`

    const html = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- HEADER con logo -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 30px; text-align: center;">
              <img src="https://ns-3000.vercel.app/logo-ns3000.png" alt="NS3000 Rent" style="max-width: 180px; height: auto;" />
            </td>
          </tr>

          <!-- BAND BLU -->
          <tr>
            <td style="background-color: #1e3a5f; padding: 20px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                ✅ ${t.confirmationTitle}
              </h1>
              <p style="margin: 8px 0 0 0; color: #93c5fd; font-size: 15px;">
                ${t.bookingCode}: <strong style="color: #ffffff;">${bookingNumber}</strong>
              </p>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="padding: 30px 30px 10px 30px;">
              <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                ${t.greeting} <strong>${customerName}</strong>,<br>
                ${t.intro}
              </p>
            </td>
          </tr>

          <!-- DETTAGLI PRENOTAZIONE -->
          <tr>
            <td style="padding: 10px 30px 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #1e3a5f; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #1e3a5f; font-size: 16px;">
                      📋 ${t.bookingDetails}
                    </h3>
                    <table width="100%" cellpadding="4" cellspacing="0">
                      ${booking.service?.name ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; width: 140px; vertical-align: top;">${t.service}:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600;">${booking.service.name}</td>
                      </tr>
                      ` : ''}
                      ${booking.boat?.name ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; vertical-align: top;">${t.boat}:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600;">${booking.boat.name}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; vertical-align: top;">${t.date}:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600;">
                          ${bookingDate}${bookingEndDate ? ` → ${bookingEndDate} <span style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:700;">${booking.num_days || 1} ${daysLabel}</span>` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; vertical-align: top;">${t.schedule}:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600;">${timeSlotLabel}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; vertical-align: top;">${t.passengers}:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600;">${booking.num_passengers || 1}</td>
                      </tr>
                      ${booking.skipper ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; vertical-align: top;">${t.skipper}:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600;">⚓ ${booking.skipper.first_name} ${booking.skipper.last_name}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PUNTO DI IMBARCO -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background-color: #e0f2fe; padding: 16px 20px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #0c4a6e; font-size: 15px;">
                  📍 <strong>${t.boardingLocation}:</strong><br>
                  ${boardingPort}
                </p>
                <p style="margin: 8px 0 0 0; color: #0369a1; font-size: 13px;">
                  ${t.arriveEarly}
                </p>
              </div>
            </td>
          </tr>

          <!-- PAGAMENTO -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #16a34a; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px;">
                      💰 ${t.paymentDetails}
                    </h3>
                    <table width="100%" cellpadding="4" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; width: 140px;">${t.totalPrice}:</td>
                        <td style="color: #1f2937; font-size: 18px; font-weight: 700;">€${finalPrice.toFixed(2)}</td>
                      </tr>
                      ${depositAmount > 0 ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">${t.deposit}:</td>
                        <td style="color: #16a34a; font-size: 14px; font-weight: 600;">€${depositAmount.toFixed(2)} ✅</td>
                      </tr>
                      ` : ''}
                      ${balanceAmount > 0 ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">${t.paid}:</td>
                        <td style="color: #16a34a; font-size: 14px; font-weight: 600;">€${balanceAmount.toFixed(2)} ✅</td>
                      </tr>
                      ` : ''}
                      ${remaining > 0 ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">${t.remaining}:</td>
                        <td style="color: #dc2626; font-size: 14px; font-weight: 600;">€${remaining.toFixed(2)}</td>
                      </tr>
                      ` : `
                      <tr>
                        <td colspan="2" style="padding-top: 5px;">
                          <div style="background: #dcfce7; color: #166534; padding: 8px; border-radius: 4px; text-align: center; font-weight: 600;">
                            ✅ ${t.paymentComplete}
                          </div>
                        </td>
                      </tr>
                      `}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ⚠️ NOTE ESCLUSE - Sono informazioni interne, non vengono mostrate al cliente -->

          <!-- CONTATTI -->
          <tr>
            <td style="padding: 10px 30px 20px 30px;">
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">
                  ${t.contactInfo}
                </p>
                <p style="margin: 0; color: #1f2937; font-size: 14px;">
                  📧 <a href="mailto:ns3000rent@gmail.com" style="color: #1e3a5f; text-decoration: none; font-weight: 600;">ns3000rent@gmail.com</a><br>
                  📱 <a href="tel:+393881140189" style="color: #1e3a5f; text-decoration: none; font-weight: 600;">+39 388 114 0189</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding: 24px 30px; background-color: #1e3a5f; text-align: center;">
              <p style="margin: 0; color: #a8c5e0; font-size: 13px;">
                ${t.thanks}<br>
                ${t.seeYou} ⚓🌊
              </p>
              <p style="margin: 15px 0 0 0; color: #64748b; font-size: 11px;">
                NS3000 Rent - Porto di Salerno<br>
                © ${new Date().getFullYear()} ${t.allRights}
              </p>
              <p style="margin: 10px 0 0 0; color: #64748b; font-size: 10px;">
                ${t.autoEmail}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    // Invia email
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'NS3000 Rent <noreply@rentsalernoboat.it>',
      to: [booking.customer.email],
      cc: ['ns3000rent@gmail.com'],
      subject,
      html,
    })

    if (emailError) {
      console.log('❌ [send-email] Resend error:', emailError)
      return NextResponse.json({ error: emailError.message }, { status: 500 })
    }

    console.log('✅ [send-email] Email sent:', emailResult?.id)

    // Aggiorna timestamp invio email
    await supabase
      .from('bookings')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', bookingId)

    // ⚠️ 2026-05-30: notifica WhatsApp desk RIMOSSA da qui per evitare DUPLICATO.
    // La notifica al desk parte gia da bookings/[id] PUT al passaggio stato -> Confermata.
    const whatsappMessageId: string | undefined = undefined
    const whatsappError: string | undefined = undefined

    return NextResponse.json({
      success: true,
      emailId: emailResult?.id,
      whatsappMessageId,
      whatsappError,
      lang,
    })
  } catch (error: any) {
    console.error('❌ [send-email] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}

// ─── TRADUZIONI ──────────────────────────────────────────────────

interface TranslationSet {
  confirmationTitle: string
  bookingCode: string
  greeting: string
  intro: string
  bookingDetails: string
  service: string
  boat: string
  date: string
  schedule: string
  passengers: string
  skipper: string
  boardingLocation: string
  arriveEarly: string
  paymentDetails: string
  totalPrice: string
  deposit: string
  paid: string
  remaining: string
  paymentComplete: string
  contactInfo: string
  thanks: string
  seeYou: string
  allRights: string
  autoEmail: string
}

const translations: Record<string, TranslationSet> = {
  it: {
    confirmationTitle: 'Prenotazione Confermata',
    bookingCode: 'Codice prenotazione',
    greeting: 'Gentile',
    intro: 'la sua prenotazione è stata confermata con successo!',
    bookingDetails: 'Dettagli Prenotazione',
    service: 'Servizio',
    boat: 'Imbarcazione',
    date: 'Data',
    schedule: 'Orario',
    passengers: 'Passeggeri',
    skipper: 'Skipper',
    boardingLocation: 'Punto di imbarco',
    arriveEarly: 'Si prega di presentarsi 15 minuti prima dell\'orario di imbarco',
    paymentDetails: 'Riepilogo Pagamento',
    totalPrice: 'Totale',
    deposit: 'Acconto versato',
    paid: 'Saldo versato',
    remaining: 'Saldo da versare',
    paymentComplete: 'Pagamento completato',
    contactInfo: 'Per informazioni o assistenza:',
    thanks: 'Grazie per aver scelto NS3000 Rent',
    seeYou: 'Ti aspettiamo a bordo!',
    allRights: 'Tutti i diritti riservati',
    autoEmail: 'Questa è una email automatica, si prega di non rispondere.',
  },
  en: {
    confirmationTitle: 'Booking Confirmed',
    bookingCode: 'Booking code',
    greeting: 'Dear',
    intro: 'your booking has been successfully confirmed!',
    bookingDetails: 'Booking Details',
    service: 'Service',
    boat: 'Boat',
    date: 'Date',
    schedule: 'Schedule',
    passengers: 'Passengers',
    skipper: 'Skipper',
    boardingLocation: 'Boarding location',
    arriveEarly: 'Please arrive 15 minutes before the boarding time',
    paymentDetails: 'Payment Summary',
    totalPrice: 'Total',
    deposit: 'Deposit paid',
    paid: 'Balance paid',
    remaining: 'Balance due',
    paymentComplete: 'Payment complete',
    contactInfo: 'For information or assistance:',
    thanks: 'Thank you for choosing NS3000 Rent',
    seeYou: 'We look forward to seeing you on board!',
    allRights: 'All rights reserved',
    autoEmail: 'This is an automatic email, please do not reply.',
  },
  // ⭐ Spagnolo neutro (usable per Spagna e Latinoamerica)
  es: {
    confirmationTitle: 'Reserva Confirmada',
    bookingCode: 'Código de reserva',
    greeting: 'Estimado/a',
    intro: '¡su reserva ha sido confirmada con éxito!',
    bookingDetails: 'Detalles de la Reserva',
    service: 'Servicio',
    boat: 'Embarcación',
    date: 'Fecha',
    schedule: 'Horario',
    passengers: 'Pasajeros',
    skipper: 'Patrón',
    boardingLocation: 'Punto de embarque',
    arriveEarly: 'Le rogamos presentarse 15 minutos antes del horario de embarque',
    paymentDetails: 'Resumen del Pago',
    totalPrice: 'Total',
    deposit: 'Anticipo pagado',
    paid: 'Saldo pagado',
    remaining: 'Saldo pendiente',
    paymentComplete: 'Pago completado',
    contactInfo: 'Para información o asistencia:',
    thanks: 'Gracias por elegir NS3000 Rent',
    seeYou: '¡Los esperamos a bordo!',
    allRights: 'Todos los derechos reservados',
    autoEmail: 'Este es un correo automático, por favor no responder.',
  },
}

// ─── UTILITÀ ─────────────────────────────────────────────────────

function formatDate(dateStr: string, lang: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00')
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }
    const localeMap: Record<string, string> = {
      it: 'it-IT',
      en: 'en-GB',
      es: 'es-ES',
    }
    return date.toLocaleDateString(localeMap[lang] || 'it-IT', options)
  } catch {
    return dateStr
  }
}

function getTimeSlotLabel(timeSlot: string, lang: string): string {
  const labels: Record<string, Record<string, string>> = {
    it: {
      morning: '🌅 Mattina',
      afternoon: '🌇 Pomeriggio',
      evening: '🌙 Sera',
      full_day: '☀️ Giornata intera',
    },
    en: {
      morning: '🌅 Morning',
      afternoon: '🌇 Afternoon',
      evening: '🌙 Evening',
      full_day: '☀️ Full Day',
    },
    es: {
      morning: '🌅 Mañana',
      afternoon: '🌇 Tarde',
      evening: '🌙 Noche',
      full_day: '☀️ Día completo',
    },
  }
  return labels[lang]?.[timeSlot] || timeSlot || '-'
}