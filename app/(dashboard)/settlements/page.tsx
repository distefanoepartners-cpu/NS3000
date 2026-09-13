'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
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

interface Supplier {
  id: string
  name: string
  commission_percentage: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  draft: { label: 'Bozza', color: 'bg-gray-100 text-gray-700', icon: '📝' },
  invoiced: { label: 'Fatturato', color: 'bg-blue-100 text-blue-700', icon: '📋' },
  paid: { label: 'Pagato', color: 'bg-green-100 text-green-700', icon: '✅' },
}

function fmt(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

export default function SettlementsPage() {
  const { isAdmin } = useAuth()
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtri
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())

  const loadSettlements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterSupplier) params.append('supplier_id', filterSupplier)
      if (filterStatus) params.append('status', filterStatus)
      if (filterYear) params.append('year', filterYear)

      const res = await fetch(`/api/settlements?${params}`)
      if (!res.ok) throw new Error('Errore caricamento batch')
      const data = await res.json()
      setSettlements(data.settlements || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filterSupplier, filterStatus, filterYear])

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers')
      if (!res.ok) return
      const data = await res.json()
      // Filtra solo i partner di interesse (BA, STH)
      const partnerSuppliers = (data.suppliers || data || []).filter((s: any) =>
        s.commission_percentage > 0
      )
      setSuppliers(partnerSuppliers)
    } catch (e) {
      console.error('Errore caricamento suppliers:', e)
    }
  }, [])

  useEffect(() => {
    loadSettlements()
  }, [loadSettlements])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">Accesso riservato agli amministratori.</div>
  }

  // Aggregati per panoramica
  const totalPending = settlements
    .filter(s => s.status !== 'paid')
    .reduce((sum, s) => sum + Number(s.total_net), 0)
  const totalPaid = settlements
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + Number(s.total_net), 0)

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🤝 Settlement Partner</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestione batch incassi differiti dai partner</p>
        </div>
        <Link
          href="/settlements/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm"
        >
          ➕ Crea nuovo batch
        </Link>
      </div>

      {/* KPI top */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Batch totali</div>
          <div className="text-2xl font-bold text-gray-900">{settlements.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
          <div className="text-xs text-amber-600 font-medium mb-1">⏳ Da ricevere (non pagati)</div>
          <div className="text-2xl font-bold text-amber-900">€{fmt(totalPending)}</div>
        </div>
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-4">
          <div className="text-xs text-green-600 font-medium mb-1">✅ Già incassato</div>
          <div className="text-2xl font-bold text-green-900">€{fmt(totalPaid)}</div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 font-medium">Partner:</label>
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">Tutti</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 font-medium">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">Tutti</option>
              <option value="draft">📝 Bozza</option>
              <option value="invoiced">📋 Fatturato</option>
              <option value="paid">✅ Pagato</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 font-medium">Anno:</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadSettlements}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 ml-auto"
          >
            🔄 Aggiorna
          </button>
        </div>
      </div>

      {/* Errori */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Lista vuota */}
      {!loading && settlements.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Nessun batch trovato</h3>
          <p className="text-sm text-gray-500 mb-4">
            Non ci sono batch settlement per i filtri selezionati.
          </p>
          <Link
            href="/settlements/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm"
          >
            ➕ Crea il primo batch
          </Link>
        </div>
      )}

      {/* Tabella batch */}
      {!loading && settlements.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Partner</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Periodo</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Prev.</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Lordo</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Provv.</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Netto</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map(s => {
                  const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.draft
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{s.supplier?.name || 'N/D'}</div>
                        {s.supplier && (
                          <div className="text-xs text-gray-500">
                            commissione {s.supplier.commission_percentage.toFixed(2)}%
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700 capitalize">
                        {fmtPeriod(s.period_start, s.period_end)}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {s.bookings_count}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        €{fmt(Number(s.total_gross))}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        −€{fmt(Number(s.total_commission))}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        s.status === 'paid' ? 'text-green-700' : 'text-amber-700'
                      }`}>
                        €{fmt(Number(s.total_net))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusCfg.color}`}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/settlements/${s.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Dettaglio →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-4">
        Tot. batch: {settlements.length} • Aggiornato in tempo reale
      </p>
    </div>
  )
}