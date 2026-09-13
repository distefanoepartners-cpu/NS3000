'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
]

interface Supplier {
  id: string
  name: string
  commission_percentage: number
}

interface PreviewBooking {
  id: string
  booking_number: string
  booking_date: string
  final_price: number
  supplier_commission_amount: number
  customer: { first_name: string; last_name: string; email: string } | null
  boat: { name: string } | null
}

interface PreviewData {
  supplier: Supplier
  period_start: string
  period_end: string
  bookings: PreviewBooking[]
  totals: {
    bookings_count: number
    total_gross: string
    total_commission: string
    total_net: string
  }
}

function fmt(n: number | string) {
  const num = typeof n === 'string' ? parseFloat(n) : n
  return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NewSettlementPage() {
  const { isAdmin, user } = useAuth()
  const router = useRouter()

  // Wizard step (1, 2, 3)
  const [step, setStep] = useState(1)

  // Step 1 - Partner
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')

  // Step 2 - Periodo
  const now = new Date()
  // Default: mese precedente
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const [year, setYear] = useState(prevYear)
  const [month, setMonth] = useState(prevMonth)
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Step 3 - Preview
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [excludedBookingIds, setExcludedBookingIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carica suppliers
  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers')
      if (!res.ok) return
      const data = await res.json()
      const partnerSuppliers = (data.suppliers || data || []).filter((s: any) =>
        s.commission_percentage > 0
      )
      setSuppliers(partnerSuppliers)
    } catch (e) {
      console.error('Errore caricamento suppliers:', e)
    }
  }, [])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">Accesso riservato agli amministratori.</div>
  }

  // Date calcolate per richiesta
  function getPeriodDates() {
    if (useCustomRange) {
      return { start: customStart, end: customEnd }
    }
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]
    return { start: startDate, end: endDate }
  }

  // Step 1 → Step 2
  function goToStep2() {
    if (!selectedSupplierId) {
      setError('Seleziona un partner')
      return
    }
    setError(null)
    setStep(2)
  }

  // Step 2 → Step 3 (carica preview)
  async function goToStep3() {
    const { start, end } = getPeriodDates()
    if (!start || !end) {
      setError('Seleziona un periodo valido')
      return
    }
    if (start > end) {
      setError('Data inizio deve essere precedente alla fine')
      return
    }

    setError(null)
    setPreviewLoading(true)
    try {
      const params = new URLSearchParams({
        supplier_id: selectedSupplierId,
        period_start: start,
        period_end: end,
      })
      const res = await fetch(`/api/settlements/preview?${params}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Errore caricamento anteprima')
      }
      const data = await res.json()
      setPreview(data)
      setExcludedBookingIds(new Set())
      setStep(3)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  // Step 3 → Crea batch
  async function createBatch() {
    if (!preview) return

    const includedBookings = preview.bookings.filter(b => !excludedBookingIds.has(b.id))
    if (includedBookings.length === 0) {
      setError('Devi includere almeno una prenotazione')
      return
    }

    setError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplierId,
          period_start: preview.period_start,
          period_end: preview.period_end,
          booking_ids: includedBookings.map(b => b.id),
          notes: notes || null,
          created_by_name: user?.full_name || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Errore creazione batch')
      }
      const data = await res.json()
      // Reindirizza a dettaglio batch (sarà creato in STEP 2.3)
      router.push(`/settlements/${data.settlement.id}`)
    } catch (e: any) {
      setError(e.message)
      setCreating(false)
    }
  }

  // Toggle exclude/include
  function toggleBooking(bookingId: string) {
    setExcludedBookingIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bookingId)) newSet.delete(bookingId)
      else newSet.add(bookingId)
      return newSet
    })
  }

  // Calcola totali ricalcolati con esclusioni
  function getRecalculatedTotals() {
    if (!preview) return { count: 0, gross: 0, commission: 0, net: 0 }
    const included = preview.bookings.filter(b => !excludedBookingIds.has(b.id))
    const gross = included.reduce((s, b) => s + Number(b.final_price || 0), 0)
    const commission = included.reduce((s, b) => s + Number(b.supplier_commission_amount || 0), 0)
    return {
      count: included.length,
      gross,
      commission,
      net: gross - commission,
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/settlements" className="text-sm text-blue-600 hover:text-blue-800 mb-1 inline-block">
            ← Torna alla lista
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">➕ Nuovo Batch Settlement</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Raggruppa più prenotazioni in un'unica richiesta di pagamento al partner
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Partner' },
            { num: 2, label: 'Periodo' },
            { num: 3, label: 'Conferma' },
          ].map((s, idx, arr) => (
            <div key={s.num} className="flex-1 flex items-center">
              <div className={`flex items-center gap-2 ${step >= s.num ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= s.num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              </div>
              {idx < arr.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > s.num ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Errore generico */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
          ⚠️ {error}
        </div>
      )}

      {/* STEP 1 — Partner */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Per quale partner crei il batch?</h2>
          <p className="text-sm text-gray-500 mb-4">
            Seleziona il partner che ti deve girare i pagamenti.
          </p>

          {suppliers.length === 0 && (
            <p className="text-sm text-gray-400 italic">Caricamento partner...</p>
          )}

          <div className="space-y-2">
            {suppliers.map(s => (
              <label
                key={s.id}
                className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedSupplierId === s.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="supplier"
                  value={s.id}
                  checked={selectedSupplierId === s.id}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-500">commissione {s.commission_percentage.toFixed(2)}%</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={goToStep2}
              disabled={!selectedSupplierId}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium px-6 py-2 rounded-lg"
            >
              Avanti →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — Periodo */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Quale periodo?</h2>
          <p className="text-sm text-gray-500 mb-4">
            Seleziona il periodo in cui includere le prenotazioni del partner.
          </p>

          {/* Toggle mese / custom */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setUseCustomRange(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                !useCustomRange ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              📅 Mese
            </button>
            <button
              onClick={() => setUseCustomRange(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                useCustomRange ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              🗓️ Date personalizzate
            </button>
          </div>

          {!useCustomRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mese</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Anno</label>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {useCustomRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Da (data prenotazione)</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">A (data prenotazione)</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">
            ℹ️ Saranno incluse solo prenotazioni con stato <strong>"In attesa report"</strong> in questo periodo.
          </p>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              ← Indietro
            </button>
            <button
              onClick={goToStep3}
              disabled={previewLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium px-6 py-2 rounded-lg"
            >
              {previewLoading ? 'Caricamento...' : 'Anteprima →'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Anteprima e conferma */}
      {step === 3 && preview && (
        <div className="space-y-4">
          {/* Header preview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">3. Anteprima Batch</h2>
            <p className="text-sm text-gray-500">
              <strong>{preview.supplier.name}</strong> • dal {fmtDate(preview.period_start)} al {fmtDate(preview.period_end)}
            </p>
          </div>

          {/* Empty state */}
          {preview.bookings.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
              <p className="text-sm text-yellow-800 font-medium">
                Nessuna prenotazione "in attesa" trovata per questo partner nel periodo selezionato.
              </p>
              <p className="text-xs text-yellow-700 mt-2">
                Verifica che il partner abbia prenotazioni con stato "pending" e che il periodo sia corretto.
              </p>
            </div>
          )}

          {/* Tabella prenotazioni */}
          {preview.bookings.length > 0 && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Prenotazioni candidate ({preview.bookings.length})
                  </h3>
                  <p className="text-xs text-gray-500">
                    Deseleziona per escludere dalla batch
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs">
                      <tr>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600 w-10">✓</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Booking</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Data</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Cliente</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Barca</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Lordo</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Netto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.bookings.map(b => {
                        const isExcluded = excludedBookingIds.has(b.id)
                        const netto = Number(b.final_price) - Number(b.supplier_commission_amount)
                        return (
                          <tr
                            key={b.id}
                            className={`${isExcluded ? 'bg-gray-50 opacity-50' : 'hover:bg-blue-50'} cursor-pointer`}
                            onClick={() => toggleBooking(b.id)}
                          >
                            <td className="text-center py-2 px-3">
                              <input
                                type="checkbox"
                                checked={!isExcluded}
                                onChange={() => toggleBooking(b.id)}
                                className="w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 font-medium text-gray-900">{b.booking_number}</td>
                            <td className="py-2 px-3 text-gray-600">{fmtDate(b.booking_date)}</td>
                            <td className="py-2 px-3 text-gray-700">
                              {b.customer ? `${b.customer.first_name} ${b.customer.last_name}`.trim() : 'N/D'}
                            </td>
                            <td className="py-2 px-3 text-gray-600 truncate max-w-[150px]">{b.boat?.name || 'N/D'}</td>
                            <td className="py-2 px-3 text-right text-gray-700">€{fmt(b.final_price)}</td>
                            <td className="py-2 px-3 text-right font-semibold text-amber-700">€{fmt(netto)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totali ricalcolati */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 Riepilogo Batch</h3>
                {(() => {
                  const t = getRecalculatedTotals()
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">Prenotazioni incluse</div>
                        <div className="text-lg font-bold text-gray-900">{t.count}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Lordo cliente</div>
                        <div className="text-lg font-bold text-gray-900">€{fmt(t.gross)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Provvigione partner</div>
                        <div className="text-lg font-bold text-gray-900">−€{fmt(t.commission)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-amber-600">Netto da incassare</div>
                        <div className="text-xl font-bold text-amber-900">€{fmt(t.net)}</div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Note */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Note interne (opzionali)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Es: Report ricevuto via email il..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </>
          )}

          {/* Bottoni */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              disabled={creating}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              ← Indietro
            </button>

            {preview.bookings.length > 0 && (
              <button
                onClick={createBatch}
                disabled={creating || getRecalculatedTotals().count === 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold px-6 py-3 rounded-lg shadow-sm"
              >
                {creating ? '⏳ Creazione in corso...' : `✅ Crea batch (${getRecalculatedTotals().count} prev.)`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}