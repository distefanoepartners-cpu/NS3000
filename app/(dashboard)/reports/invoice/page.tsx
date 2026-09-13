'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

type BookingRow = {
  id: string
  booking_number: string
  booking_date: string
  final_price: number
  commission_amount: number
  customer_name: string
  boat_name: string
  service_name: string
  booking_status_name?: string
  booking_status_code?: string
}

type MonthGroup = {
  month: string
  bookings: BookingRow[]
  total_revenue: number
  total_commission: number
}

type SupplierGroup = {
  supplier: {
    id: string
    name: string
    email: string | null
    vat_number: string | null
    commission_percentage: number
    business_name: string | null
    sdi_code: string | null
    pec_email: string | null
  }
  months: MonthGroup[]
  total_revenue: number
  total_bookings: number
  total_commission: number
}

type ReportData = {
  groups: SupplierGroup[]
  total_bookings: number
  total_revenue: number
  filter_month: string | null
  filter_supplier_id: string | null
}

function getMonthName(monthStr: string) {
  const [y, m] = monthStr.split('-')
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

function getCurrentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function InvoiceReportPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth())
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'cancelled' | 'pending' | 'all'>('open')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    loadReport()
  }, [selectedMonth, selectedSupplierId, statusFilter])

  async function loadSuppliers() {
    try {
      const res = await fetch('/api/suppliers')
      const list = await res.json()
      setSuppliers(list.filter((s: any) => s.is_active))
    } catch {
      // silenzioso
    }
  }

  async function loadReport() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedMonth) params.append('month', selectedMonth)
      if (selectedSupplierId) params.append('supplier_id', selectedSupplierId)
      if (statusFilter) params.append('status_filter', statusFilter)

      const res = await fetch(`/api/reports/suppliers-to-invoice?${params.toString()}`)
      const result = await res.json()
      setData(result)
    } catch (err: any) {
      toast.error('Errore caricamento report: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleMonth(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleMarkInvoiced(bookingIds: string[], label: string) {
    if (bookingIds.length === 0) return
    if (!confirm(
      `Marcare ${bookingIds.length} prenotazione/i di ${label} come Fatturate?\n\n` +
      `Le prenotazioni passeranno dallo stato "Da Fatturare" a "Chiusa".\n` +
      `Questa azione è reversibile manualmente dalla scheda prenotazione.`
    )) return

    try {
      setMarking(true)
      const res = await fetch('/api/bookings/mark-invoiced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_ids: bookingIds }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Errore aggiornamento')

      toast.success(`✅ Marcate come Fatturate: ${result.updated_count} prenotazioni`, { duration: 4000 })
      await loadReport()
    } catch (err: any) {
      toast.error('Errore: ' + err.message)
    } finally {
      setMarking(false)
    }
  }

  function exportCsv(supplierGroup: SupplierGroup, monthGroup: MonthGroup) {
    const lines: string[] = []
    lines.push(`Fornitore;${supplierGroup.supplier.name}`)
    lines.push(`P.IVA;${supplierGroup.supplier.vat_number || ''}`)
    lines.push(`Mese;${getMonthName(monthGroup.month)}`)
    lines.push('')
    lines.push('N° Prenotazione;Data;Cliente;Barca;Servizio;Importo (€);Provvigione (€)')
    for (const b of monthGroup.bookings) {
      lines.push([
        b.booking_number,
        new Date(b.booking_date).toLocaleDateString('it-IT'),
        b.customer_name.replace(/;/g, ','),
        b.boat_name.replace(/;/g, ','),
        b.service_name.replace(/;/g, ','),
        b.final_price.toFixed(2),
        b.commission_amount.toFixed(2),
      ].join(';'))
    }
    lines.push('')
    lines.push(`TOTALE;;;;${''};${monthGroup.total_revenue.toFixed(2)};${monthGroup.total_commission.toFixed(2)}`)
    const netDovuto = (monthGroup.total_revenue - monthGroup.total_commission).toFixed(2)
    lines.push(`NETTO DA FATTURARE AL FORNITORE;;;;${''};€${netDovuto};`)

    const csv = '\uFEFF' + lines.join('\n') // BOM per Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fattura-${supplierGroup.supplier.name.replace(/\s+/g, '-')}-${monthGroup.month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function renderEuro(v: number) {
    return `€${v.toFixed(2)}`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🧾 Fatturazione Fornitori</h1>
        <p className="text-sm text-gray-600">
          Prenotazioni con <b>fornitore</b> valorizzato, raggruppate per fornitore e mese.
          Usa il filtro <b>"Stato prenotazioni"</b> per consultare anche lo storico chiuso o altri stati.
          A fine mese esporta CSV ed emetti fattura aggregata, poi clicca <b>"✅ Fatturate"</b> per chiudere le prenotazioni.
        </p>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mese di riferimento</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Lascia vuoto per vedere tutti i mesi.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fornitore</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Tutti i fornitori</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* ⭐ 2026-05-22: filtro stato per consultazione storico */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stato prenotazioni</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="open">🟢 Operative (Confermata / In Corso / Da Fatturare)</option>
              <option value="closed">✅ Chiuse (già fatturate — storico)</option>
              <option value="pending">⏳ In Attesa</option>
              <option value="cancelled">❌ Annullate / Da Recuperare</option>
              <option value="all">📋 Tutte (qualsiasi stato)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Default mostra le prenotazioni operative.</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => { setSelectedMonth(''); setSelectedSupplierId(''); setStatusFilter('open') }}
            className="text-xs text-blue-600 hover:underline"
          >
            🔄 Reset filtri
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">Caricamento...</div>
      ) : !data || data.groups.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-gray-700 font-medium">Nessuna prenotazione trovata</p>
          <p className="text-sm text-gray-500 mt-1">
            Nessuna prenotazione fornitore corrisponde ai filtri selezionati
            {selectedMonth ? ` (mese: ${getMonthName(selectedMonth)})` : ''}
            {selectedSupplierId ? ' (fornitore selezionato)' : ''}.
          </p>
        </div>
      ) : (
        <>
          {/* Riepilogo generale */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-600">Fornitori</div>
                <div className="text-2xl font-bold text-blue-700">{data.groups.length}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Prenotazioni</div>
                <div className="text-2xl font-bold text-blue-700">{data.total_bookings}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Totale Lordo</div>
                <div className="text-2xl font-bold text-blue-700">{renderEuro(data.total_revenue)}</div>
              </div>
            </div>
          </div>

          {/* Lista raggruppata per fornitore */}
          <div className="space-y-4">
            {data.groups.map((g) => {
              const netDovuto = g.total_revenue - g.total_commission
              return (
                <div key={g.supplier.id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Header fornitore */}
                  <div className="bg-amber-50 p-4 border-b border-amber-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">🏢 {g.supplier.name}</h2>
                        <p className="text-xs text-gray-600">
                          {g.supplier.business_name && g.supplier.business_name !== g.supplier.name && <>{g.supplier.business_name} • </>}
                          {g.supplier.vat_number && <>P.IVA {g.supplier.vat_number} • </>}
                          {g.supplier.sdi_code && <>SDI {g.supplier.sdi_code} • </>}
                          Commissione: <b>{g.supplier.commission_percentage}%</b>
                        </p>
                        {g.supplier.pec_email && <p className="text-xs text-gray-600">PEC: {g.supplier.pec_email}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600">{g.total_bookings} prenotazione/i • Lordo {renderEuro(g.total_revenue)}</div>
                        <div className="text-lg font-bold text-amber-700">
                          Netto da fatturare: {renderEuro(netDovuto)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mesi */}
                  <div className="divide-y">
                    {g.months.map((m) => {
                      const key = `${g.supplier.id}-${m.month}`
                      const isOpen = !!expanded[key]
                      const monthNetto = m.total_revenue - m.total_commission
                      const allIds = m.bookings.map(b => b.id)

                      return (
                        <div key={m.month}>
                          {/* Riga mese */}
                          <div className="p-3 hover:bg-gray-50">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => toggleMonth(key)}
                                className="flex items-center gap-2 flex-1 text-left"
                              >
                                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                <div>
                                  <div className="font-medium capitalize">{getMonthName(m.month)}</div>
                                  <div className="text-xs text-gray-500">{m.bookings.length} prenotazione/i</div>
                                </div>
                              </button>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="text-right">
                                  <div className="text-xs text-gray-500">Lordo</div>
                                  <div className="font-semibold">{renderEuro(m.total_revenue)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500">Commissione fornitore</div>
                                  <div className="font-semibold text-green-700">−{renderEuro(m.total_commission)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500">Netto da fatturare</div>
                                  <div className="font-bold text-amber-700">{renderEuro(monthNetto)}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => exportCsv(g, m)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Esporta CSV (apre in Excel)"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMarkInvoiced(allIds, `${g.supplier.name} — ${getMonthName(m.month)}`)}
                                    disabled={marking}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                    title="Marca tutte come Fatturate (stato → Chiusa)"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Fatturate
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Dettaglio prenotazioni */}
                          {isOpen && (
                            <div className="bg-gray-50 px-4 pb-3">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b text-xs text-gray-600">
                                    <th className="py-2 text-left">N°</th>
                                    <th className="py-2 text-left">Data</th>
                                    <th className="py-2 text-left">Cliente</th>
                                    <th className="py-2 text-left">Barca / Servizio</th>
                                    <th className="py-2 text-center">Stato</th>
                                    <th className="py-2 text-right">Lordo</th>
                                    <th className="py-2 text-right">Commissione</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.bookings.map((b) => (
                                    <tr key={b.id} className="border-b last:border-0">
                                      <td className="py-1.5 font-mono">{b.booking_number}</td>
                                      <td className="py-1.5">{new Date(b.booking_date).toLocaleDateString('it-IT')}</td>
                                      <td className="py-1.5">{b.customer_name || '—'}</td>
                                      <td className="py-1.5 text-gray-600">
                                        {b.boat_name}
                                        {b.service_name ? <> • {b.service_name}</> : null}
                                      </td>
                                      <td className="py-1.5 text-center">
                                        {b.booking_status_name && (
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                            b.booking_status_code === 'to_invoice' ? 'bg-amber-100 text-amber-700' :
                                            b.booking_status_code === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                            b.booking_status_code === 'confirmed' ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {b.booking_status_name}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-right">{renderEuro(b.final_price)}</td>
                                      <td className="py-1.5 text-right text-green-700">−{renderEuro(b.commission_amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}