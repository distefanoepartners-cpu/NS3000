'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
]

const PAYMENT_ICONS: Record<string, string> = {
  cash: '💵', pos: '💳', bank_transfer: '🏦', stripe: '⚡', non_specificato: '❓'
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800', option: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800', completed: 'bg-red-100 text-red-800',
  cancelled: 'bg-fuchsia-100 text-fuchsia-700',
  cancelled_final: 'bg-purple-100 text-purple-700 line-through',
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: 'Mattina', afternoon: 'Pomeriggio', evening: 'Sera', full_day: 'Giornata Intera',
}

function fmt(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DeltaBadge({ value, isPercent = false }: { value: number | null; isPercent?: boolean }) {
  if (value === null) return <span className="text-xs text-gray-400">n/d</span>
  const pos = value >= 0
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${pos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {pos ? '▲' : '▼'} {isPercent ? `${Math.abs(value)}%` : `€${fmt(Math.abs(value))}`}
    </span>
  )
}

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

function exportToExcel(dailyDetail: any[], year: number, month: number) {
  const monthName = MONTHS[month - 1]
  const headers = ['Data','Barca','Servizio','Skipper','Fascia','Importo','Acconto','Met. Acconto','Saldo','Met. Saldo','Totale Incassato','Da Incassare']
  const rows = dailyDetail.map(d => [
    d.booking_date, d.boat_name, d.service_name, d.skipper_name || '-',
    TIME_SLOT_LABELS[d.time_slot] || d.time_slot || '',
    d.final_price.toFixed(2), d.deposit_amount.toFixed(2), d.deposit_method || '-',
    d.balance_amount.toFixed(2), d.balance_method || '-', d.incassato.toFixed(2), d.da_incassare.toFixed(2),
  ])
  const totI = dailyDetail.reduce((s, d) => s + d.final_price, 0)
  const totD = dailyDetail.reduce((s, d) => s + d.deposit_amount, 0)
  const totB = dailyDetail.reduce((s, d) => s + d.balance_amount, 0)
  const totIn = dailyDetail.reduce((s, d) => s + d.incassato, 0)
  const totDa = dailyDetail.reduce((s, d) => s + d.da_incassare, 0)
  rows.push([])
  rows.push(['TOTALE','','','','',totI.toFixed(2),totD.toFixed(2),'',totB.toFixed(2),'',totIn.toFixed(2),totDa.toFixed(2)])
  const BOM = '\uFEFF'
  const csv = BOM + [headers, ...rows].map(row => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Report_Contabilita_${monthName}_${year}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function StatisticsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDaily, setShowDaily] = useState(true)
  const [filterDay, setFilterDay] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/statistics?year=${year}&month=${month}`)
      if (!res.ok) throw new Error('Errore caricamento statistiche')
      setData(await res.json())
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { load() }, [load])
  useEffect(() => { setFilterDay('') }, [year, month])

  if (!isAdmin) return <div className="p-8 text-center text-gray-500">Accesso riservato agli amministratori.</div>

  const prevMonthLabel = month === 1 ? `${MONTHS[11]} ${year - 1}` : `${MONTHS[month - 2]} ${year}`
  const filteredDaily = data?.daily_detail?.filter((d: any) => filterDay ? d.booking_date === filterDay : true) || []
  const dailyByDate: Record<string, any[]> = {}
  filteredDaily.forEach((d: any) => { if (!dailyByDate[d.booking_date]) dailyByDate[d.booking_date] = []; dailyByDate[d.booking_date].push(d) })

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiche & Contabilità</h1>
          <p className="text-sm text-gray-500 mt-0.5">Escluse prenotazioni annullate</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2 shadow-sm">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="text-sm font-semibold text-gray-800 bg-transparent border-none focus:ring-0 cursor-pointer">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="text-sm font-semibold text-gray-800 bg-transparent border-none focus:ring-0 cursor-pointer">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} className="ml-1 text-blue-600 hover:text-blue-800 text-sm font-medium">↻</button>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">⚠️ {error}</div>}

      {!loading && data && (<>
        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 font-medium mb-1">Prenotazioni</div>
            <div className="text-2xl font-bold text-gray-900">{data.current.count}</div>
            <div className="flex items-center gap-1 mt-1.5"><span className="text-xs text-gray-400">{prevMonthLabel}:</span><span className="text-xs text-gray-500">{data.prev.count}</span><DeltaBadge value={data.delta.count} /></div>
          </div>
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
            <div className="text-xs text-blue-600 font-medium mb-1">Totale Importo</div>
            <div className="text-2xl font-bold text-blue-900">€{fmt(data.current.totale_importo)}</div>
            <div className="flex items-center gap-1 mt-1.5"><span className="text-xs text-gray-400">{prevMonthLabel}:</span><span className="text-xs text-gray-500">€{fmt(data.prev.totale_importo)}</span><DeltaBadge value={data.delta.perc_importo} isPercent /></div>
          </div>
          <div className="bg-white rounded-xl border border-green-200 shadow-sm p-4">
            <div className="text-xs text-green-600 font-medium mb-1">Totale Incassato</div>
            <div className="text-2xl font-bold text-green-900">€{fmt(data.current.totale_incassato)}</div>
            <ProgressBar value={data.current.totale_incassato} max={data.current.totale_importo} color="bg-green-500" />
            <div className="flex items-center gap-1 mt-1"><span className="text-xs text-gray-400">Mese prec.:</span><span className="text-xs text-gray-500">€{fmt(data.prev.totale_incassato)}</span><DeltaBadge value={data.delta.totale_incassato} /></div>
          </div>
          <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-4">
            <div className="text-xs text-orange-600 font-medium mb-1">Da Incassare</div>
            <div className="text-2xl font-bold text-orange-900">€{fmt(data.current.totale_da_incassare)}</div>
            <ProgressBar value={data.current.totale_da_incassare} max={data.current.totale_importo} color="bg-orange-400" />
            <div className="text-xs text-gray-400 mt-1">{data.current.totale_importo > 0 ? `${Math.round((data.current.totale_da_incassare / data.current.totale_importo) * 100)}% del totale` : '—'}</div>
          </div>
          {/* ⭐ NUOVO: Da Partner */}
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="text-xs text-amber-600 font-medium mb-1">🤝 Da Partner</div>
            <div className="text-2xl font-bold text-amber-900">€{fmt(data.current.totale_da_partner || 0)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {data.by_partner && data.by_partner.length > 0
                ? `${data.by_partner.length} partner attivi`
                : 'Nessun partner attivo'}
            </div>
          </div>
        </div>

        {/* Stato + Pagamenti */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Stato Prenotazioni</h2>
            <div className="space-y-2">
              {data.by_status.map((s: any) => (<div key={s.code} className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.code] || 'bg-gray-100 text-gray-700'}`}>{s.name}</span><span className="text-xs text-gray-500">{s.count} prev.</span></div><span className="text-sm font-semibold text-gray-800">€{fmt(s.importo)}</span></div>))}
              {data.by_status.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nessuna prenotazione</p>}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Modalità di Incasso</h2>
            <div className="space-y-3">
              {data.by_payment.map((p: any) => (<div key={p.code}><div className="flex items-center justify-between mb-1"><div className="flex items-center gap-2"><span className="text-base">{PAYMENT_ICONS[p.code] || '💰'}</span><span className="text-sm font-medium text-gray-800">{p.name}</span><span className="text-xs text-gray-400">{p.count} prev.</span></div><div className="text-right"><div className="text-sm font-bold text-gray-900">€{fmt(p.incassato)}</div><div className="text-xs text-gray-400">su €{fmt(p.importo)}</div></div></div><ProgressBar value={p.incassato} max={p.importo} color="bg-blue-500" /></div>))}
              {data.by_payment.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nessun dato</p>}
            </div>
          </div>
        </div>

        {/* Barca + Servizio */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🚤 Dettaglio per Barca</h2>
            <div className="space-y-3">
              {data.by_boat.map((b: any) => (<div key={b.id}><div className="flex items-center justify-between mb-1"><div><span className="text-sm font-medium text-gray-800">{b.name}</span><span className="ml-2 text-xs text-gray-400">{b.count} prev.</span></div><div className="text-right"><div className="text-sm font-bold text-gray-900">€{fmt(b.importo)}</div><div className="text-xs text-green-600">incassato €{fmt(b.incassato)}</div></div></div><ProgressBar value={b.incassato} max={b.importo} color="bg-teal-500" /></div>))}
              {data.by_boat.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nessuna barca</p>}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">📋 Dettaglio per Servizio</h2>
            <div className="space-y-3">
              {data.by_service.map((s: any) => (<div key={s.id}><div className="flex items-center justify-between mb-1"><div><span className="text-sm font-medium text-gray-800">{s.name}</span><span className="ml-2 text-xs text-gray-400">{s.count} prev.</span></div><div className="text-right"><div className="text-sm font-bold text-gray-900">€{fmt(s.importo)}</div><div className="text-xs text-green-600">incassato €{fmt(s.incassato)}</div></div></div><ProgressBar value={s.incassato} max={s.importo} color="bg-purple-500" /></div>))}
              {data.by_service.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nessun servizio</p>}
            </div>
          </div>
        </div>

        {/* ⭐ NUOVO: Sezione Per Partner */}
        {data.by_partner && data.by_partner.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🤝 Vendite tramite Partner</h2>
            <div className="space-y-3">
              {data.by_partner.map((p: any) => (
                <div key={p.id} className="border-l-4 border-amber-300 pl-3 py-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{p.name}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        {p.bookings_count} prev. • commissione {p.commission_pct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">Netto: €{fmt(p.netto)}</div>
                      <div className="text-xs text-gray-400">Lordo €{fmt(p.lordo)} − Provv. €{fmt(p.commission_total)}</div>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    {p.pending > 0 && (
                      <span className="text-yellow-700">⏳ Da incassare: <strong>€{fmt(p.pending)}</strong></span>
                    )}
                    {p.settled > 0 && (
                      <span className="text-green-700">✅ Già incassato: <strong>€{fmt(p.settled)}</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confronto */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">📊 Confronto: {MONTHS[month - 1]} {year} vs {prevMonthLabel}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 border-b border-gray-100"><th className="text-left py-2 font-medium">Metrica</th><th className="text-right py-2 font-medium">{MONTHS[month - 1]} {year}</th><th className="text-right py-2 font-medium">{prevMonthLabel}</th><th className="text-right py-2 font-medium">Variazione</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                <tr><td className="py-2.5 text-gray-700">Prenotazioni</td><td className="text-right font-semibold text-gray-900">{data.current.count}</td><td className="text-right text-gray-500">{data.prev.count}</td><td className="text-right"><DeltaBadge value={data.delta.count} /></td></tr>
                <tr><td className="py-2.5 text-gray-700">Totale Importo</td><td className="text-right font-semibold text-gray-900">€{fmt(data.current.totale_importo)}</td><td className="text-right text-gray-500">€{fmt(data.prev.totale_importo)}</td><td className="text-right"><DeltaBadge value={data.delta.totale_importo} /></td></tr>
                <tr><td className="py-2.5 text-gray-700">Totale Incassato</td><td className="text-right font-semibold text-green-700">€{fmt(data.current.totale_incassato)}</td><td className="text-right text-gray-500">€{fmt(data.prev.totale_incassato)}</td><td className="text-right"><DeltaBadge value={data.delta.totale_incassato} /></td></tr>
                <tr><td className="py-2.5 text-gray-700">Da Incassare</td><td className="text-right font-semibold text-orange-700">€{fmt(data.current.totale_da_incassare)}</td><td className="text-right text-gray-500">€{fmt(data.prev.totale_da_incassare)}</td><td className="text-right"><DeltaBadge value={-(data.current.totale_da_incassare - data.prev.totale_da_incassare)} /></td></tr>
                <tr><td className="py-2.5 text-gray-700">% Incassato</td><td className="text-right font-semibold text-gray-900">{data.current.totale_importo > 0 ? `${Math.round((data.current.totale_incassato / data.current.totale_importo) * 100)}%` : '—'}</td><td className="text-right text-gray-500">{data.prev.totale_importo > 0 ? `${Math.round((data.prev.totale_incassato / data.prev.totale_importo) * 100)}%` : '—'}</td><td className="text-right"><DeltaBadge value={data.delta.perc_importo} isPercent /></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ⭐ REGISTRO GIORNALIERO */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-700">📒 Registro Giornaliero — {MONTHS[month - 1]} {year}</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{filteredDaily.length} righe</span>
            </div>
            <div className="flex items-center gap-2">
              <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
                <option value="">Tutti i giorni</option>
                {Object.keys(dailyByDate).sort().map(d => <option key={d} value={d}>{new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })} ({dailyByDate[d].length})</option>)}
              </select>
              <button onClick={() => setShowDaily(!showDaily)} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">{showDaily ? '▲ Chiudi' : '▼ Espandi'}</button>
              <button onClick={() => exportToExcel(filteredDaily, year, month)} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-1" disabled={filteredDaily.length === 0}>📥 Esporta Excel</button>
            </div>
          </div>

          {showDaily && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-gray-500 border-b border-gray-200 uppercase">
                    <th className="text-left py-2 px-1.5 font-semibold">Data</th>
                    <th className="text-left py-2 px-1.5 font-semibold">Barca</th>
                    <th className="text-left py-2 px-1.5 font-semibold">Servizio</th>
                    <th className="text-left py-2 px-1.5 font-semibold">Skipper</th>
                    <th className="text-right py-2 px-1.5 font-semibold">Importo</th>
                    <th className="text-right py-2 px-1.5 font-semibold">Acconto</th>
                    <th className="text-center py-2 px-1.5 font-semibold">Met.</th>
                    <th className="text-right py-2 px-1.5 font-semibold">Saldo</th>
                    <th className="text-center py-2 px-1.5 font-semibold">Met.</th>
                    <th className="text-right py-2 px-1.5 font-semibold">Incassato</th>
                    <th className="text-right py-2 px-1.5 font-semibold">Da Inc.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(dailyByDate).sort().map(dateStr => {
                    const dayRows = dailyByDate[dateStr]
                    const dayTotal = dayRows.reduce((s: number, d: any) => s + d.final_price, 0)
                    const dayInc = dayRows.reduce((s: number, d: any) => s + d.incassato, 0)
                    const dayDa = dayRows.reduce((s: number, d: any) => s + d.da_incassare, 0)
                    const dateLabel = new Date(dateStr).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })
                    return (
                      <tbody key={dateStr}>
                        {dayRows.map((d: any, idx: number) => (
                          <tr key={d.booking_number + idx} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-1.5 px-1.5 text-gray-700 font-medium whitespace-nowrap">{idx === 0 ? dateLabel : ''}</td>
                            <td className="py-1.5 px-1.5 text-gray-800 font-medium truncate max-w-[120px]">{d.boat_name}</td>
                            <td className="py-1.5 px-1.5 text-gray-600 truncate max-w-[140px]">{d.service_name}</td>
                            <td className="py-1.5 px-1.5 text-gray-600 truncate max-w-[100px]">{d.skipper_name || '-'}</td>
                            <td className="py-1.5 px-1.5 text-right font-semibold text-gray-900">€{fmt(d.final_price)}</td>
                            <td className="py-1.5 px-1.5 text-right text-gray-700">{d.deposit_amount > 0 ? `€${fmt(d.deposit_amount)}` : '-'}</td>
                            <td className="py-1.5 px-1.5 text-center text-gray-500 text-[10px]">{d.deposit_method || '-'}</td>
                            <td className="py-1.5 px-1.5 text-right text-gray-700">{d.balance_amount > 0 ? `€${fmt(d.balance_amount)}` : '-'}</td>
                            <td className="py-1.5 px-1.5 text-center text-gray-500 text-[10px]">{d.balance_method || '-'}</td>
                            <td className="py-1.5 px-1.5 text-right font-semibold text-green-700">€{fmt(d.incassato)}</td>
                            <td className={`py-1.5 px-1.5 text-right font-semibold ${d.da_incassare > 0 ? 'text-red-600' : 'text-green-600'}`}>€{fmt(d.da_incassare)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 border-b-2 border-gray-300">
                          <td colSpan={4} className="py-1.5 px-1.5 text-right text-[10px] font-bold text-gray-600 uppercase">Totale {dateLabel}</td>
                          <td className="py-1.5 px-1.5 text-right font-bold text-gray-900">€{fmt(dayTotal)}</td>
                          <td colSpan={4}></td>
                          <td className="py-1.5 px-1.5 text-right font-bold text-green-700">€{fmt(dayInc)}</td>
                          <td className={`py-1.5 px-1.5 text-right font-bold ${dayDa > 0 ? 'text-red-600' : 'text-green-600'}`}>€{fmt(dayDa)}</td>
                        </tr>
                      </tbody>
                    )
                  })}
                  {filteredDaily.length > 0 && (
                    <tr className="bg-blue-50 border-t-2 border-blue-300">
                      <td colSpan={4} className="py-2.5 px-1.5 text-right text-xs font-bold text-blue-800 uppercase">Totale {filterDay ? new Date(filterDay).toLocaleDateString('it-IT') : MONTHS[month - 1]}</td>
                      <td className="py-2.5 px-1.5 text-right text-sm font-bold text-blue-900">€{fmt(filteredDaily.reduce((s: number, d: any) => s + d.final_price, 0))}</td>
                      <td className="py-2.5 px-1.5 text-right text-xs font-bold text-gray-700">€{fmt(filteredDaily.reduce((s: number, d: any) => s + d.deposit_amount, 0))}</td>
                      <td></td>
                      <td className="py-2.5 px-1.5 text-right text-xs font-bold text-gray-700">€{fmt(filteredDaily.reduce((s: number, d: any) => s + d.balance_amount, 0))}</td>
                      <td></td>
                      <td className="py-2.5 px-1.5 text-right text-sm font-bold text-green-800">€{fmt(filteredDaily.reduce((s: number, d: any) => s + d.incassato, 0))}</td>
                      <td className={`py-2.5 px-1.5 text-right text-sm font-bold ${filteredDaily.reduce((s: number, d: any) => s + d.da_incassare, 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>€{fmt(filteredDaily.reduce((s: number, d: any) => s + d.da_incassare, 0))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredDaily.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Nessuna prenotazione nel periodo</p>}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">Dati aggiornati in tempo reale da Supabase • Prenotazioni annullate escluse</p>
      </>)}
    </div>
  )
}