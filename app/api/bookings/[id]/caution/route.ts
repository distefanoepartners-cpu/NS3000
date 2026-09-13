// app/api/bookings/[id]/caution/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { sendCautionWhatsApp } from '@/lib/whatsapp-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ⭐ LAZY INIT: evita crash al build quando env vars non sono disponibili
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
  })
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

// ─── GET: Stato cauzione ─────────────────────────────────────────
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const bookingId = params.id

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('caution_amount, caution_stripe_session_id, caution_stripe_payment_intent_id, caution_stripe_status, caution_authorized_at, caution_captured_at, caution_released_at, caution_captured_amount')
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 })
    }

    let stripeStatus = booking.caution_stripe_status
    const stripe = getStripe()
    
    if (booking.caution_stripe_payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(booking.caution_stripe_payment_intent_id)
        
        if (pi.status === 'requires_capture') {
          stripeStatus = 'requires_capture'
        } else if (pi.status === 'canceled') {
          stripeStatus = 'released'
        } else if (pi.status === 'succeeded') {
          stripeStatus = 'captured'
        } else {
          stripeStatus = pi.status
        }

        if (stripeStatus !== booking.caution_stripe_status) {
          const updateData: any = { caution_stripe_status: stripeStatus }
          if (stripeStatus === 'requires_capture' && !booking.caution_authorized_at) {
            updateData.caution_authorized_at = new Date().toISOString()
          }
          if (stripeStatus === 'released' && !booking.caution_released_at) {
            updateData.caution_released_at = new Date().toISOString()
          }
          await supabase.from('bookings').update(updateData).eq('id', bookingId)
        }
      } catch (e) {
        console.error('Stripe PI retrieve error:', e)
      }
    } 
    else if (booking.caution_stripe_session_id && booking.caution_stripe_status === 'pending') {
      try {
        const session = await stripe.checkout.sessions.retrieve(booking.caution_stripe_session_id)
        
        if (session.status === 'expired' || session.status === 'complete') {
          if (session.status === 'expired') {
            stripeStatus = 'expired'
            await supabase.from('bookings').update({
              caution_stripe_status: 'expired',
              caution_released_at: new Date().toISOString()
            }).eq('id', bookingId)
          } else if (session.status === 'complete' && session.payment_intent) {
            stripeStatus = 'requires_capture'
            await supabase.from('bookings').update({
              caution_stripe_status: 'requires_capture',
              caution_stripe_payment_intent_id: session.payment_intent as string,
              caution_authorized_at: new Date().toISOString()
            }).eq('id', bookingId)
          }
        }
      } catch (e) {
        console.error('Stripe Session retrieve error:', e)
      }
    }

    return NextResponse.json({
      caution_amount: booking.caution_amount,
      stripe_status: stripeStatus,
      authorized_at: booking.caution_authorized_at,
      captured_at: booking.caution_captured_at,
      released_at: booking.caution_released_at,
      captured_amount: booking.caution_captured_amount,
      has_session: !!booking.caution_stripe_session_id,
    })
  } catch (error: any) {
    console.error('❌ [caution] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── POST: Crea sessione Checkout per pre-autorizzazione ─────────
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const bookingId = params.id
    const body = await request.json()
    const { send_email = true, send_sms = true, caution_amount: cautionAmountFromForm } = body

    console.log('🔒 [caution] Creating pre-auth for booking:', bookingId)

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name),
        service:rental_services(id, name, service_type)
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 })
    }
