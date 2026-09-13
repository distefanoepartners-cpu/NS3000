// app/api/bookings/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import { sendBookingNotificationToDesk } from '@/lib/whatsapp-service'

const NS3000_PHONE = process.env.NS3000_WHATSAPP_NUMBER || process.env.NS3000_SMS_NUMBER || '+393881140189'

const trimOrNull = (v: any): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

// GET - Singola prenotazione
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        boat:boats(*),
        service:rental_services(*),
        booking_status:booking_statuses(*),
        deposit_payment_method:payment_methods!bookings_deposit_payment_method_id_fkey(*),
        balance_payment_method:payment_methods!bookings_balance_payment_method_id_fkey(*),
        caution_payment_method:payment_methods!bookings_caution_payment_method_id_fkey(*)
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Aggiorna prenotazione
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()

    const { data: oldBooking } = await supabaseAdmin
      .from('bookings')
      .select('booking_status_id, booking_statuses(name)')
      .eq('id', params.id)
      .single()

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        customer_id: body.customer_id,
        boat_id: body.boat_id,
        service_id: body.service_id,
        service_type: body.service_type,
        booking_date: body.booking_date,
        booking_end_date: body.booking_end_date || body.booking_date,
        num_days: body.num_days || 1,
        daily_price: body.daily_price || body.base_price || 0,
        time_slot: body.time_slot || null,
        num_passengers: body.num_passengers,
        num_minors: body.num_minors || 0,
        children_over_3: body.children_over_3 || 0,
        children_under_3: body.children_under_3 || 0,
        base_price: body.base_price,
        final_price: body.final_price,
        deposit_amount: body.deposit_amount,
        balance_amount: body.balance_amount,
        caution_amount: body.caution_amount || 0,
        deposit_payment_method_id: body.deposit_payment_method_id || null,
        balance_payment_method_id: body.balance_payment_method_id || null,
        caution_payment_method_id: body.caution_payment_method_id || null,
        deposit_payment_date: body.deposit_payment_date || null,
        balance_payment_date: body.balance_payment_date || null,
        booking_status_id: body.booking_status_id,
        notes: trimOrNull(body.notes),
        internal_notes: trimOrNull(body.internal_notes),
        payment_type: body.payment_type || 'deposit',
        deposit_percentage: body.deposit_percentage || 30,
        booking_source: body.booking_source || 'online',
        supplier_id: body.supplier_id || null,
        skipper_id: body.skipper_id || null,
        has_license: body.has_license || false,
        license_number: trimOrNull(body.license_number),
        license_expiry: body.license_expiry || null,
        document_type: trimOrNull(body.document_type),
        document_number: trimOrNull(body.document_number),
        document_expiry: body.document_expiry || null,
        booking_type: body.booking_type || null,
        passengers_documents: body.passengers_documents || null,
        payment_lines: body.payment_lines || [],
        lang: body.lang || 'it',
        hostess_name: trimOrNull(body.hostess_name),
        partner_code: body.partner_code || null,
        partner_id: body.partner_id || null,
        boarding_port: trimOrNull(body.boarding_port),
        disembark_port: trimOrNull(body.disembark_port),
        updated_by: body.updated_by || null,
        updated_by_name: body.updated_by_name || null
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    const oldStatusName = (oldBooking as any)?.booking_statuses?.name
    let newStatusName: string | null = null

    if (body.booking_status_id) {
      const { data: newStatus } = await supabaseAdmin
        .from('booking_statuses')
        .select('name')
        .eq('id', body.booking_status_id)
        .single()
      newStatusName = newStatus?.name || null
    }

    if (newStatusName === 'Confermata' && oldStatusName !== 'Confermata') {
      console.log('📱 Stato cambiato a Confermata - invio SMS automatico...')

      const { data: fullBooking } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          customer:customers(id, first_name, last_name),
          boat:boats(id, name),
          service:rental_services(id, name),
          skipper:skippers(id, first_name, last_name, phone)
        `)
        .eq('id', params.id)
        .single()

      if (fullBooking) {
        const smsData = {
          booking_number: fullBooking.booking_number,
          customer_name: fullBooking.customer
            ? `${fullBooking.customer.first_name} ${fullBooking.customer.last_name}`
            : 'N/A',
          boat_name: fullBooking.boat?.name || 'Da assegnare',
          service_name: fullBooking.service?.name || 'N/A',
          booking_date: fullBooking.booking_date,
          time_slot: fullBooking.time_slot || 'full_day',
          num_passengers: fullBooking.num_passengers || 1,
          final_price: fullBooking.final_price || 0,
          deposit_amount: fullBooking.deposit_amount || 0,
          notes: fullBooking.notes || undefined,
          lang: fullBooking.lang || 'it',
        }

        try {
          const ns3000Result = await sendBookingNotificationToDesk(NS3000_PHONE, smsData)
          if (ns3000Result.success) {
            console.log('✅ WhatsApp template inviato a NS3000:', ns3000Result.messageId)
            try {
              await supabaseAdmin.from('sms_logs').insert({
                booking_id: params.id,
                phone_to: NS3000_PHONE,
                sms_type: 'ns3000_auto_whatsapp',
                sent_at: new Date().toISOString(),
                success: true,
                message_id: ns3000Result.messageId
              })
            } catch (logErr) { console.warn('⚠️ Log notifica non salvato:', logErr) }
          } else {
            console.error('❌ WhatsApp NS3000 fallito:', ns3000Result.error)
          }
        } catch (waErr) {
          console.error('❌ Errore WhatsApp template NS3000:', waErr)
        }
      }
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina prenotazione
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    const { error } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}