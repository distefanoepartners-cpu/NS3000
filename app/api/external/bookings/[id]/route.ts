import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import { sendBookingConfirmation } from '@/lib/email-service'

/**
 * API Esterna - Gestione Prenotazioni NS3000
 *
 * GET  /api/external/bookings  → Lista prenotazioni (solo disponibilità, no dati cliente)
 * POST /api/external/bookings  → Crea prenotazione da partner (Blu Alliance, STH, ecc.)
 *
 * Auth: API Key via header X-API-Key
 *
 * IDENTIFICAZIONE PARTNER (commissione + settlement):
 *   Header: X-Partner-Supplier-ID  (UUID del supplier in NS3000)
 *
 *   Se NON presente: fallback a Blu Alliance (retrocompatibilità).
 *   La commission_percentage viene letta dinamicamente dalla scheda supplier,
 *   non più hardcoded.
 *
 * INVIO EMAIL AUTOMATICO (2026-05-19):
 *   Dopo la creazione del booking, viene inviata automaticamente la mail di
 *   conferma al cliente (TO) + CC a ns3000rent@gmail.com.
 *   In caso di errore email, la prenotazione viene comunque mantenuta
 *   e l'errore viene loggato in email_logs.
 */

// Fallback per retrocompatibilità con BA che non manda ancora l'header
const DEFAULT_PARTNER_SUPPLIER_ID = 'b245e2e7-9faa-4251-826c-e6cb239c6e7a' // Blu Alliance

function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('X-API-Key')
  const validKey = process.env.NS3000_EXTERNAL_API_KEY
  if (!validKey) return false
  return apiKey === validKey
}

// ⭐ Risolve quale partner ha effettuato la richiesta (per commission + settlement)
async function resolvePartnerSupplier(request: Request): Promise<{
  supplier: { id: string; name: string; commission_percentage: number; is_active: boolean } | null
  source: string
  error?: string
}> {
  const headerSupplierId = request.headers.get('X-Partner-Supplier-ID')
  const supplierId = headerSupplierId || DEFAULT_PARTNER_SUPPLIER_ID

  const { data: supplier, error } = await supabaseAdmin
    .from('suppliers')
    .select('id, name, commission_percentage, is_active')
    .eq('id', supplierId)
    .single()

  if (error || !supplier) {
    return { supplier: null, source: 'unknown', error: 'Supplier non trovato' }
  }

  if (!supplier.is_active) {
    return { supplier: null, source: 'unknown', error: 'Supplier non attivo' }
  }

  // Determina source dal nome del partner
  const nameLower = (supplier.name || '').toLowerCase()
  let source = 'partner'
  if (nameLower.includes('blu alliance') || nameLower.includes('blualliance')) {
    source = 'blualliance'
  } else if (nameLower.includes('salerno tourist') || nameLower.includes('tourist hub') || nameLower.includes('sth')) {
    source = 'salerno_tourist_hub'
  }

  return { supplier, source }
}

