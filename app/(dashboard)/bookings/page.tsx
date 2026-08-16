'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'
import { useAuth } from '@/contexts/AuthContext'
import { it } from 'date-fns/locale'  // ← deve esserci


// 2026-05-24: color coding gruppi collettivi
const COLLECTIVE_GROUP_COLORS = [
  '#D1FAE5', // menta
  '#DBEAFE', // cielo
  '#E9D5FF', // lilla
  '#FED7AA', // pesca
  '#FEF3C7', // vaniglia
  '#FCE7F3', // rosa
  '#E7E5E4', // sabbia
  '#ECFCCB', // oliva
]

function hashCollectiveKey(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function getCollectiveGroupColor(booking: any): string | null {
  const isCollective = booking.booking_type === 'collective' || booking.service_type === 'collective'
  if (!isCollective) return null
  if (!booking.service_id || !booking.boat_id || !booking.booking_date) return null
  const key = booking.service_id + '-' + booking.boat_id + '-' + booking.booking_date + '-' + (booking.time_slot || '')
  const idx = hashCollectiveKey(key) % COLLECTIVE_GROUP_COLORS.length
  return COLLECTIVE_GROUP_COLORS[idx]
}
// 2026-07-02: formato pax con minori — "8 (5+3)" se ci sono minori, altrimenti solo totale
function formatPax(numPassengers: any, numMinors: any): string {
  // num_passengers è GIÀ il totale persone (adulti + tutti i bambini).
  // num_minors è un sottoinsieme (quanti di quel totale sono minori), NON va sommato.
  const totale = Number(numPassengers) || 0
  const minori = Number(numMinors) || 0
  const adulti = Math.max(0, totale - minori)
  return minori > 0 ? `${totale} (${adulti}+${minori})` : `${totale}`
}
export default function PrenotazioniPage() {
  const { isAdmin, isStaff } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [boats, setBoats] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterPayment, setFilterPayment] = useState('all')
  const [filterBoat, setFilterBoat] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [filterSupplier, setFilterSupplier] = useState('all')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [closingBulk, setClosingBulk] = useState(false)
  // ⭐ Staff vede oggi di default, admin vede tutto
  const [filterDate, setFilterDate] = useState(isStaff ? 'today' : 'all')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)

  function getTimeSlotLabel(timeSlot: string): string {
    const labels: { [key: string]: string } = {
      'morning': 'Mattina',
      'afternoon': 'Pomeriggio',
      'evening': 'Sera',
      'full_day': 'Giornata intera'
    }
    return labels[timeSlot] || timeSlot
  }

  useEffect(() => {
    loadBookings()
    loadBoats()
    loadSuppliers()
    if (isAdmin) loadStats()
  }, [isAdmin])

  async function loadBookings() {
    try {
      setLoading(true)
      const res = await fetch('/api/bookings')
      const data = await res.json()
      setBookings(data || [])
    } catch (error) {
      console.error('Error loading bookings:', error)
      toast.error('Errore caricamento prenotazioni')
    } finally {
      setLoading(false)
    }
  }

  async function loadBoats() {
    try {
      const res = await fetch('/api/boats')
      const data = await res.json()
      setBoats(data || [])
    } catch (error) {
      console.error('Error loading boats:', error)
    }
  }

  async function loadSuppliers() {
    try {
      const res = await fetch('/api/suppliers')
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data?.suppliers || [])
      setSuppliers(list.filter((s: any) => s.is_active !== false))
    } catch (error) {
      console.error('Error loading suppliers:', error)
    }
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/bookings/stats')
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  async function handleDelete(bookingId: string) {
    if (!confirm('Sei sicuro di voler eliminare questa prenotazione?')) return
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Errore eliminazione')
      toast.success('Prenotazione eliminata!')
      loadBookings()
      loadStats()
    } catch (error: any) {
      console.error('Error deleting booking:', error)
      toast.error(error.message)
    }
  }

  // ⭐ Chiude una singola prenotazione "Da Fatturare" → "Chiusa"
  const STATUS_COMPLETED = 'e7798e9d-fcea-4f91-9661-454e403e673e'
  async function handleCloseSingle(bookingId: string) {
    if (!confirm('Segnare questa prenotazione come chiusa (fatturata)?')) return
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_status_id: STATUS_COMPLETED }),
      })
      if (!res.ok) throw new Error('Errore chiusura')
      toast.success('Prenotazione chiusa')
      loadBookings()
      loadStats()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  // ⭐ Chiude in massa tutte le "Da Fatturare" del source + mese selezionati
  async function handleCloseBulk() {
    if (filterSource === 'all') {
      toast.error('Seleziona un fornitore (source) per la chiusura massiva')
      return
    }
    const month = selectedMonth // 'YYYY-MM'
    const sourceLabel = filterSource === 'blualliance' ? 'Blu Alliance' : filterSource

    // Anteprima conteggio
    let count = 0
    try {
      const res = await fetch(`/api/bookings/close-invoiced?source=${filterSource}&month=${month}`)
      const data = await res.json()
      count = data.count || 0
    } catch {
      toast.error('Errore nel conteggio')
      return
    }

    if (count === 0) {
      toast.info(`Nessuna prenotazione "Da Fatturare" di ${sourceLabel} per ${month}`)
      return
    }

    if (!confirm(`Chiudere ${count} prenotazioni "Da Fatturare" di ${sourceLabel} del mese ${month}?\n\nL'azione è irreversibile: passeranno tutte allo stato "Chiusa".`)) return

    setClosingBulk(true)
    try {
      const res = await fetch('/api/bookings/close-invoiced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: filterSource, month }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore chiusura massiva')
      toast.success(`${data.closed} prenotazioni chiuse`)
      loadBookings()
      loadStats()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setClosingBulk(false)
    }
  }

  // ⭐ Date helpers
  const todayStr    = format(new Date(), 'yyyy-MM-dd')
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const monthStart  = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd    = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  function bookingCoversDate(b: any, dateStr: string): boolean {
    if (b.booking_date === dateStr) return true
    if (b.booking_end_date && b.booking_date <= dateStr && b.booking_end_date >= dateStr) return true
    return false
  }

  const filteredBookings = bookings.filter((b) => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      b.booking_number?.toLowerCase().includes(searchLower) ||
      b.customer?.first_name?.toLowerCase().includes(searchLower) ||
      b.customer?.last_name?.toLowerCase().includes(searchLower) ||
      b.customer?.email?.toLowerCase().includes(searchLower) ||
      b.service?.name?.toLowerCase().includes(searchLower)

    // ⭐ 2026-07-02 — Gli staff/skipper vedono SOLO le prenotazioni confermate
    const matchesStatus = isStaff
      ? b.booking_status?.code === 'confirmed'
      : (
          filterStatus === 'all' ||
          (filterStatus === 'active' && !['completed', 'cancelled', 'cancelled_final'].includes(b.booking_status?.code ?? '')) ||
          b.booking_status?.code === filterStatus
        )

    const matchesPayment =
      filterPayment === 'all' ||
      b.payment_method?.code === filterPayment

    const matchesBoat =
      filterBoat === 'all' ||
      b.boat_id === filterBoat

    const matchesSource =
      filterSource === 'all' ||
      b.source === filterSource

    const matchesSupplier =
      filterSupplier === 'all' ||
      b.supplier_id === filterSupplier

    // ⭐ Logica date estesa
    const matchesDate =
      filterDate === 'all' ||
      (filterDate === 'today'    && bookingCoversDate(b, todayStr)) ||
      (filterDate === 'tomorrow' && bookingCoversDate(b, tomorrowStr)) ||
      (filterDate === 'month'    && b.booking_date >= selectedMonth + '-01' && b.booking_date <= format(endOfMonth(new Date(selectedMonth + '-01')), 'yyyy-MM-dd')) ||
      (filterDate === 'custom'   && (
        (!customDateFrom || b.booking_date >= customDateFrom) &&
        (!customDateTo   || b.booking_date <= customDateTo) &&
        (customDateFrom || customDateTo)
      ))

    return matchesSearch && matchesStatus && matchesPayment && matchesBoat && matchesDate && matchesSource && matchesSupplier
  })

  // ⭐ Label header contestuale per staff
  function getDateLabel(): string {
    if (filterDate === 'today')    return `Oggi — ${format(new Date(), 'dd/MM/yyyy')}`
    if (filterDate === 'tomorrow') return `Domani — ${format(addDays(new Date(), 1), 'dd/MM/yyyy')}`
    if (filterDate === 'month') return `${format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: it })}`
    if (filterDate === 'custom' && (customDateFrom || customDateTo)) {
      const da = customDateFrom ? format(new Date(customDateFrom), 'dd/MM/yyyy') : '…'
      const a  = customDateTo   ? format(new Date(customDateTo),   'dd/MM/yyyy') : '…'
      return `Dal ${da} al ${a}`
    }
    return 'Tutte le date'
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-4 lg:p-8">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 md:mb-2">
            Prenotazioni
            {isStaff && (
              <span className="ml-3 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                👁️ Solo Visualizzazione
              </span>
            )}
          </h1>
          {/* ⭐ Sottotitolo contestuale per staff */}
          {isStaff ? (
            <p className="text-sm md:text-base text-blue-700 font-medium">{getDateLabel()}</p>
          ) : (
            <p className="text-sm md:text-base text-gray-600">Gestisci tutte le prenotazioni</p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowBookingModal(true)}
            className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm md:text-base"
          >
            ➕ Nuova Prenotazione
          </button>
        )}
      </div>

      {/* Filtri */}
      <div className="mb-4 md:mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
        {/* ⭐ FILTRI STAFF - semplificati */}
        {isStaff ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Periodo</label>
              <select
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value)
                  if (e.target.value !== 'custom') { setCustomDateFrom(''); setCustomDateTo('') }
                }}
                className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm font-medium bg-blue-100 text-blue-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">🗓️ Oggi</option>
                <option value="tomorrow">🗓️ Domani</option>
                <option value="month">🗓️ Questo Mese</option>
                <option value="custom">🔍 Cerca per periodo...</option>
              </select>
            </div>

            {filterDate === 'month' && (
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm bg-blue-100 focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const mm = String(i + 1).padStart(2, '0')
                    return <option key={mm} value={`2026-${mm}`}>{format(new Date(2026, i, 1), 'MMMM yyyy', { locale: it })}</option>
                  })}
                </select>
              </div>
            )}
            {filterDate === 'custom' && (
              <>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Da</label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm bg-blue-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">A</label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm bg-blue-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Cerca</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cliente, barca..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        ) : (
          /* FILTRI ADMIN - invariati */
          <div className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-5">
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Data</label>
              <select
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value)
                  if (e.target.value !== 'custom') { setCustomDateFrom(''); setCustomDateTo('') }
                }}
                className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base font-medium"
              >
                <option value="all">Tutte le date</option>
                <option value="today">🗓️ Oggi</option>
                <option value="tomorrow">🗓️ Domani</option>
                <option value="month">🗓️ Questo Mese</option>
                <option value="custom">📅 Cerca per data...</option>
              </select>
            </div>

            {filterDate === 'month' && (
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm bg-blue-100 focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const mm = String(i + 1).padStart(2, '0')
                    return <option key={mm} value={`2026-${mm}`}>{format(new Date(2026, i, 1), 'MMMM yyyy', { locale: it })}</option>
                  })}
                </select>
              </div>
            )}
            {filterDate === 'custom' && (
              <>
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Da</label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 border-2 border-blue-500 rounded-lg text-sm md:text-base bg-blue-100 font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">A</label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 border-2 border-blue-500 rounded-lg text-sm md:text-base bg-blue-100 font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Cerca</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Codice, cliente, email..."
                className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
              />
            </div>

            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Barca</label>
              <select
                value={filterBoat}
                onChange={(e) => setFilterBoat(e.target.value)}
                className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
              >
                <option value="all">Tutte</option>
                {boats.map((boat) => (
                  <option key={boat.id} value={boat.id}>{boat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Canale</label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
              >
                <option value="all">Tutti</option>
                <option value="ns3000">Diretta (NS3000)</option>
                <option value="blualliance">Blu Alliance</option>
              </select>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Fornitore</label>
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
              >
                <option value="all">Tutti</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Stato</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
              >
                <option value="active">Attive (default)</option>
                <option value="all">Tutte (incl. archivio)</option>
                <option value="pending">In Attesa</option>
                <option value="to_invoice">Da Fatturare</option>
                <option value="confirmed">Confermate</option>
                <option disabled>──────────────</option>
                <option value="cancelled">Da Recuperare (riprogrammazione)</option>
                <option value="cancelled_final">Archivio: Annullate</option>
                <option value="completed">Archivio: Completate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Pagamento</label>
              <select
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
              >
                <option value="all">Tutti</option>
                <option value="stripe">Stripe</option>
                <option value="cash">Contanti</option>
                <option value="pos">POS</option>
                <option value="bank_transfer">Bonifico</option>
              </select>
            </div>
          </div>
        )}

        {/* ⭐ Chiusura massiva "Da Fatturare" per fornitore + mese */}
        {isAdmin && filterSource !== 'all' && (
          <div className="mt-4 flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <div className="text-sm text-gray-700">
              Chiudi tutte le prenotazioni <strong>Da Fatturare</strong> di{' '}
              <strong>{filterSource === 'blualliance' ? 'Blu Alliance' : 'Diretta'}</strong> per il mese{' '}
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="ml-1 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <button
              onClick={handleCloseBulk}
              disabled={closingBulk}
              className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 whitespace-nowrap"
            >
              {closingBulk ? 'Chiusura...' : '✓ Chiudi tutte'}
            </button>
          </div>
        )}
      </div>

      {/* Mobile View - Cards */}
      <div className="md:hidden space-y-3 mb-6">
        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
            Nessuna prenotazione trovata
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const daRicevere = Math.max(0,
              (booking.final_price || 0) -
              (booking.deposit_amount || 0) -
              (booking.balance_amount || 0)
            )
            return (
              <div key={booking.id} className="rounded-xl shadow-sm border border-gray-200 p-4" style={{ backgroundColor: getCollectiveGroupColor(booking) || '#ffffff' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {booking.customer?.first_name} {booking.customer?.last_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(booking.booking_date), 'dd/MM/yyyy')}
                      {booking.booking_end_date && booking.booking_end_date !== booking.booking_date && (
                        <span> → {format(new Date(booking.booking_end_date), 'dd/MM/yyyy')}
                          <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">{booking.num_days}gg</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      booking.booking_status?.code === 'pending'   ? 'bg-yellow-100 text-yellow-800' :
                      booking.booking_status?.code === 'option'    ? 'bg-orange-100 text-orange-800' :
                      booking.booking_status?.code === 'confirmed' ? 'bg-green-100 text-green-800' :
                      booking.booking_status?.code === 'cancelled' ? 'bg-fuchsia-100 text-fuchsia-800' :
                      booking.booking_status?.code === 'cancelled_final' ? 'bg-purple-200 text-purple-800 line-through' :
                      booking.booking_status?.code === 'completed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {booking.booking_status?.name || 'N/D'}
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Servizio:</span>
                    <span className="font-medium text-gray-900">{booking.service?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Barca:</span>
                    <span className="font-medium text-gray-900">{booking.boat?.name}</span>
                  </div>
                  {booking.boarding_port && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">⚓ Imbarco:</span>
                      <span className="font-medium text-blue-700">
                        {booking.boarding_port}
                        {booking.disembark_port && booking.disembark_port !== booking.boarding_port && ` → ${booking.disembark_port}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Passeggeri:</span>
                   <span className="font-medium text-gray-900">{formatPax(booking.num_passengers, booking.num_minors)} Pax</span>
                  </div>
                  {booking.skipper && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Skipper:</span>
                      <span className="font-medium text-gray-900">
                        {booking.skipper.first_name} {booking.skipper.last_name}
                      </span>
                    </div>
                  )}
                  {booking.hostess_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hostess:</span>
                      <span className="font-medium text-gray-900">{booking.hostess_name}</span>
                    </div>
                  )}
                  {isAdmin && (
                    <>
                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <span className="text-gray-600">Totale:</span>
                        <span className="font-semibold text-gray-900">€{(booking.final_price || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Da ricevere:</span>
                        <span className={`font-semibold ${daRicevere > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          €{daRicevere.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="flex-1 px-3 py-2 text-center text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    👁️ Dettagli
                  </Link>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => { setSelectedBooking(booking); setShowEditModal(true) }}
                        className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        ✏️ Modifica
                      </button>
                      {booking.booking_status?.code === 'to_invoice' && (
                        <button
                          onClick={() => handleCloseSingle(booking.id)}
                          className="px-3 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800"
                          title="Segna come chiusa (fatturata)"
                        >
                          ✓ Chiudi
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(booking.id)}
                        className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Barca & Tour</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pax</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Skipper</th>
                {isAdmin && (
                  <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Importo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Metodo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Stato</th>
                  </>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 6} className="px-4 py-8 text-center text-gray-500">
                    Nessuna prenotazione trovata
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => {
                  const daRicevere = Math.max(0,
                    (booking.final_price || 0) -
                    (booking.deposit_amount || 0) -
                    (booking.balance_amount || 0)
                  )
                  return (
                    <tr key={booking.id} className="hover:opacity-90" style={{ backgroundColor: getCollectiveGroupColor(booking) || undefined }}>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(booking.booking_date), 'dd/MM/yyyy')}
                          {booking.booking_end_date && booking.booking_end_date !== booking.booking_date && (
                            <>
                              <span className="text-gray-400 mx-1">→</span>
                              {format(new Date(booking.booking_end_date), 'dd/MM/yyyy')}
                            </>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {booking.num_days > 1 ? (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">
                              {booking.num_days} giorni
                            </span>
                          ) : (
                            getTimeSlotLabel(booking.time_slot)
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {booking.customer?.first_name} {booking.customer?.last_name}
                        </div>
                        <div className="text-xs text-gray-500">{booking.customer?.phone}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{booking.boat?.name}</div>
                        <div className="text-xs text-gray-500">{booking.service?.name}</div>
                        {booking.boarding_port && (
                          <div className="text-xs text-blue-700 font-medium mt-0.5">
                            ⚓ {booking.boarding_port}
                            {booking.disembark_port && booking.disembark_port !== booking.boarding_port && (
                              <span className="text-gray-500"> → {booking.disembark_port}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900">{formatPax(booking.num_passengers, booking.num_minors)}</div>
                      </td>
                      <td className="px-4 py-4">
                        {booking.skipper ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              ⚓ {booking.skipper.first_name} {booking.skipper.last_name}
                            </div>
                            {booking.skipper.phone && (
                              <div className="text-xs text-gray-500">{booking.skipper.phone}</div>
                            )}
                            {booking.skipper.license_expiry_date && (
                              (() => {
                                const expiry = new Date(booking.skipper.license_expiry_date)
                                const today = new Date()
                                const days = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                if (days < 0) return <div className="text-xs text-red-600 font-semibold">🔴 Patente SCADUTA</div>
                                if (days <= 30) return <div className="text-xs text-orange-600 font-semibold">⚠️ Scade tra {days}g</div>
                                return null
                              })()
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Nessuno skipper</span>
                        )}
                        {booking.hostess_name && (
                          <div className="text-xs text-purple-600 mt-1">💃 {booking.hostess_name}</div>
                        )}
                      </td>
                      {isAdmin && (
                        <>
                          <td className="px-4 py-4">
                            <div className="text-sm font-semibold text-gray-900">Totale: €{(booking.final_price || 0).toFixed(2)}</div>
                            <div className="text-xs text-gray-600">Acconto: €{(booking.deposit_amount || 0).toFixed(2)}</div>
                            <div className="text-xs text-gray-600">Saldo: €{(booking.balance_amount || 0).toFixed(2)}</div>
                            <div className={`text-xs font-semibold ${daRicevere > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              Da ricevere: €{daRicevere.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900">
                              {booking.deposit_payment_method?.name && (
                                <div className="text-xs">Acconto: {booking.deposit_payment_method.name}</div>
                              )}
                              {booking.balance_payment_method?.name && (
                                <div className="text-xs">Saldo: {booking.balance_payment_method.name}</div>
                              )}
                              {!booking.deposit_payment_method?.name && !booking.balance_payment_method?.name && (
                                <span className="text-gray-400">⚠️ Non impostato</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              booking.booking_status?.code === 'pending'   ? 'bg-yellow-100 text-yellow-800' :
                              booking.booking_status?.code === 'option'    ? 'bg-orange-100 text-orange-800' :
                              booking.booking_status?.code === 'confirmed' ? 'bg-green-100 text-green-800' :
                              booking.booking_status?.code === 'cancelled' ? 'bg-fuchsia-100 text-fuchsia-800' :
                              booking.booking_status?.code === 'cancelled_final' ? 'bg-purple-200 text-purple-800 line-through' :
                              booking.booking_status?.code === 'completed' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {booking.booking_status?.name || 'N/D'}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4">
                        <div className="flex gap-1.5">
                          <Link
                            href={`/bookings/${booking.id}`}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            👁️
                          </Link>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => { setSelectedBooking(booking); setShowEditModal(true) }}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(booking.id)}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onSave={() => { loadBookings(); loadStats() }}
      />

      <BookingModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedBooking(null) }}
        onSave={(fresh?: any) => { loadBookings(); loadStats(); if (fresh && fresh.id) setSelectedBooking(fresh) }}
        booking={selectedBooking}
      />
    </div>
  )
}