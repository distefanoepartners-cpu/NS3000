import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Logica settlement applicata ai calcoli incasso/da-incassare:
 *
 *   settlement_status                 incassato_ns3000              da_incassare_ns3000
 *   ─────────────────────────────────────────────────────────────────────────────────
 *   'not_applicable' (NS3000)         deposit + balance              final_price - incassato
 *   'pending' o 'reported' (partner)  0 (BA ha incassato, non NS)    final_price - commission (netto)
 *   'settled' (partner pagato)        final_price - commission       0
 *
 * "Lordo cliente" è sempre `final_price` (anche per partner) — è quanto ha pagato il cliente.
 */
function computeAmounts(b: any) {
  const finalPrice  = Number(b.final_price || 0)
  const depositAmt  = Number(b.deposit_amount || 0)
  const balanceAmt  = Number(b.balance_amount || 0)
  const commission  = Number(b.supplier_commission_amount || 0)
  const settlement  = b.settlement_status || 'not_applicable'

  let incassato_ns3000 = 0
  let da_incassare_ns3000 = 0
  let netto_partner = 0
  let lordo_cliente = finalPrice

  if (settlement === 'not_applicable') {
    // Prenotazione interna NS3000
    incassato_ns3000     = depositAmt + balanceAmt
    da_incassare_ns3000  = Math.max(0, finalPrice - incassato_ns3000)
  } else if (settlement === 'pending' || settlement === 'reported') {
    // Partner ha incassato, NS3000 attende
    netto_partner        = finalPrice - commission
    incassato_ns3000     = 0
    da_incassare_ns3000  = netto_partner
  } else if (settlement === 'settled') {
    // Partner ha già pagato NS3000
    netto_partner        = finalPrice - commission
    incassato_ns3000     = netto_partner
    da_incassare_ns3000  = 0
  }

  return {
    lordo_cliente,
    incassato_ns3000,
    da_incassare_ns3000,
    netto_partner,
    commission,
    settlement,
    is_partner: settlement !== 'not_applicable',
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    const currentStart = `${year}-${String(month).padStart(2, '0')}-01`
    const currentEnd   = new Date(year, month, 0).toISOString().split('T')[0]

    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear  = month === 1 ? year - 1 : year
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const prevEnd   = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0]

    const [
      { data: currentBookings, error: e1 },
      { data: prevBookings,    error: e2 },
      { data: statuses,        error: e3 },
      { data: paymentMethods,  error: e4 },
      { data: boats,           error: e5 },
      { data: services,        error: e6 },
      { data: customers,       error: e7 },
      { data: skippers,        error: e8 },
      { data: suppliers,       error: e9 },
    ] = await Promise.all([
      supabase.from('bookings')
        .select('id, booking_number, booking_date, time_slot, final_price, deposit_amount, balance_amount, booking_status_id, deposit_payment_method_id, balance_payment_method_id, boat_id, service_id, customer_id, skipper_id, num_passengers, source, supplier_id, supplier_commission_percentage, supplier_commission_amount, settlement_status, settlement_paid_at')
        .gte('booking_date', currentStart)
        .lte('booking_date', currentEnd),
      supabase.from('bookings')
        .select('final_price, deposit_amount, balance_amount, booking_status_id, supplier_commission_amount, settlement_status')
        .gte('booking_date', prevStart)
        .lte('booking_date', prevEnd),
      supabase.from('booking_statuses').select('id, code, name'),
      supabase.from('payment_methods').select('id, code, name'),
      supabase.from('boats').select('id, name'),
      supabase.from('rental_services').select('id, name'),
      supabase.from('customers').select('id, first_name, last_name'),
      supabase.from('skippers').select('id, first_name, last_name'),
      supabase.from('suppliers').select('id, name, commission_percentage'),
    ])

    for (const [e, label] of [[e1,'bookings'],[e2,'prev_bookings'],[e3,'statuses'],[e4,'payment_methods'],[e5,'boats'],[e6,'services'],[e7,'customers'],[e8,'skippers'],[e9,'suppliers']] as const) {
      if (e) throw new Error(`${label}: ${(e as any).message}`)
    }

    const statusById   = Object.fromEntries((statuses       || []).map(s => [s.id, s]))
    const paymentById  = Object.fromEntries((paymentMethods || []).map(p => [p.id, p]))
    const boatById     = Object.fromEntries((boats          || []).map(b => [b.id, b]))
    const serviceById  = Object.fromEntries((services       || []).map(s => [s.id, s]))
    const customerById = Object.fromEntries((customers      || []).map(c => [c.id, c]))
    const skipperById  = Object.fromEntries((skippers       || []).map(s => [s.id, s]))
    const supplierById = Object.fromEntries((suppliers      || []).map(s => [s.id, s]))

    const enrich = (b: any) => ({
      ...b,
      status:          statusById[b.booking_status_id]              || null,
      deposit_payment: paymentById[b.deposit_payment_method_id]     || null,
      balance_payment: paymentById[b.balance_payment_method_id]     || null,
      boat:            boatById[b.boat_id]                          || null,
      service:         serviceById[b.service_id]                    || null,
      customer:        customerById[b.customer_id]                  || null,
      skipper:         skipperById[b.skipper_id]                    || null,
      supplier:        supplierById[b.supplier_id]                  || null,
    })

    const current = (currentBookings || []).map(enrich).filter(b => !['cancelled', 'cancelled_final'].includes(b.status?.code ?? ''))
    const prev    = (prevBookings    || []).map(b => ({ ...b, status: statusById[b.booking_status_id] || null }))
                      .filter(b => !['cancelled', 'cancelled_final'].includes(b.status?.code ?? ''))

    // ⭐ FIX 27/04/2026: usa logica settlement-aware per calcoli incasso
    function calcTotals(rows: any[]) {
      let totale_lordo            = 0  // somma final_price (cliente ha pagato)
      let totale_incassato_ns3000 = 0  // soldi davvero entrati in cassa NS3000
      let totale_da_incassare     = 0  // attesi (sia da clienti che da partner)
      let totale_da_partner       = 0  // attesi specificamente da partner

      rows.forEach(b => {
        const a = computeAmounts(b)
        totale_lordo            += a.lordo_cliente
        totale_incassato_ns3000 += a.incassato_ns3000
        totale_da_incassare     += a.da_incassare_ns3000
        if (a.is_partner && (a.settlement === 'pending' || a.settlement === 'reported')) {
          totale_da_partner += a.netto_partner
        }
      })

      return {
        count: rows.length,
        totale_importo:      totale_lordo,             // mantenuto per retrocompatibilità (= lordo)
        totale_incassato:    totale_incassato_ns3000,  // ⭐ ora rappresenta SOLO l'incasso NS3000
        totale_da_incassare: totale_da_incassare,
        totale_da_partner:   totale_da_partner,        // ⭐ NUOVO
      }
    }

    const totCurrent = calcTotals(current)
    const totPrev    = calcTotals(prev)

    // ⭐ Breakdown per metodo pagamento — ora considera solo incasso reale NS3000
    const paymentMap: Record<string, { name: string; count: number; importo: number; incassato: number }> = {}
    current.forEach(b => {
      const a = computeAmounts(b)
      // Per partner pending/reported, salta il breakdown payment method
      // (non ha senso classificarlo per metodo, il pagamento avverrà via bonifico)
      if (a.is_partner && a.settlement !== 'settled') return

      const pm = b.deposit_payment || b.balance_payment
      const code = pm?.code || 'non_specificato'
      const name = pm?.name || 'Non specificato'
      if (!paymentMap[code]) paymentMap[code] = { name, count: 0, importo: 0, incassato: 0 }
      paymentMap[code].count++
      paymentMap[code].importo   += a.lordo_cliente
      paymentMap[code].incassato += a.incassato_ns3000
    })

    // Breakdown per barca (lordo come prima — è il fatturato della barca)
    const boatMap: Record<string, { name: string; count: number; importo: number; incassato: number }> = {}
    current.forEach(b => {
      const a = computeAmounts(b)
      const id   = b.boat?.id   || 'n/a'
      const name = b.boat?.name || 'Sconosciuta'
      if (!boatMap[id]) boatMap[id] = { name, count: 0, importo: 0, incassato: 0 }
      boatMap[id].count++
      boatMap[id].importo   += a.lordo_cliente
      boatMap[id].incassato += a.incassato_ns3000
    })

    // Breakdown per servizio
    const serviceMap: Record<string, { name: string; count: number; importo: number; incassato: number }> = {}
    current.forEach(b => {
      const a = computeAmounts(b)
      const id   = b.service?.id   || 'n/a'
      const name = b.service?.name || 'Sconosciuto'
      if (!serviceMap[id]) serviceMap[id] = { name, count: 0, importo: 0, incassato: 0 }
      serviceMap[id].count++
      serviceMap[id].importo   += a.lordo_cliente
      serviceMap[id].incassato += a.incassato_ns3000
    })

    // ⭐ NUOVO: Breakdown per partner
    const partnerMap: Record<string, {
      id: string;
      name: string;
      commission_pct: number;
      bookings_count: number;
      lordo: number;          // somma final_price clienti
      commission_total: number;  // somma provvigioni
      netto: number;          // lordo - commission (= da incassare totale)
      pending: number;        // di cui ancora pending/reported
      settled: number;        // di cui settled
    }> = {}

    current.forEach(b => {
      const a = computeAmounts(b)
      if (!a.is_partner || !b.supplier) return

      const id = b.supplier.id
      if (!partnerMap[id]) {
        partnerMap[id] = {
          id,
          name: b.supplier.name,
          commission_pct: Number(b.supplier.commission_percentage || 0),
          bookings_count: 0,
          lordo: 0,
          commission_total: 0,
          netto: 0,
          pending: 0,
          settled: 0,
        }
      }
      partnerMap[id].bookings_count++
      partnerMap[id].lordo            += a.lordo_cliente
      partnerMap[id].commission_total += a.commission
      partnerMap[id].netto            += a.netto_partner

      if (a.settlement === 'pending' || a.settlement === 'reported') {
        partnerMap[id].pending += a.netto_partner
      } else if (a.settlement === 'settled') {
        partnerMap[id].settled += a.netto_partner
      }
    })

    // Breakdown per stato (tutti, incluse cancelled)
    const statusMap: Record<string, { name: string; count: number; importo: number }> = {}
    ;(currentBookings || []).forEach(b => {
      const s    = statusById[b.booking_status_id]
      const code = s?.code || 'unknown'
      const name = s?.name || 'Sconosciuto'
      if (!statusMap[code]) statusMap[code] = { name, count: 0, importo: 0 }
      statusMap[code].count++
      statusMap[code].importo += Number(b.final_price || 0)
    })

    // Dettaglio giornaliero
    const daily_detail = current
      .sort((a, b) => a.booking_date.localeCompare(b.booking_date))
      .map(b => {
        const a = computeAmounts(b)

        return {
          booking_number: b.booking_number || '',
          booking_date:   b.booking_date,
          time_slot:      b.time_slot || '',
          customer_name:  b.customer ? `${b.customer.first_name} ${b.customer.last_name}` : 'N/D',
          boat_name:      b.boat?.name || 'N/D',
          service_name:   b.service?.name || 'N/D',
          skipper_name:   b.skipper ? `${b.skipper.first_name} ${b.skipper.last_name}` : '',
          num_passengers: b.num_passengers || 0,
          status_name:    b.status?.name || 'N/D',
          status_code:    b.status?.code || '',
          final_price:    a.lordo_cliente,
          deposit_amount: Number(b.deposit_amount || 0),
          balance_amount: Number(b.balance_amount || 0),
          incassato:      a.incassato_ns3000,
          da_incassare:   a.da_incassare_ns3000,
          deposit_method: b.deposit_payment?.name || '',
          balance_method: b.balance_payment?.name || '',
          // ⭐ NUOVO: campi partner
          source:                b.source || 'ns3000',
          settlement_status:     a.settlement,
          partner_name:          b.supplier?.name || '',
          commission_pct:        Number(b.supplier_commission_percentage || 0),
          commission_amount:     a.commission,
          netto_partner:         a.netto_partner,
          is_partner:            a.is_partner,
        }
      })

    return NextResponse.json({
      period: { year, month, currentStart, currentEnd },
      current: totCurrent,
      prev:    totPrev,
      delta: {
        count:            totCurrent.count            - totPrev.count,
        totale_importo:   totCurrent.totale_importo   - totPrev.totale_importo,
        totale_incassato: totCurrent.totale_incassato - totPrev.totale_incassato,
        perc_importo: totPrev.totale_importo > 0
          ? Math.round(((totCurrent.totale_importo - totPrev.totale_importo) / totPrev.totale_importo) * 100)
          : null
      },
      by_payment: Object.entries(paymentMap).map(([code, v]) => ({ code, ...v })).sort((a, b) => b.importo - a.importo),
      by_boat:    Object.entries(boatMap).map(([id, v])     => ({ id,   ...v })).sort((a, b) => b.importo - a.importo),
      by_service: Object.entries(serviceMap).map(([id, v])  => ({ id,   ...v })).sort((a, b) => b.importo - a.importo),
      by_status:  Object.entries(statusMap).map(([code, v]) => ({ code, ...v })),
      // ⭐ NUOVO: breakdown per partner
      by_partner: Object.values(partnerMap).sort((a, b) => b.netto - a.netto),
      daily_detail,
    })

  } catch (error: any) {
    console.error('Statistics API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}