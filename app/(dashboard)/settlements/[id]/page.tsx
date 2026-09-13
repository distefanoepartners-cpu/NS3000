'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Settlement {
  id: string
  supplier_id: string
  period_start: string
  period_end: string
  total_gross: number
  total_commission: number
  total_net: number
  bookings_count: number
  status: 'draft' | 'invoiced' | 'paid'
  invoice_number: string | null
  invoice_date: string | null
  paid_at: string | null
  payment_reference: string | null
  notes: string | null
  created_at: string
  created_by_name: string | null
  supplier?: {
    id: string
    name: string
    commission_percentage: number
  }
}

interface Booking {
  id: string
  booking_number: string
  booking_date: string
  final_price: number
  supplier_commission_amount: number
  supplier_commission_percentage: number
  settlement_status: string
  source: string
  customer: { first_name: string; last_name: string; email: string } | null
  boat: { name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; description: string }> = {
  draft: {
    label: 'Bozza',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: '📝',
    description: 'Batch creato. Aggiungi i dati fattura quando ricevi il pagamento.'
  },
 invoiced: {
    label: 'Fatturato',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    icon: '📋',
    description: 'Fattura emessa al partner. In attesa del bonifico.'
  },
  paid: {
    label: 'Pagato',
    color: 'bg-green-100 text-green-700 border-green-300',
    icon: '✅',
    description: 'Batch chiuso. Tutte le prenotazioni sono state saldate.'
  },
}

function fmt(n: number | string) {
  const num = typeof n === 'string' ? parseFloat(n) : n
  return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtPeriod(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
  if (sameMonth) {
    return startDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  }
  return `${fmtDate(start)} → ${fmtDate(end)}`
}

export default function SettlementDetailPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const params = useParams()
  const settlementId = params.id as string

  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modale invoice
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)

  // Modale paid
  const [showPaidModal, setShowPaidModal] = useState(false)
  const [paymentReference, setPaymentReference] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [markingPaid, setMarkingPaid] = useState(false)

