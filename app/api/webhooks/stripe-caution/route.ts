// app/api/webhooks/stripe-caution/route.ts
// 
// WEBHOOK per aggiornare lo stato cauzione quando il cliente completa il pagamento
// Configura su Stripe Dashboard → Webhooks → Add endpoint:
//   URL: https://ns-3000.vercel.app/api/webhooks/stripe-caution
//   Eventi: checkout.session.completed, payment_intent.canceled, payment_intent.payment_failed
//
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

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

export async function POST(request: Request) {
  try {
    const stripe = getStripe()
    const webhookSecret = process.env.STRIPE_CAUTION_WEBHOOK_SECRET!

    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('❌ [stripe-webhook] Signature verification failed:', err.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log('🔔 [stripe-webhook] Event:', event.type)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Verifica che sia una cauzione
        if (session.metadata?.type !== 'caution') break

        const bookingId = session.metadata.booking_id
        if (!bookingId) break

        console.log('✅ [stripe-webhook] Caution checkout completed for booking:', bookingId)

        // Recupera il PaymentIntent dalla sessione
        const paymentIntentId = session.payment_intent as string

        await supabase
          .from('bookings')
          .update({
            caution_stripe_payment_intent_id: paymentIntentId,
            caution_stripe_status: 'requires_capture', // Pre-autorizzato
            caution_authorized_at: new Date().toISOString(),
          })
          .eq('id', bookingId)

        break
      }

      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.metadata?.type !== 'caution') break

        const bookingId = pi.metadata.booking_id
        if (!bookingId) break

        console.log('🔓 [stripe-webhook] Caution released/expired for booking:', bookingId)

        // Aggiorna solo se non già gestito manualmente
        const { data: booking } = await supabase
          .from('bookings')
          .select('caution_stripe_status')
          .eq('id', bookingId)
          .single()

        if (booking && !['released', 'captured'].includes(booking.caution_stripe_status)) {
          await supabase
            .from('bookings')
            .update({
              caution_stripe_status: 'expired',
              caution_released_at: new Date().toISOString(),
            })
            .eq('id', bookingId)
        }

        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.metadata?.type !== 'caution') break

        const bookingId = pi.metadata.booking_id
        if (!bookingId) break

        console.log('❌ [stripe-webhook] Caution payment failed for booking:', bookingId)

        await supabase
          .from('bookings')
          .update({ caution_stripe_status: 'failed' })
          .eq('id', bookingId)

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('❌ [stripe-webhook] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}