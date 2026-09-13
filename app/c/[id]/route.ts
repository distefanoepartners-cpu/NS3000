// app/c/[id]/route.ts
//
// Short-link redirector per pagamento cauzione via WhatsApp.
//
// Il template WhatsApp Twilio non può accettare URL completi come variabili
// (Meta policy: "Only one variable can be added to the end of a URL"), quindi
// passiamo solo il booking_id come variabile {{5}} e questo endpoint si occupa
// di recuperare la checkout session Stripe valida e fare un 302 redirect verso
// l'URL completo (con fragment #fid... necessario all'autenticazione browser).
//
// Flusso:
//   1. Cliente clicca link WhatsApp:  https://ns-3000.vercel.app/c/{booking_id}
//   2. Lookup DB: caution_stripe_session_id per quel booking
//   3. Stripe API: retrieve session per ottenere session.url completo
//   4. Validazioni: status, scadenza
//   5. 302 redirect a session.url
//
// Casi gestiti:
//   - booking non trovato → 404 con messaggio user-friendly
//   - cauzione già autorizzata/catturata → pagina di conferma
//   - sessione scaduta → pagina con istruzioni per contattare NS3000
//   - sessione valida → redirect immediato

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
  })
}

// HTML helper: pagina di stato user-friendly (non error JSON)
function renderStatusPage(opts: {
  title: string
  emoji: string
  message: string
  contactInfo?: boolean
  status?: number
}): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title} - NS3000 Rent</title>
  <style>
    body {
      margin: 0; padding: 24px; background: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937; min-height: 100vh; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #fff; max-width: 440px; width: 100%;
      border-radius: 12px; padding: 32px 24px; text-align: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .emoji { font-size: 56px; margin-bottom: 12px; }
    h1 { margin: 0 0 12px; font-size: 22px; color: #1e3a5f; }
    p { margin: 0 0 16px; line-height: 1.6; color: #4b5563; font-size: 15px; }
    .contact {
      margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;
      font-size: 14px; color: #6b7280;
    }
    .contact a { color: #1e3a5f; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${opts.emoji}</div>
    <h1>${opts.title}</h1>
    <p>${opts.message}</p>
    ${opts.contactInfo ? `
    <div class="contact">
      Contattaci:<br>
      📧 <a href="mailto:ns3000rent@gmail.com">ns3000rent@gmail.com</a><br>
      📱 <a href="tel:+393881140189">+39 388 114 0189</a>
    </div>` : ''}
  </div>
</body>
</html>`
  return new NextResponse(html, {
    status: opts.status || 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const bookingId = params.id

    if (!bookingId) {
      console.warn('[c/redirect] No booking ID provided')
      return renderStatusPage({
        emoji: '⚠️',
        title: 'Link non valido',
        message: 'Il link che hai cliccato non è valido. Contatta NS3000 Rent per ricevere un nuovo link.',
        contactInfo: true,
        status: 400,
      })
    }

    console.log('🔗 [c/redirect] Lookup for booking:', bookingId)

    // ─── Lookup DB ────────────────────────────────────────────
    // Accetta sia booking_id (UUID, formato nuovo) che session_id (cs_xxx, link vecchi già inviati)
    const isStripeSessionId = bookingId.startsWith('cs_')

    const query = supabase
      .from('bookings')
      .select('id, caution_stripe_session_id, caution_stripe_status, caution_authorized_at, caution_captured_at, caution_released_at, booking_number')

    const { data: booking, error } = isStripeSessionId
      ? await query.eq('caution_stripe_session_id', bookingId).maybeSingle()
      : await query.eq('id', bookingId).maybeSingle()

    if (error || !booking) {
      console.warn('[c/redirect] Booking not found:', bookingId, error?.message)
      return renderStatusPage({
        emoji: '❌',
        title: 'Prenotazione non trovata',
        message: 'Non riusciamo a trovare la tua prenotazione. Verifica di aver utilizzato il link più recente o contattaci.',
        contactInfo: true,
        status: 404,
      })
    }

    // ─── Stato già processato ─────────────────────────────────
    if (booking.caution_authorized_at || booking.caution_stripe_status === 'requires_capture') {
      console.log('[c/redirect] Caution already authorized for:', bookingId)
      return renderStatusPage({
        emoji: '✅',
        title: 'Cauzione già autorizzata',
        message: `La cauzione per la prenotazione <strong>${booking.booking_number || bookingId.slice(0, 8).toUpperCase()}</strong> è già stata autorizzata. Non è necessario alcun ulteriore pagamento.`,
        contactInfo: false,
        status: 200,
      })
    }

    if (booking.caution_captured_at || booking.caution_stripe_status === 'captured') {
      return renderStatusPage({
        emoji: '✅',
        title: 'Cauzione completata',
        message: 'La cauzione è già stata processata. Grazie!',
        contactInfo: false,
      })
    }

    if (!booking.caution_stripe_session_id) {
      console.warn('[c/redirect] No Stripe session for booking:', bookingId)
      return renderStatusPage({
        emoji: '⚠️',
        title: 'Cauzione non disponibile',
        message: 'Non risulta una richiesta di cauzione attiva per questa prenotazione. Contattaci per ricevere il link corretto.',
        contactInfo: true,
        status: 400,
      })
    }

    // ─── Recupera URL completo da Stripe ──────────────────────
    let stripeSession
    try {
      const stripe = getStripe()
      stripeSession = await stripe.checkout.sessions.retrieve(booking.caution_stripe_session_id)
    } catch (stripeErr: any) {
      console.error('[c/redirect] Stripe retrieve error:', stripeErr?.message)
      return renderStatusPage({
        emoji: '⚠️',
        title: 'Errore temporaneo',
        message: 'Si è verificato un problema nel recuperare i dati di pagamento. Riprova tra qualche minuto o contattaci.',
        contactInfo: true,
        status: 502,
      })
    }

    // ─── Sessione scaduta o invalida ──────────────────────────
    if (stripeSession.status === 'expired') {
      console.log('[c/redirect] Stripe session expired for:', bookingId)
      return renderStatusPage({
        emoji: '⏰',
        title: 'Link scaduto',
        message: 'Il link di pagamento è scaduto (massimo 24 ore). Contattaci per ricevere un nuovo link aggiornato.',
        contactInfo: true,
        status: 410, // Gone
      })
    }

    if (stripeSession.status === 'complete') {
      return renderStatusPage({
        emoji: '✅',
        title: 'Pagamento completato',
        message: 'La cauzione è già stata autorizzata. Grazie!',
        contactInfo: false,
      })
    }

    if (!stripeSession.url) {
      console.error('[c/redirect] Stripe session has no URL:', stripeSession.id)
      return renderStatusPage({
        emoji: '⚠️',
        title: 'Link non disponibile',
        message: 'Il link di pagamento non è disponibile al momento. Contattaci per ricevere assistenza.',
        contactInfo: true,
        status: 502,
      })
    }

    // ─── Redirect verso Checkout Stripe ───────────────────────
    console.log('✅ [c/redirect] Redirecting to:', stripeSession.url.substring(0, 80) + '...')

    // 302 redirect (Found) — il browser segue automaticamente
    return NextResponse.redirect(stripeSession.url, { status: 302 })

  } catch (error: any) {
    console.error('❌ [c/redirect] Unexpected error:', error)
    return renderStatusPage({
      emoji: '⚠️',
      title: 'Errore imprevisto',
      message: 'Qualcosa è andato storto. Contattaci e ti aiuteremo a completare la cauzione.',
      contactInfo: true,
      status: 500,
    })
  }
}