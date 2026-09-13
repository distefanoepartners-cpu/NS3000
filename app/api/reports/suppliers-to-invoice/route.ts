// app/api/reports/suppliers-to-invoice/route.ts
//
// Report fatturazione mensile fornitori.
// Mostra tutte le prenotazioni canale 'fornitore' in stati "operativi"
// (Confermata, In Corso, Da Fatturare) raggruppate per fornitore e mese.
// Esclude: In Attesa, Da Recuperare, Chiusa (già fatturate), Annullata.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// ⭐ 2026-05-22: Stati che indicano "prestazione da fatturare al fornitore"
//   - confirmed:  prestazione confermata, già o sta per essere erogata
//   - in_progress: prestazione in svolgimento
//   - to_invoice: etichetta esplicita "Da Fatturare"
// Escluso: pending (non confermata), cancelled (Da Recuperare),
//          completed (Chiusa = già fatturata), cancelled_final (Annullata)
const INVOICEABLE_STATUS_CODES = ['confirmed', 'in_progress', 'to_invoice']

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // 'YYYY-MM'
    const supplierIdFilter = searchParams.get('supplier_id')

    // 1. Risolvi gli id degli stati "fatturabili"
    const { data: statusRows, error: statusError } = await supabaseAdmin
      .from('booking_statuses')
      .select('id, code')
      .in('code', INVOICEABLE_STATUS_CODES)

    if (statusError) throw statusError
    if (!statusRows || statusRows.length === 0) {
      return NextResponse.json({ error: 'Stati fatturabili non trovati' }, { status: 500 })
    }

    const invoiceableStatusIds = statusRows.map(s => s.id)

    // 2. Query bookings con filtro stati + supplier
    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select(`
        id,
        booking_number,
        booking_date,
        final_price,
        supplier_id,
        booking_status_id,
        customer:customers(id, first_name, last_name),
        boat:boats(id, name),
        service:rental_services(id, name),
        booking_status:booking_statuses(id, name, code)
      `)
      .in('booking_status_id', invoiceableStatusIds)
      .not('supplier_id', 'is', null)
      .order('booking_date', { ascending: true })

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number)
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      const lastDay = new Date(y, m, 0).getDate()
      const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      bookingsQuery = bookingsQuery.gte('booking_date', start).lte('booking_date', end)
    }

    if (supplierIdFilter) {
      bookingsQuery = bookingsQuery.eq('supplier_id', supplierIdFilter)
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery
    if (bookingsError) throw bookingsError

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ groups: [], total_bookings: 0, total_revenue: 0 })
    }

    // 3. Carica anagrafica fornitori in un colpo
    const supplierIds = Array.from(new Set(bookings.map((b: any) => b.supplier_id).filter(Boolean)))
    const { data: suppliers, error: suppliersError } = await supabaseAdmin
      .from('suppliers')
      .select('id, name, email, vat_number, commission_percentage, business_name, sdi_code, pec_email')
      .in('id', supplierIds)

    if (suppliersError) throw suppliersError

    const supplierById: Record<string, any> = {}
    ;(suppliers || []).forEach((s: any) => { supplierById[s.id] = s })

    // 4. Raggruppa per supplier + mese
    type MonthGroup = {
      month: string
      bookings: any[]
      total_revenue: number
      total_commission: number
    }
    type SupplierGroup = {
      supplier: any
      months: Record<string, MonthGroup>
      total_revenue: number
      total_bookings: number
      total_commission: number
    }

    const groups: Record<string, SupplierGroup> = {}

    for (const b of bookings as any[]) {
      const sid = b.supplier_id
      if (!sid) continue

      const supplier = supplierById[sid] || { id: sid, name: 'Fornitore sconosciuto', commission_percentage: 0 }
      const bookingMonth = (b.booking_date || '').substring(0, 7)

      if (!groups[sid]) {
        groups[sid] = {
          supplier,
          months: {},
          total_revenue: 0,
          total_bookings: 0,
          total_commission: 0,
        }
      }
      const sGroup = groups[sid]

      if (!sGroup.months[bookingMonth]) {
        sGroup.months[bookingMonth] = {
          month: bookingMonth,
          bookings: [],
          total_revenue: 0,
          total_commission: 0,
        }
      }
      const mGroup = sGroup.months[bookingMonth]

      const price = parseFloat(b.final_price || 0)
      const commissionPct = parseFloat(supplier.commission_percentage || 0)
      const commission = parseFloat(((price * commissionPct) / 100).toFixed(2))

      mGroup.bookings.push({
        id: b.id,
        booking_number: b.booking_number,
        booking_date: b.booking_date,
        final_price: price,
        commission_amount: commission,
        customer_name: b.customer ? `${b.customer.first_name || ''} ${b.customer.last_name || ''}`.trim() : '',
        boat_name: b.boat?.name || '',
        service_name: b.service?.name || '',
        booking_status_name: b.booking_status?.name || '',
        booking_status_code: b.booking_status?.code || '',
      })
      mGroup.total_revenue += price
      mGroup.total_commission += commission

      sGroup.total_revenue += price
      sGroup.total_bookings += 1
      sGroup.total_commission += commission
    }

    const groupsArr = Object.values(groups)
      .map((g: any) => ({
        ...g,
        months: Object.values(g.months).sort((a: any, b: any) => b.month.localeCompare(a.month)),
      }))
      .sort((a: any, b: any) => (a.supplier.name || '').localeCompare(b.supplier.name || '', 'it'))

    const totalBookings = bookings.length
    const totalRevenue = bookings.reduce((sum: number, b: any) => sum + parseFloat(b.final_price || 0), 0)

    return NextResponse.json({
      groups: groupsArr,
      total_bookings: totalBookings,
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      filter_month: month || null,
      filter_supplier_id: supplierIdFilter || null,
    })
  } catch (error: any) {
    console.error('Error suppliers-to-invoice:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}