// ============================================
// GET - Lista prenotazioni (solo indisponibilità)
// ============================================
export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'API Key mancante o non valida' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const boatId = searchParams.get('boat_id')
    const source = searchParams.get('source')
    const updatedAfter = searchParams.get('updated_after')

   // ⭐ 2026-05-11 — Aggiunti campi pax/cliente/prezzo per planning BA
    // (collective con num_passengers, modal dettagli con dati cliente).
    // Esposizione legittima: già visibili a partner via API key autenticata.
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        id, booking_number, boat_id, booking_date, booking_end_date, time_slot,
        booking_status_id, source, external_id, external_ref,
        service_type, booking_type, service_id,
        num_passengers, num_minors,
        base_price, final_price, deposit_amount, balance_amount, caution_amount,
        notes,
        supplier_id,
        customers (id, first_name, last_name, email, phone),
        created_at, updated_at,
        boats(id, name, boat_type)
      `)
      .order('booking_date', { ascending: false })
    if (dateFrom) {
      query = query.or(`booking_date.gte.${dateFrom},booking_end_date.gte.${dateFrom}`)
    }
    if (dateTo) query = query.lte('booking_date', dateTo)
    if (boatId) query = query.eq('boat_id', boatId)
    if (source) query = query.eq('source', source)
     // ⭐ 2026-05-14 — Escludi booking annullate dal calendario disponibilità
    query = query.not('booking_status_id', 'in', '("79468a4e-b39e-456a-9ea0-0b4085ad662e","69db943f-96d3-4ae0-bb23-53c359e82433")') 
    if (updatedAfter) query = query.gte('updated_at', updatedAfter)

    const { data: bookings, error } = await query
    if (error) throw error

    return NextResponse.json({
      bookings: bookings || [],
      count: (bookings || []).length,
      generated_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('NS3000 External API - GET bookings error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}

// ============================================
// POST - Crea prenotazione da partner
// ============================================
export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'API Key mancante o non valida' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    // ⭐ FIX 27/04/2026: identifica il partner che ha chiamato l'API
    const { supplier, source: partnerSource, error: supplierError } = await resolvePartnerSupplier(request)

    if (!supplier) {
      return NextResponse.json(
        { error: 'Bad Request', message: supplierError || 'Partner non identificato' },
        { status: 400 }
      )
    }

    // Validazione campi obbligatori
    const required = ['boat_id', 'booking_date', 'time_slot', 'customer_name', 'customer_surname', 'customer_email', 'num_passengers']
    const missing = required.filter(f => !body[f])
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Campi mancanti: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    // 1. Verifica che la barca esista e sia attiva
    const { data: boat, error: boatError } = await supabaseAdmin
      .from('boats')
      .select('id, name, boat_type, is_active')
      .eq('id', body.boat_id)
      .single()

    if (boatError || !boat) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Barca non trovata' },
        { status: 404 }
      )
    }

    if (!boat.is_active) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Barca non attiva' },
        { status: 409 }
      )
    }

    // ⭐ FIX 2026-04-30: prima determina se questa prenotazione è collettiva
    // (auto-detect dal service_id come fatto al punto 6b, ma anticipato qui)
    let isCollectiveBooking = body.booking_type === 'collective' || body.service_type === 'collective'
    if (!isCollectiveBooking && body.service_id) {
      const { data: svcCheck } = await supabaseAdmin
        .from('rental_services')
        .select('service_type')
        .eq('id', body.service_id)
        .single()
      if (svcCheck?.service_type === 'collective') {
        isCollectiveBooking = true
      }
    }

    // 2. Verifica disponibilità prenotazioni esistenti
    const { data: existingBookings } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_number, time_slot, booking_type, service_type, service_id, num_passengers')
      .eq('boat_id', body.boat_id)
      .eq('booking_date', body.booking_date)

    if (existingBookings && existingBookings.length > 0) {
      // Helper per identificare prenotazioni collettive (sia da booking_type che da service_type)
      const isExistingCollective = (b: any) =>
        b.booking_type === 'collective' || b.service_type === 'collective'

      // ═══════════════════════════════════════════════════════════════════
      // ⭐ CASE 1: NUOVA prenotazione COLLETTIVA
      // Verifica capienza in collective_tour_boats e somma pax esistenti
      // ═══════════════════════════════════════════════════════════════════
      if (isCollectiveBooking && body.service_id) {
        // Conflitti con prenotazioni NON collettive (tour privati, locazioni)
        const sameSlotNonCollective = existingBookings.filter(b =>
          !isExistingCollective(b) &&
          (b.time_slot === body.time_slot || b.time_slot === 'full_day' || body.time_slot === 'full_day')
        )
        if (sameSlotNonCollective.length > 0) {
          return NextResponse.json(
            { error: 'Conflict', message: `Barca già prenotata per altro servizio (${sameSlotNonCollective[0].booking_number})` },
            { status: 409 }
          )
        }

        // Conflitti con altri tour collettivi (diverso service_id)
        const otherCollective = existingBookings.filter(b =>
          isExistingCollective(b) &&
          b.service_id !== body.service_id &&
          b.time_slot === body.time_slot
        )
        if (otherCollective.length > 0) {
          return NextResponse.json(
            { error: 'Conflict', message: `Barca già impegnata in altro tour collettivo` },
            { status: 409 }
          )
        }

        // Verifica capienza collettivo dalla tabella collective_tour_boats
        const { data: ctb } = await supabaseAdmin
          .from('collective_tour_boats')
          .select('max_passengers')
          .eq('boat_id', body.boat_id)
          .eq('service_id', body.service_id)
          .eq('is_active', true)
          .maybeSingle()

        if (!ctb) {
          return NextResponse.json(
            { error: 'Conflict', message: 'Questa barca non è abilitata per questo tour collettivo' },
            { status: 409 }
          )
        }

        const sameCollective = existingBookings.filter(b =>
          isExistingCollective(b) &&
          b.service_id === body.service_id &&
          b.time_slot === body.time_slot
        )
        const usedPax = sameCollective.reduce((sum, b) => sum + (b.num_passengers || 0), 0)
        const requestedPax = parseInt(body.num_passengers) || 1
        const remaining = Math.max(0, ctb.max_passengers - usedPax)

        if (remaining <= 0) {
          return NextResponse.json(
            { error: 'Conflict', message: `Tour collettivo pieno (${usedPax}/${ctb.max_passengers} pax)` },
            { status: 409 }
          )
        }

        if (requestedPax > remaining) {
          return NextResponse.json(
            { error: 'Conflict', message: `Posti insufficienti: richiesti ${requestedPax}, disponibili ${remaining} (${usedPax}/${ctb.max_passengers} occupati)` },
            { status: 409 }
          )
        }

        // ✅ Disponibile per collettivo, prosegui con la creazione
      } else {
        // ═══════════════════════════════════════════════════════════════════
        // ⭐ CASE 2: NUOVA prenotazione NON collettiva (logica originale)
        // ═══════════════════════════════════════════════════════════════════
        const hasFullDay = existingBookings.some(b => b.time_slot === 'full_day')
        const hasMorning = existingBookings.some(b => b.time_slot === 'morning')
        const hasAfternoon = existingBookings.some(b => b.time_slot === 'afternoon')

        if (hasFullDay) {
          return NextResponse.json(
            { error: 'Conflict', message: 'Barca già prenotata full day per questa data' },
            { status: 409 }
          )
        }
        if (body.time_slot === 'full_day' && (hasMorning || hasAfternoon)) {
          return NextResponse.json(
            { error: 'Conflict', message: 'Barca già prenotata per mezza giornata' },
            { status: 409 }
          )
        }
        if (body.time_slot === 'morning' && hasMorning) {
          return NextResponse.json(
            { error: 'Conflict', message: 'Mattina già prenotata' },
            { status: 409 }
          )
        }
        if (body.time_slot === 'afternoon' && hasAfternoon) {
          return NextResponse.json(
            { error: 'Conflict', message: 'Pomeriggio già prenotato' },
            { status: 409 }
          )
        }
      }
    }

    // 3. Verifica indisponibilità
    const { data: unavail } = await supabaseAdmin
      .from('unavailabilities')
      .select('id')
      .eq('boat_id', body.boat_id)
      .lte('date_from', body.booking_date)
      .gte('date_to', body.booking_date)

    if (unavail && unavail.length > 0) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Barca non disponibile per questa data' },
        { status: 409 }
      )
    }

    // 3b. Controlla assegnazioni tour collettivi (blocca se barca è già assegnata a collettivo)
    if (body.booking_type !== 'collective') {
      const { data: collectiveAssignments } = await supabaseAdmin
        .from('collective_boat_assignments')
        .select('id')
        .eq('boat_id', body.boat_id)
        .eq('booking_date', body.booking_date)

      if (collectiveAssignments && collectiveAssignments.length > 0) {
        return NextResponse.json(
          { error: 'Conflict', message: 'Barca assegnata a tour collettivo per questa data' },
          { status: 409 }
        )
      }
    }

    // 4. Cerca o crea customer
    let customerId: string

    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', body.customer_email)
      .maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
      // ⭐ 2026-05-14 — Aggiorna documenti su customer esistente
      if (body.document_type || body.document_number || body.phone) {
        await supabaseAdmin
          .from('customers')
          .update({
            phone: body.customer_phone || null,
            document_type: body.document_type || null,
            document_number: body.document_number || null,
            document_expiry: body.document_expiry || null,
          })
          .eq('id', customerId)
      }
    } else {
      const { data: newCustomer, error: customerError } = await supabaseAdmin
        .from('customers')
        .insert([{
          first_name: body.customer_name,
          last_name: body.customer_surname,
          email: body.customer_email,
          phone: body.customer_phone || null,
          // ⭐ 2026-05-14 — Documenti da BA
          document_type: body.document_type || null,
          document_number: body.document_number || null,
          document_expiry: body.document_expiry || null,
        }])
        .select()
        .single()

      if (customerError) throw customerError
      customerId = newCustomer.id
    }

    // 5. Determina il codice prenotazione
    // ⭐ FIX 27/04/2026: prefisso dinamico per partner (BA-, STH-, ecc.)
    const externalRef = body.external_ref || null
    const partnerPrefix = partnerSource === 'salerno_tourist_hub' ? 'STH' : 'BA'
    
    let bookingNumber: string
    if (externalRef) {
      // Se BA/STH ci manda già il loro ref, lo manteniamo
      const cleanRef = externalRef.replace(/^(BA|STH)[-]?/i, '')
      bookingNumber = `${partnerPrefix}-${cleanRef}`
    } else {
      bookingNumber = `${partnerPrefix}-${Date.now().toString(36).toUpperCase()}`
    }

    // 6. Calcola prezzo e commissione (DINAMICA da DB!)
    const finalPrice = parseFloat(body.price) || parseFloat(body.final_price) || 0
    const basePrice = parseFloat(body.base_price) || finalPrice

    // ⭐ FIX 27/04/2026: commissione letta da scheda supplier (non più hardcoded)
    const commissionPct = supplier.commission_percentage || 0
    const commissionAmount = parseFloat(
      ((finalPrice * commissionPct) / 100).toFixed(2)
    )
    const netAmount = parseFloat((finalPrice - commissionAmount).toFixed(2))

    // Pagamenti dal payload
    const depositAmount =
      parseFloat(body.deposit_amount) ||
      parseFloat(body.caparra_ricevuta) ||
      0
    const balanceAmount =
      parseFloat(body.balance_amount) ||
      parseFloat(body.saldo_ricevuto) ||
      0
    const cautionAmount =
      parseFloat(body.caution_amount) || 0

    // 6b. Auto-detect collettivo dal servizio
    let resolvedTimeSlot = body.time_slot || 'full_day'
    let resolvedBookingType = body.booking_type || 'tour'
    let resolvedServiceType = body.service_type || 'charter'

    if (body.service_id) {
      const { data: svc } = await supabaseAdmin
        .from('rental_services')
        .select('service_type, name')
        .eq('id', body.service_id)
        .single()

      if (svc?.service_type === 'collective') {
        resolvedBookingType = 'collective'; resolvedServiceType = 'collective'; resolvedTimeSlot = 'full_day'
      } else if (svc?.service_type === 'rental') {
        resolvedBookingType = 'rental'; resolvedServiceType = 'rental'
      } else if (svc?.service_type === 'transfer') {
        resolvedBookingType = 'transfer'; resolvedServiceType = 'transfer'
      } else if (svc?.service_type === 'tour') {
        resolvedBookingType = 'tour'; resolvedServiceType = 'charter'
      }
    }

    // 7. Inserisci prenotazione
    const { data: newBooking, error: insertError } = await supabaseAdmin
      .from('bookings')
      .insert([{
        booking_number: bookingNumber,
        boat_id: body.boat_id,
        customer_id: customerId,
        booking_date: body.booking_date,
        booking_end_date: body.booking_end_date || body.booking_date,
        time_slot: resolvedTimeSlot,
        num_passengers: body.num_passengers,
        num_minors: body.num_minors || null,
        base_price: basePrice,
        final_price: finalPrice,
        deposit_amount: depositAmount,
        balance_amount: balanceAmount,
        caution_amount: cautionAmount || null,
        booking_status_id: 'ab4bad3b-2f9f-4a0b-a867-54f9f1efc470', // confermata
        notes: body.notes || null,
        internal_notes: body.internal_notes || null,
        service_id: body.service_id || null,
        service_type: resolvedServiceType,
        booking_type: resolvedBookingType,
        booking_source: partnerSource,
        source: partnerSource,
        external_id: body.external_id || null,
        external_ref: externalRef,
        // ⭐ Campi partner (dinamici)
        // ⭐ 2026-05-14 — Documenti cliente da BA
        document_type: body.document_type || null,
        document_number: body.document_number || null,
        document_expiry: body.document_expiry || null,
        has_license: body.has_license || false,
        license_number: body.license_number || null,
        license_expiry: body.license_expiry || null,
        // ⭐ 2026-05-14 — Tracciamento operatore + porti
        created_by_name: body.created_by_name || null,
        boarding_port: body.boarding_port || null,
        disembark_port: body.disembark_port || body.boarding_port || null,
        supplier_id: supplier.id,
        supplier_commission_percentage: commissionPct,
        supplier_commission_amount: commissionAmount,
        // ⭐ Settlement (NUOVO 27/04/2026)
        settlement_status: 'pending',
        lang: body.lang || 'it',
      }])
      .select()
      .single()

    if (insertError) throw insertError

    // ============================================
    // ⭐ 2026-05-19 — INVIO EMAIL AUTOMATICO
    // ============================================
    // Manda mail di conferma al cliente (TO) + ns3000rent@gmail.com (CC)
    // Try/catch isolato: in caso di errore, la prenotazione resta creata
    // e l'errore viene loggato in email_logs (NO rollback)
    try {
      // Carica nome servizio (se presente)
      let serviceName = body.service_name || ''
      let serviceDescription: string | undefined = undefined
      let serviceType: string | undefined = undefined
      if (newBooking.service_id) {
        const { data: svc } = await supabaseAdmin
          .from('rental_services')
          .select('name, description, service_type')
          .eq('id', newBooking.service_id)
          .single()
        if (svc) {
          serviceName = svc.name || serviceName
          serviceDescription = svc.description || undefined
          serviceType = svc.service_type || undefined
        }
      }
      // Fallback se nessun service caricato
      if (!serviceName) {
        serviceName = resolvedBookingType === 'collective' ? 'Tour Collettivo' : 'Noleggio'
      }

      const emailData = {
        booking_number: newBooking.booking_number,
        customer: {
          first_name: body.customer_name,
          last_name: body.customer_surname,
          email: body.customer_email,
          phone: body.customer_phone || undefined,
        },
        boat: {
          name: boat.name,
          boat_type: boat.boat_type || undefined,
        },
        service: {
          name: serviceName,
          description: serviceDescription,
          service_type: serviceType,
        },
        booking_date: newBooking.booking_date,
        time_slot: newBooking.time_slot || 'full_day',
        num_passengers: newBooking.num_passengers || 1,
        num_minors: newBooking.num_minors || undefined,
        final_price: newBooking.final_price || 0,
        deposit_amount: newBooking.deposit_amount || 0,
        balance_amount: newBooking.balance_amount || 0,
        caution_amount: newBooking.caution_amount || undefined,
        notes: newBooking.notes || undefined,
        lang: newBooking.lang || 'it',
      }

      const emailResult = await sendBookingConfirmation(emailData)

      // Log success
      await supabaseAdmin
        .from('email_logs')
        .insert({
          booking_id: newBooking.id,
          email_to: body.customer_email,
          email_type: 'booking_confirmation_auto',
          sent_at: new Date().toISOString(),
          success: true,
          email_id: emailResult.emailId,
        })
        .then(() => console.log('✅ Email auto inviata + log salvato:', emailResult.emailId))
        .catch((err) => console.warn('⚠️ Email auto inviata ma log non salvato:', err))

    } catch (emailErr: any) {
      // L'errore email NON deve far fallire la creazione booking
      console.error('⚠️ Errore invio email automatica (booking creato comunque):', emailErr?.message || emailErr)

      // Log failure (best effort)
      await supabaseAdmin
        .from('email_logs')
        .insert({
          booking_id: newBooking.id,
          email_to: body.customer_email,
          email_type: 'booking_confirmation_auto',
          sent_at: new Date().toISOString(),
          success: false,
          error_message: emailErr?.message || String(emailErr),
        })
        .then(() => console.log('✅ Log errore email salvato'))
        .catch((err) => console.warn('⚠️ Log errore email non salvato:', err))
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: newBooking.id,
        booking_number: newBooking.booking_number,
        boat_id: newBooking.boat_id,
        boat_name: boat.name,
        booking_date: newBooking.booking_date,
        time_slot: newBooking.time_slot,
        booking_type: newBooking.booking_type,
        final_price: newBooking.final_price,
        deposit_amount: newBooking.deposit_amount,
        balance_amount: newBooking.balance_amount,
        caution_amount: newBooking.caution_amount,
        source: newBooking.source,
        // ⭐ Info partner + settlement nella response
        partner: {
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          commission_percentage: commissionPct,
          commission_amount: commissionAmount,
          net_amount: netAmount,
        },
        settlement_status: newBooking.settlement_status,
        external_id: newBooking.external_id,
        external_ref: newBooking.external_ref,
        created_at: newBooking.created_at,
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('NS3000 External API - POST booking error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}
// ============================================
// PATCH - Aggiorna prenotazione partner esistente (sync modifiche da BA)
// Identifica per {id} = id NS3000 (ns3000_booking_id lato BA).
// Ricalcola capienza collettivo ESCLUDENDO la prenotazione corrente.
// NON invia notifiche (e un update).
// ============================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id: bookingId } = await params
    const body = await request.json()

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('bookings')
      .select('id, boat_id, booking_date, time_slot, service_id, num_passengers, booking_type, service_type, booking_status_id')
      .eq('id', bookingId)
      .single()
    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not Found', message: 'Prenotazione NS3000 non trovata' }, { status: 404 })
    }

    const STATUS_MAP: Record<string, string> = {
      'in_attesa': '5051f7bd-c062-4e63-9e30-4336c37be226',
      'confermata': 'ab4bad3b-2f9f-4a0b-a867-54f9f1efc470',
      'completata': 'e7798e9d-fcea-4f91-9661-454e403e673e',
      'annullata': '69db943f-96d3-4ae0-bb23-53c359e82433',
    }

    const newPax = body.num_passengers != null ? parseInt(body.num_passengers) : existing.num_passengers
    const isCollective = (existing.service_type === 'collective' || existing.booking_type === 'collective')

    if (isCollective && newPax !== existing.num_passengers) {
      const { data: ctb } = await supabaseAdmin
        .from('collective_tour_boats')
        .select('max_passengers')
        .eq('boat_id', existing.boat_id)
        .eq('service_id', existing.service_id)
        .maybeSingle()
      if (ctb) {
        const { data: sameDay } = await supabaseAdmin
          .from('bookings')
          .select('id, num_passengers, service_id, time_slot, booking_type, service_type, booking_status_id')
          .eq('boat_id', existing.boat_id)
          .eq('booking_date', existing.booking_date)
          .neq('id', bookingId)
          .not('booking_status_id', 'in', '("79468a4e-b39e-456a-9ea0-0b4085ad662e","69db943f-96d3-4ae0-bb23-53c359e82433")')
        const sameCollective = (sameDay || []).filter(b =>
          (b.service_type === 'collective' || b.booking_type === 'collective') &&
          b.service_id === existing.service_id &&
          b.time_slot === existing.time_slot
        )
        const usedPax = sameCollective.reduce((sum, b) => sum + (b.num_passengers || 0), 0)
        const remaining = Math.max(0, ctb.max_passengers - usedPax)
        if (newPax > remaining) {
          return NextResponse.json({ error: 'Conflict', message: 'Posti insufficienti: richiesti ' + newPax + ', disponibili ' + remaining + ' (' + usedPax + '/' + ctb.max_passengers + ' occupati da altre prenotazioni)' }, { status: 409 })
        }
      }
    }

    const updateData: Record<string, any> = {}
    if (body.boat_id != null) updateData.boat_id = body.boat_id
    if (body.service_id != null) updateData.service_id = body.service_id
    if (body.num_passengers != null) updateData.num_passengers = newPax
    if (body.num_minors != null) updateData.num_minors = body.num_minors
    if (body.price != null || body.final_price != null) {
      const fp = parseFloat(body.price) || parseFloat(body.final_price) || 0
      updateData.final_price = fp; updateData.base_price = fp
    }
    if (body.deposit_amount != null) updateData.deposit_amount = parseFloat(body.deposit_amount) || 0
    if (body.balance_amount != null) updateData.balance_amount = parseFloat(body.balance_amount) || 0
    if (body.notes !== undefined) updateData.notes = body.notes || null
    if (body.internal_notes !== undefined) updateData.internal_notes = body.internal_notes || null
    if (body.boarding_port !== undefined) updateData.boarding_port = body.boarding_port || null
    if (body.disembark_port !== undefined) updateData.disembark_port = body.disembark_port || null
    if (body.lang) updateData.lang = body.lang
    if (body.booking_date) updateData.booking_date = body.booking_date
    if (body.time_slot) updateData.time_slot = body.time_slot
    if (body.stato && STATUS_MAP[body.stato]) updateData.booking_status_id = STATUS_MAP[body.stato]
    if (body.document_type !== undefined) updateData.document_type = body.document_type || null
    if (body.document_number !== undefined) updateData.document_number = body.document_number || null
    if (body.document_expiry !== undefined) updateData.document_expiry = body.document_expiry || null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, message: 'Nessun campo da aggiornare', booking: existing })
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('bookings').update(updateData).eq('id', bookingId).select().single()
    if (updErr) {
      console.error('[external PATCH] Errore update:', updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
    console.log('[external PATCH] Prenotazione aggiornata:', bookingId, updateData)
    return NextResponse.json({ success: true, booking: updated })
  } catch (error: any) {
    console.error('NS3000 External API - PATCH booking error:', error)
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 })
  }
}