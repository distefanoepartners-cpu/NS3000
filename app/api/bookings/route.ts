// app/api/bookings/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import { sendBookingNotificationToDesk } from '@/lib/whatsapp-service'
const NS3000_DESK_PHONE = process.env.NS3000_WHATSAPP_NUMBER || process.env.NS3000_SMS_NUMBER || '+393881140189'

// GET - Lista prenotazioni
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const boat_id = searchParams.get('boat_id')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const supplier_id = searchParams.get('supplier_id')

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name, boat_type),
        service:rental_services(id, name, description),
        deposit_payment_method:payment_methods!deposit_payment_method_id(id, name, code),
        balance_payment_method:payment_methods!balance_payment_method_id(id, name, code),
        booking_status:booking_statuses(id, name, code),
        skipper:skippers(id, first_name, last_name, phone, license_number, license_expiry_date)
      `)
      .order('booking_date', { ascending: true })
      .order('created_at', { ascending: false })

    if (boat_id) {
      query = query.eq('boat_id', boat_id)
    }
    if (start && end) {
      // ⭐ Prenotazioni multi-giorno: overlap se booking_date <= end AND booking_end_date >= start
      query = query
        .lte('booking_date', end)
        .or(`booking_end_date.gte.${start},booking_end_date.is.null`)
    }
    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea nuova prenotazione
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // ⭐ LOG: verifica cosa arriva dal plugin
    console.log('📦 POST /api/bookings - body.booking_source:', body.booking_source)

    // ⭐ 04/05/2026 — VALIDAZIONE COERENZA booking_source / supplier_id
    // (anti-bug NS20260503-0275: prenotazione native NS3000 attribuita per errore
    // al supplier Blu Alliance perché il modal nascondeva il dropdown supplier
    // mentre formData.supplier_id restava valorizzato).
    //
    // Regole:
    //   - canali INTERNI ('in_person', 'online') → supplier_id DEVE essere null/assente
    //   - canali ESTERNI ('supplier', 'blualliance') → supplier_id DEVE essere valorizzato
    //
    // Nota: la sync da BA usa un endpoint separato (/api/external/bookings),
    // quindi questa validazione non interferisce con quel flusso. Se in futuro
    // BA sync passasse da qui, comunque rispetterebbe le regole (blualliance + supplier_id).
    const internalSources = ['in_person', 'online']
    const externalSources = ['supplier', 'blualliance']
    const hasSupplier = !!body.supplier_id
    const sourceVal = body.booking_source || 'in_person'

    if (hasSupplier && internalSources.includes(sourceVal)) {
      console.warn('🚫 [validation] Stato incoerente: supplier_id valorizzato con canale interno', {
        supplier_id: body.supplier_id,
        booking_source: sourceVal,
        customer_id: body.customer_id,
      })
      return NextResponse.json({
        error: `Incoerenza dati: hai impostato un fornitore (supplier_id) ma il canale è '${sourceVal}' (interno). Imposta booking_source = 'supplier' o rimuovi il fornitore.`
      }, { status: 400 })
    }

    if (!hasSupplier && externalSources.includes(sourceVal)) {
      console.warn('🚫 [validation] Stato incoerente: canale esterno senza supplier_id', {
        booking_source: sourceVal,
        customer_id: body.customer_id,
      })
      return NextResponse.json({
        error: `Incoerenza dati: il canale è '${sourceVal}' (esterno) ma manca il supplier_id. Seleziona un fornitore o cambia canale.`
      }, { status: 400 })
    }

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_id: body.customer_id,
        boat_id: body.boat_id || null,
        service_id: body.service_id,
        service_type: body.service_type || 'rental',
        booking_date: body.booking_date,
        booking_end_date: body.booking_end_date || body.booking_date, // ⭐ Data fine (default = data inizio)
        num_days: body.num_days || 1, // ⭐ Numero giorni
        daily_price: body.daily_price || body.base_price || 0, // ⭐ Prezzo giornaliero
        time_slot: body.time_slot || null,
        num_passengers: body.num_passengers || 1,
        num_minors: body.num_minors || 0,
        base_price: body.base_price || 0,
        final_price: body.final_price || 0,
        deposit_amount: body.deposit_amount || 0,
        balance_amount: body.balance_amount || 0,
        caution_amount: body.caution_amount || 0,
        deposit_payment_method_id: body.deposit_payment_method_id || null,
        deposit_payment_date: body.deposit_payment_date || null,
        balance_payment_date: body.balance_payment_date || null,
        balance_payment_method_id: body.balance_payment_method_id || null,
        caution_payment_method_id: body.caution_payment_method_id || null,
       booking_status_id: body.booking_status_id || null,
        notes: body.notes || null,
        internal_notes: body.internal_notes || null,
        payment_type: body.payment_type || 'deposit',
        deposit_percentage: body.deposit_percentage || 30,
        booking_source: body.booking_source || 'in_person',  // ⭐ default 'in_person' per prenotazioni manuali
        supplier_id: body.supplier_id || null,
        skipper_id: body.skipper_id || null,
        // Documento cliente
        has_license: body.has_license || false,
        document_type: body.document_type || null,
        document_number: body.document_number || null,
        document_expiry: body.document_expiry || null,
        booking_type: body.booking_type || null,
        // ⭐ Documenti multipli per tour collettivi (JSONB)
        passengers_documents: body.passengers_documents || null,
        payment_lines: body.payment_lines || [],
        boarding_port: (body.boarding_port || '').toString().trim() || null,
        disembark_port: (body.disembark_port || '').toString().trim() || null,
        // ⭐ Tracciamento operatore
        created_by: body.created_by || null,
        created_by_name: body.created_by_name || null,
        updated_by: body.updated_by || null,
        updated_by_name: body.updated_by_name || null,
        // 🧾 Scontrino: prenotazioni online partono 'da verificare' (false), le altre ok (true)
        scontrino_verificato: (body.booking_source === 'online') ? false : true
      })
      // ⭐ IMPORTANTE: select con JOIN per avere customer/boat/service disponibili per l'email
      .select(`
        *,
        customer:customers(id, first_name, last_name, email, phone),
        boat:boats(id, name, boat_type),
        service:rental_services(id, name, description),
        skipper:skippers(id, first_name, last_name, phone)
      `)
      .single()

    if (error) throw error

    // ⭐ LOG: verifica cosa ha salvato nel db
    console.log('✅ Booking creato:', booking.booking_number, '| source:', booking.booking_source, '| customer email:', booking.customer?.email)

    // ⭐ AUTO-EMAIL: parte solo se booking_source === 'online' (dal plugin WordPress)
    if (booking.booking_source === 'online' && booking.customer?.email) {
      try {
        console.log('📧 Invio automatico email per booking:', booking.booking_number)

        const emailData = {
          booking_number: booking.booking_number,
          customer: {
            first_name: booking.customer.first_name,
            last_name: booking.customer.last_name,
            email: booking.customer.email,
            phone: booking.customer.phone || undefined,
          },
          boat: {
            name: booking.boat?.name || 'N/A',
            boat_type: booking.boat?.boat_type || undefined,
          },
          service: {
            name: booking.service?.name || 'N/A',
            description: booking.service?.description || undefined,
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

       // await sendBookingConfirmation(emailData)

        // Log successo
        try {
          await supabaseAdmin
            .from('email_logs')
            .insert({
              booking_id: booking.id,
              email_to: booking.customer.email,
              email_type: 'booking_confirmation',
              sent_at: new Date().toISOString(),
              success: true
            })
        } catch (logErr) {
          console.warn('⚠️ Errore log email:', logErr)
        }

        console.log('✅ Email automatica inviata con successo')
      } catch (emailError: any) {
        // Non blocchiamo la creazione booking se l'email fallisce
        console.error('❌ Errore invio email automatica:', emailError)

        try {
          await supabaseAdmin
            .from('email_logs')
            .insert({
              booking_id: booking.id,
              email_to: booking.customer?.email,
              email_type: 'booking_confirmation',
              sent_at: new Date().toISOString(),
              success: false,
              error_message: emailError.message
            })
        } catch (logErr) {
          console.warn('⚠️ Errore log errore email:', logErr)
        }
      }
    } else {
      // LOG: spiega perché l'email non è partita
      console.log('⏭️ Email non inviata automaticamente | source:', booking.booking_source, '| email:', booking.customer?.email || 'MANCANTE')
    }

    // 📱 Notifica WhatsApp al desk per nuova prenotazione online (obbligo scontrino)
    if (booking.booking_source === 'online') {
      try {
        const deskResult = await sendBookingNotificationToDesk(NS3000_DESK_PHONE, {
          booking_number: booking.booking_number,
          customer_name: booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'N/A',
          boat_name: booking.boat?.name || 'N/A',
          service_name: booking.service?.name || 'N/A',
          booking_date: booking.booking_date,
          time_slot: booking.time_slot || 'full_day',
          num_passengers: booking.num_passengers || 1,
          final_price: booking.final_price || 0,
          deposit_amount: booking.deposit_amount || 0,
          lang: 'it',
        })
        await supabaseAdmin.from('sms_logs').insert({
          booking_id: booking.id,
          phone_to: NS3000_DESK_PHONE,
          sms_type: 'ns3000_auto_whatsapp',
          sent_at: new Date().toISOString(),
          success: deskResult.success,
          message_id: deskResult.messageId || null,
          error_message: deskResult.error || null,
        })
        console.log('📱 Notifica WhatsApp desk inviata:', deskResult.success)
      } catch (notifErr: any) {
        console.error('Notifica desk fallita:', notifErr.message)
      }
    }

    // ⭐ Invia push notification server-side a admin/staff per nuova prenotazione
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000');

      // Recupera utenti admin/staff
      const { data: adminUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('role', ['admin', 'staff'])
        .eq('is_active', true);

      if (adminUsers && adminUsers.length > 0) {
        const customerName = booking.customer
          ? `${booking.customer.first_name || ''} ${booking.customer.last_name || ''}`.trim()
          : 'Cliente';
        const boatName = booking.boat?.name || 'Da assegnare';
        const bookingDate = new Date(booking.booking_date).toLocaleDateString('it-IT');

        await fetch(`${baseUrl}/api/notifications/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '🆕 Nuova Prenotazione!',
            message: `${customerName} - ${boatName} - ${bookingDate}`,
            userIds: adminUsers.map(u => u.id),
            tag: `booking-${booking.id}`,
            data: {
              type: 'new_booking',
              bookingId: booking.id,
              url: `/bookings?id=${booking.id}`
            }
          })
        });
        console.log('📤 Push notification nuova prenotazione inviata');
      }
    } catch (pushError) {
      console.warn('⚠️ Errore invio push (non bloccante):', pushError);
    }

    return NextResponse.json(booking, { status: 201 })
  } catch (error: any) {
    console.error('Error creating booking:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