  // Modale delete
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadSettlement = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/settlements/${settlementId}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Batch non trovato')
      }
      const data = await res.json()
      setSettlement(data.settlement)
      setBookings(data.bookings || [])

      // Pre-popola form invoice se già presente
      if (data.settlement.invoice_number) setInvoiceNumber(data.settlement.invoice_number)
      if (data.settlement.invoice_date) setInvoiceDate(data.settlement.invoice_date.split('T')[0])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [settlementId])

  useEffect(() => {
    loadSettlement()
  }, [loadSettlement])

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">Accesso riservato agli amministratori.</div>
  }

  // Action: salva invoice
  async function saveInvoice() {
    if (!invoiceNumber.trim()) {
      alert('Inserisci almeno il numero fattura')
      return
    }
    setSavingInvoice(true)
    try {
      const res = await fetch(`/api/settlements/${settlementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_invoice',
          invoice_number: invoiceNumber.trim(),
          invoice_date: invoiceDate || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Errore aggiornamento fattura')
      }
      setShowInvoiceModal(false)
      await loadSettlement()
    } catch (e: any) {
      alert(`Errore: ${e.message}`)
    } finally {
      setSavingInvoice(false)
    }
  }

  // Action: segna come pagato
  async function markAsPaid() {
    setMarkingPaid(true)
    try {
      const res = await fetch(`/api/settlements/${settlementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_paid',
          paid_at: paidAt || new Date().toISOString(),
          payment_reference: paymentReference || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Errore mark paid')
      }
      setShowPaidModal(false)
      await loadSettlement()
    } catch (e: any) {
      alert(`Errore: ${e.message}`)
    } finally {
      setMarkingPaid(false)
    }
  }

  // Action: cancella batch
  async function deleteBatch() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/settlements/${settlementId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Errore cancellazione')
      }
      router.push('/settlements')
    } catch (e: any) {
      alert(`Errore: ${e.message}`)
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !settlement) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h2 className="text-lg font-semibold text-red-800 mb-1">Batch non trovato</h2>
          <p className="text-sm text-red-700 mb-4">{error || 'Il batch richiesto non esiste o è stato cancellato.'}</p>
          <Link
            href="/settlements"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            ← Torna alla lista
          </Link>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[settlement.status] || STATUS_CONFIG.draft

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/settlements" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Torna alla lista
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🤝 Batch {settlement.supplier?.name || 'N/D'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">
              {fmtPeriod(settlement.period_start, settlement.period_end)} • Creato il {fmtDate(settlement.created_at)}
              {settlement.created_by_name && ` da ${settlement.created_by_name}`}
            </p>
          </div>
          <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${statusCfg.color}`}>
            {statusCfg.icon} {statusCfg.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2 italic">{statusCfg.description}</p>
      </div>

      {/* KPI batch */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Prenotazioni</div>
          <div className="text-2xl font-bold text-gray-900">{settlement.bookings_count}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Lordo cliente</div>
          <div className="text-2xl font-bold text-gray-900">€{fmt(settlement.total_gross)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Provvigione</div>
          <div className="text-2xl font-bold text-gray-900">−€{fmt(settlement.total_commission)}</div>
          {settlement.supplier && (
            <div className="text-xs text-gray-400 mt-1">{settlement.supplier.commission_percentage.toFixed(2)}%</div>
          )}
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${
          settlement.status === 'paid' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className={`text-xs font-medium mb-1 ${
            settlement.status === 'paid' ? 'text-green-600' : 'text-amber-600'
          }`}>
            {settlement.status === 'paid' ? '✅ Incassato' : '⏳ Da incassare'}
          </div>
          <div className={`text-2xl font-bold ${
            settlement.status === 'paid' ? 'text-green-900' : 'text-amber-900'
          }`}>
            €{fmt(settlement.total_net)}
          </div>
        </div>
      </div>

      {/* Action panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">⚡ Azioni</h2>
        <div className="flex flex-wrap gap-2">
          {/* Action: Aggiungi/aggiorna fattura - solo se NON paid */}
          {settlement.status !== 'paid' && (
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              📋 {settlement.invoice_number ? 'Modifica fattura emessa' : 'Registra fattura emessa'}
            </button>
          )}

          {/* Action: Segna come pagato - solo se NON paid */}
          {settlement.status !== 'paid' && (
            <button
              onClick={() => setShowPaidModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              ✅ Segna come pagato
            </button>
          )}

          {/* Action: Annulla - solo se NON paid */}
          {settlement.status !== 'paid' && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-medium px-4 py-2 rounded-lg ml-auto"
            >
              🗑️ Annulla batch
            </button>
          )}

          {settlement.status === 'paid' && (
            <p className="text-sm text-gray-500 italic">
              ✅ Batch chiuso. Le prenotazioni sono state saldate il {fmtDate(settlement.paid_at!)}.
            </p>
          )}
        </div>
      </div>

      {/* Dettagli fattura/pagamento */}
      {(settlement.invoice_number || settlement.paid_at || settlement.notes) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">📄 Fattura emessa & pagamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {settlement.invoice_number && (
              <div>
                <div className="text-xs text-gray-500">Numero fattura</div>
                <div className="font-medium text-gray-900">{settlement.invoice_number}</div>
              </div>
            )}
            {settlement.invoice_date && (
              <div>
                <div className="text-xs text-gray-500">Data fattura</div>
                <div className="font-medium text-gray-900">{fmtDate(settlement.invoice_date)}</div>
              </div>
            )}
            {settlement.paid_at && (
              <div>
                <div className="text-xs text-gray-500">Data pagamento</div>
                <div className="font-medium text-green-700">{fmtDate(settlement.paid_at)}</div>
              </div>
            )}
            {settlement.payment_reference && (
              <div>
                <div className="text-xs text-gray-500">Riferimento pagamento</div>
                <div className="font-medium text-gray-900">{settlement.payment_reference}</div>
              </div>
            )}
          </div>
          {settlement.notes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Note</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{settlement.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* Tabella prenotazioni incluse */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">
            📋 Prenotazioni incluse ({bookings.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs">
              <tr>
                <th className="text-left py-2 px-3 font-semibold text-gray-600">Booking</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-600">Data</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-600">Cliente</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-600">Barca</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600">Lordo</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600">Provv.</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600">Netto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map(b => {
                const netto = Number(b.final_price) - Number(b.supplier_commission_amount)
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <Link
                        href={`/bookings/${b.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {b.booking_number}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-gray-600">{fmtDate(b.booking_date)}</td>
                    <td className="py-2 px-3 text-gray-700">
                      {b.customer ? `${b.customer.first_name} ${b.customer.last_name}`.trim() : 'N/D'}
                    </td>
                    <td className="py-2 px-3 text-gray-600 truncate max-w-[150px]">{b.boat?.name || 'N/D'}</td>
                    <td className="py-2 px-3 text-right text-gray-700">€{fmt(b.final_price)}</td>
                    <td className="py-2 px-3 text-right text-gray-700">−€{fmt(b.supplier_commission_amount)}</td>
                    <td className="py-2 px-3 text-right font-bold text-amber-700">€{fmt(netto)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
              <tr>
                <td colSpan={4} className="py-2 px-3 text-right text-xs uppercase text-gray-600">Totali</td>
                <td className="py-2 px-3 text-right text-gray-900">€{fmt(settlement.total_gross)}</td>
                <td className="py-2 px-3 text-right text-gray-900">−€{fmt(settlement.total_commission)}</td>
                <td className="py-2 px-3 text-right text-amber-700">€{fmt(settlement.total_net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* MODALE: Aggiungi fattura */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">📋 Registra fattura emessa</h3>
            <p className="text-sm text-gray-500 mb-4">
              Inserisci i dati della fattura che hai emesso al partner per €{fmt(settlement.total_net)} (netto).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Numero fattura *</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Es: 2026/042"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data fattura</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowInvoiceModal(false)}
                disabled={savingInvoice}
                className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2"
              >
                Annulla
              </button>
              <button
                onClick={saveInvoice}
                disabled={savingInvoice}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                {savingInvoice ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE: Segna come pagato */}
      {showPaidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">✅ Segna come pagato</h3>
            <p className="text-sm text-gray-500 mb-4">
              Stai per chiudere il batch <strong>€{fmt(settlement.total_net)}</strong>.
              Tutte le {settlement.bookings_count} prenotazioni saranno marcate come "saldate".
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data pagamento</label>
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">Lascia vuoto per usare oggi.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Riferimento (opzionale)</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Es: Bonifico BPER del 15/05"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowPaidModal(false)}
                disabled={markingPaid}
                className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2"
              >
                Annulla
              </button>
              <button
                onClick={markAsPaid}
                disabled={markingPaid}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                {markingPaid ? 'Salvataggio...' : '✅ Conferma pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE: Cancella batch */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">🗑️ Annulla batch</h3>
            <p className="text-sm text-gray-700 mb-4">
              Stai per cancellare il batch. Le <strong>{settlement.bookings_count} prenotazioni</strong> torneranno
              in stato "in attesa di report" e potranno essere incluse in un altro batch.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-800">
                ⚠️ Questa azione è reversibile (le prenotazioni tornano in pending), ma il batch sarà rimosso definitivamente.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2"
              >
                Annulla
              </button>
              <button
                onClick={deleteBatch}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                {deleting ? 'Cancellazione...' : '🗑️ Conferma cancellazione'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}