// ⭐ Se il form ha passato un importo cauzione aggiornato, salvalo sul record
    // PRIMA di creare il link Stripe (così il link usa sempre l'importo corrente).
    if (cautionAmountFromForm != null && Number(cautionAmountFromForm) > 0
        && Number(cautionAmountFromForm) !== Number(booking.caution_amount)) {
      const nuovoImporto = Number(cautionAmountFromForm)
      await supabase
        .from('bookings')
        .update({ caution_amount: nuovoImporto })
        .eq('id', bookingId)
      booking.caution_amount = nuovoImporto
      console.log('🔒 [caution] Importo aggiornato dal form:', nuovoImporto)
    }
    if (booking.service?.service_type !== 'rental') {
      return NextResponse.json(
        { error: 'La cauzione è prevista solo per i servizi di locazione' },
        { status: 400 }
      )
    }

    if (!booking.caution_amount || booking.caution_amount <= 0) {
      return NextResponse.json(
        { error: 'Importo cauzione non impostato. Inserisci l\'importo nel campo Cauzione.' },
        { status: 400 }
      )
    }

    if (!booking.customer?.email && !booking.customer?.phone) {
      return NextResponse.json(
        { error: 'Il cliente non ha né email né telefono. Impossibile inviare il link.' },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    if (booking.caution_stripe_payment_intent_id) {
      try {
        const existingPI = await stripe.paymentIntents.retrieve(booking.caution_stripe_payment_intent_id)
        if (existingPI.status === 'requires_capture') {
          return NextResponse.json(
            { error: 'Esiste già una pre-autorizzazione attiva per questa prenotazione' },
            { status: 400 }
          )
        }
      } catch {
        // PI non trovato, procedi
      }
    }

    const bookingNumber = booking.booking_number || bookingId.slice(0, 8).toUpperCase()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ns-3000.vercel.app'
    const lang = booking.lang || 'it'
    const t = translations[lang] || translations.it

    // Crea Stripe Checkout Session con pre-autorizzazione
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'manual',
        metadata: {
          booking_id: bookingId,
          booking_number: bookingNumber,
          type: 'caution',
        },
        description: `${t.cautionFor} ${bookingNumber} - ${booking.boat?.name || ''}`,
      },
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${t.securityDeposit} - ${bookingNumber}`,
              description: `${t.cautionDescription} ${booking.boat?.name || ''} - ${booking.booking_date || ''}`,
            },
            unit_amount: Math.round(booking.caution_amount * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: booking.customer?.email || undefined,
      success_url: `${baseUrl}/caution/success?session_id={CHECKOUT_SESSION_ID}&booking=${bookingNumber}`,
      cancel_url: `${baseUrl}/caution/cancel?booking=${bookingNumber}`,
     expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      metadata: {
        booking_id: bookingId,
        booking_number: bookingNumber,
        type: 'caution',
      },
    })

    console.log('✅ [caution] Checkout session created:', session.id)

    await supabase
      .from('bookings')
      .update({
        caution_stripe_session_id: session.id,
        caution_stripe_status: 'pending',
      })
      .eq('id', bookingId)

    const customerName = `${booking.customer.first_name} ${booking.customer.last_name}`
    const sendResults: string[] = []
    const sendErrors: string[] = []

    // ─── INVIO EMAIL ─────────────────────────────────────
    if (send_email && booking.customer.email) {
      try {
        const resend = getResend()
        const emailHtml = generateCautionEmail(
          customerName,
          bookingNumber,
          booking.caution_amount,
          booking.boat?.name || '',
          booking.booking_date || '',
          session.url!,
          lang
        )

        await resend.emails.send({
          from: 'NS3000 Rent <booking@rentsalernoboat.it>',
          to: [booking.customer.email],
          subject: `${t.emailSubject} ${bookingNumber} - NS3000 Rent`,
          html: emailHtml,
        })
        console.log('✅ [caution] Email sent to:', booking.customer.email)
        sendResults.push(`📧 Email a ${booking.customer.email}`)
      } catch (emailErr) {
        console.error('⚠️ [caution] Email error:', emailErr)
        sendErrors.push(`Email: ${(emailErr as Error).message}`)
      }
    }

    // ─── INVIO WHATSAPP ──────────────────────────────────
    // ⭐ FIX 27/04/2026: passiamo booking_id (non session.id).
    //    Il template Twilio costruisce: https://ns-3000.vercel.app/c/{{5}}
    //    Endpoint /c/[id] fa redirect 302 a session.url completo (con fragment).
    if (send_sms && booking.customer.phone) {
      try {
        const waResult = await sendCautionWhatsApp(booking.customer.phone, {
          booking_id: booking.id, 
          customer_name: customerName,
          booking_number: bookingNumber,
          boat_name: booking.boat?.name || '',
          caution_amount: booking.caution_amount,
          payment_link: bookingId,
          lang,
        })

        if (waResult.success) {
          console.log('✅ [caution] WhatsApp sent to:', booking.customer.phone)
          sendResults.push(`📱 WhatsApp a ${booking.customer.phone}`)
        } else {
          console.error('⚠️ [caution] WhatsApp error:', waResult.error)
          sendErrors.push(`WhatsApp: ${waResult.error}`)
        }
      } catch (waErr) {
        console.error('⚠️ [caution] WhatsApp error:', waErr)
        sendErrors.push(`WhatsApp: ${(waErr as Error).message}`)
      }
    }

    if (sendResults.length === 0 && sendErrors.length > 0) {
      console.warn('⚠️ [caution] Nessun invio riuscito, ma sessione creata')
    }

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      sent: sendResults,
      errors: sendErrors.length > 0 ? sendErrors : undefined,
      message: sendResults.length > 0 
        ? `Link cauzione inviato: ${sendResults.join(', ')}` 
        : 'Sessione creata. Link copiato negli appunti.',
    })
  } catch (error: any) {
    console.error('❌ [caution] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── PUT: Cattura o rilascia la pre-autorizzazione ───────────────
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const bookingId = params.id
    const body = await request.json()
    const { action, capture_amount } = body

    console.log('🔒 [caution] Action:', action, 'for booking:', bookingId)

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('caution_stripe_payment_intent_id, caution_amount, caution_stripe_status')
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 })
    }

    if (!booking.caution_stripe_payment_intent_id) {
      return NextResponse.json(
        { error: 'Nessuna pre-autorizzazione trovata' },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    const pi = await stripe.paymentIntents.retrieve(booking.caution_stripe_payment_intent_id)

    if (pi.status !== 'requires_capture') {
      return NextResponse.json(
        { error: `Operazione non possibile. Stato attuale: ${pi.status}` },
        { status: 400 }
      )
    }

    if (action === 'release') {
      await stripe.paymentIntents.cancel(booking.caution_stripe_payment_intent_id)

      await supabase
        .from('bookings')
        .update({
          caution_stripe_status: 'released',
          caution_released_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      console.log('✅ [caution] Released for booking:', bookingId)

      return NextResponse.json({
        success: true,
        action: 'released',
        message: 'Cauzione rilasciata - nessun addebito al cliente',
      })
    } else if (action === 'capture') {
      const amountToCapture = capture_amount
        ? Math.round(capture_amount * 100)
        : Math.round(booking.caution_amount * 100)

      await stripe.paymentIntents.capture(
        booking.caution_stripe_payment_intent_id,
        { amount_to_capture: amountToCapture }
      )

      const capturedEur = amountToCapture / 100

      await supabase
        .from('bookings')
        .update({
          caution_stripe_status: 'captured',
          caution_captured_at: new Date().toISOString(),
          caution_captured_amount: capturedEur,
        })
        .eq('id', bookingId)

      console.log('✅ [caution] Captured €', capturedEur, 'for booking:', bookingId)

      return NextResponse.json({
        success: true,
        action: 'captured',
        captured_amount: capturedEur,
        message: `Cauzione addebitata: €${capturedEur.toFixed(2)}`,
      })
    } else {
      return NextResponse.json({ error: 'Azione non valida. Usa "capture" o "release".' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('❌ [caution] PUT error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── TRADUZIONI (it/en/es) ───────────────────────────────────────

interface CautionTranslations {
  securityDeposit: string
  cautionFor: string
  cautionDescription: string
  emailSubject: string
}

const translations: Record<string, CautionTranslations> = {
  it: {
    securityDeposit: 'Cauzione',
    cautionFor: 'Cauzione per prenotazione',
    cautionDescription: 'Cauzione di sicurezza per noleggio',
    emailSubject: '🔒 Cauzione richiesta -',
  },
  en: {
    securityDeposit: 'Security Deposit',
    cautionFor: 'Security deposit for booking',
    cautionDescription: 'Security deposit for boat rental',
    emailSubject: '🔒 Security deposit required -',
  },
  // ⭐ Spagnolo neutro
  es: {
    securityDeposit: 'Depósito de Garantía',
    cautionFor: 'Depósito de garantía para reserva',
    cautionDescription: 'Depósito de garantía para alquiler de embarcación',
    emailSubject: '🔒 Depósito requerido -',
  },
}

// ─── EMAIL CAUZIONE ──────────────────────────────────────────────

interface CautionEmailStrings {
  title: string
  booking: string
  dear: string
  intro: string
  depositAmount: string
  boat: string
  date: string
  preAuthNote: string
  authorizeButton: string
  linkExpires: string
  forQuestions: string
  allRights: string
}

const cautionEmailStrings: Record<string, CautionEmailStrings> = {
  it: {
    title: 'Cauzione Richiesta',
    booking: 'Prenotazione',
    dear: 'Gentile',
    intro: "Per completare la sua prenotazione di locazione, è necessario versare una cauzione rimborsabile. L'importo verrà <strong>bloccato sulla carta</strong> e <strong>rilasciato automaticamente</strong> al termine del noleggio, salvo danni all'imbarcazione.",
    depositAmount: 'Importo cauzione',
    boat: 'Imbarcazione',
    date: 'Data',
    preAuthNote: 'Si tratta di una <strong>sola pre-autorizzazione</strong>. La carta NON verrà addebitata. Il blocco viene rilasciato automaticamente al termine del noleggio.',
    authorizeButton: '🔒 Autorizza Cauzione',
    linkExpires: 'Il link scade tra 72 ore. Se scaduto, contattaci per riceverne uno nuovo.',
    forQuestions: 'Per informazioni:',
    allRights: 'Tutti i diritti riservati',
  },
  en: {
    title: 'Security Deposit Required',
    booking: 'Booking',
    dear: 'Dear',
    intro: 'To complete your boat rental booking, we require a refundable security deposit. This amount will be held on your card and <strong>automatically released</strong> after the rental, unless damage is reported.',
    depositAmount: 'Deposit amount',
    boat: 'Boat',
    date: 'Date',
    preAuthNote: 'This is a <strong>pre-authorization only</strong>. Your card will NOT be charged. The hold will be automatically released after the rental.',
    authorizeButton: '🔒 Authorize Security Deposit',
    linkExpires: 'The link expires in 72 hours. If expired, contact us for a new link.',
    forQuestions: 'For questions:',
    allRights: 'All rights reserved',
  },
  // ⭐ Spagnolo neutro
  es: {
    title: 'Depósito de Garantía Requerido',
    booking: 'Reserva',
    dear: 'Estimado/a',
    intro: 'Para completar su reserva de alquiler, es necesario un depósito de garantía reembolsable. El importe será <strong>bloqueado en la tarjeta</strong> y <strong>liberado automáticamente</strong> al finalizar el alquiler, salvo daños a la embarcación.',
    depositAmount: 'Importe del depósito',
    boat: 'Embarcación',
    date: 'Fecha',
    preAuthNote: 'Se trata solo de una <strong>pre-autorización</strong>. La tarjeta NO será cargada. El bloqueo se libera automáticamente al finalizar el alquiler.',
    authorizeButton: '🔒 Autorizar Depósito',
    linkExpires: 'El enlace caduca en 72 horas. Si ha expirado, contáctenos para obtener uno nuevo.',
    forQuestions: 'Para información:',
    allRights: 'Todos los derechos reservados',
  },
}

function generateCautionEmail(
  customerName: string,
  bookingNumber: string,
  amount: number,
  boatName: string,
  bookingDate: string,
  checkoutUrl: string,
  lang: string
): string {
  const t = cautionEmailStrings[lang] || cautionEmailStrings.it

  const localeMap: Record<string, string> = {
    it: 'it-IT',
    en: 'en-GB',
    es: 'es-ES',
  }

  const formattedDate = (() => {
    try {
      const d = new Date(bookingDate + 'T00:00:00')
      return d.toLocaleDateString(localeMap[lang] || 'it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    } catch {
      return bookingDate
    }
  })()

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

        <!-- LOGO -->
        <tr><td style="background-color:#fff;padding:20px 30px;text-align:center;">
          <img src="https://ns-3000.vercel.app/logo-ns3000.png" alt="NS3000 Rent" style="max-width:180px;height:auto;" />
        </td></tr>

        <!-- HEADER BLU -->
        <tr><td style="background-color:#1e3a5f;padding:20px 30px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">
            🔒 ${t.title}
          </h1>
          <p style="margin:8px 0 0 0;color:#93c5fd;font-size:15px;">
            ${t.booking}: <strong style="color:#fff;">${bookingNumber}</strong>
          </p>
        </td></tr>

        <!-- TESTO -->
        <tr><td style="padding:30px;">
          <p style="margin:0 0 15px 0;color:#374151;font-size:16px;line-height:1.6;">
            ${t.dear} <strong>${customerName}</strong>,
          </p>
          <p style="margin:0 0 20px 0;color:#374151;font-size:15px;line-height:1.6;">
            ${t.intro}
          </p>

          <!-- DETTAGLI -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border-left:4px solid #f59e0b;margin-bottom:20px;">
            <tr><td style="padding:20px;">
              <table width="100%" cellpadding="4" cellspacing="0">
                <tr>
                  <td style="color:#6b7280;font-size:14px;width:140px;">${t.depositAmount}:</td>
                  <td style="color:#1f2937;font-size:20px;font-weight:700;">€${amount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color:#6b7280;font-size:14px;">${t.boat}:</td>
                  <td style="color:#1f2937;font-size:14px;font-weight:600;">${boatName}</td>
                </tr>
                <tr>
                  <td style="color:#6b7280;font-size:14px;">${t.date}:</td>
                  <td style="color:#1f2937;font-size:14px;font-weight:600;">${formattedDate}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- NOTA SICUREZZA -->
          <div style="background:#fef3c7;padding:12px 16px;border-radius:8px;margin-bottom:20px;">
            <p style="margin:0;color:#92400e;font-size:13px;">
              ℹ️ ${t.preAuthNote}
            </p>
          </div>

          <!-- PULSANTE -->
          <div style="text-align:center;margin:25px 0;">
            <a href="${checkoutUrl}" 
               style="display:inline-block;background-color:#f59e0b;color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.5px;">
              ${t.authorizeButton}
            </a>
          </div>

          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
            ${t.linkExpires}
          </p>
        </td></tr>

        <!-- CONTATTI -->
        <tr><td style="padding:10px 30px 20px 30px;">
          <div style="background:#f9fafb;padding:16px;border-radius:8px;text-align:center;">
            <p style="margin:0;color:#374151;font-size:14px;">
              ${t.forQuestions}<br>
              📧 <a href="mailto:ns3000rent@gmail.com" style="color:#1e3a5f;text-decoration:none;font-weight:600;">ns3000rent@gmail.com</a> •
              📱 <a href="tel:+393881140189" style="color:#1e3a5f;text-decoration:none;font-weight:600;">+39 388 114 0189</a>
            </p>
          </div>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:20px 30px;background-color:#1e3a5f;text-align:center;">
          <p style="margin:0;color:#64748b;font-size:11px;">
            NS3000 Rent - Porto di Salerno<br>
            © ${new Date().getFullYear()} ${t.allRights}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `
}