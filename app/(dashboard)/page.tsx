'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, addDays, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'
import UnavailabilityModal from '@/components/UnavailabilityModal'
import { useAuth } from '@/contexts/AuthContext'

export default function PlanningPage() {
  const { isAdmin, isStaff } = useAuth()
  const router = useRouter()
  const [date, setDate] = useState(new Date())

  // Per staff: default 'two-days', per admin: default 'month'
  const [viewRange, setViewRange] = useState<'two-days' | 'month'>(isStaff ? 'two-days' : 'month')

  const [boats, setBoats] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [unavailabilities, setUnavailabilities] = useState<any[]>([])
  const [collectiveTourBoats, setCollectiveTourBoats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showUnavailabilityModal, setShowUnavailabilityModal] = useState(false)
  const [showSlotMenu, setShowSlotMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedBoat, setSelectedBoat] = useState<any>(null)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [selectedUnavailability, setSelectedUnavailability] = useState<any>(null)
  const [showBookingMenu, setShowBookingMenu] = useState(false)
  const [bookingMenuPosition, setBookingMenuPosition] = useState({ x: 0, y: 0 })
  const [clickedBooking, setClickedBooking] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [highlightedDay, setHighlightedDay] = useState<string | null>(null)

  // Calcola i giorni da visualizzare in base alla viewRange
  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)

  const days = viewRange === 'two-days'
    ? [today, tomorrow]
    : eachDayOfInterval({
        start: startOfMonth(date),
        end: endOfMonth(date)
      })

  useEffect(() => {
    loadData()
  }, [date, viewRange])

  // Auto-scroll al giorno corrente
  useEffect(() => {
    if (loading || viewRange !== 'month') return
    setTimeout(() => {
      const todayCell = document.querySelector('th.bg-blue-100') as HTMLElement
      const scrollContainer = todayCell?.closest('.overflow-x-auto') as HTMLElement
      if (todayCell && scrollContainer) {
        // ⭐ FIX 2026-05-01: scroll a posizione che mostri 2-3 giorni PRIMA della data corrente
        // così la cella di oggi non viene coperta dalla colonna sticky "Barca"
        const cellLeft = todayCell.offsetLeft
        const containerPadding = 112 // larghezza colonna Flotta (w-28)
        const buffer = 60 // ~2 colonne giornaliere extra a sinistra
        scrollContainer.scrollLeft = Math.max(0, cellLeft - containerPadding - buffer)
      }
    }, 150)
  }, [loading, viewRange, date])
  
  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true)

      const start = format(days[0], 'yyyy-MM-dd')
      const end = format(days[days.length - 1], 'yyyy-MM-dd')

      const [boatsRes, bookingsRes, unavailRes, ctbRes] = await Promise.all([
        fetch('/api/boats'),
        fetch(`/api/bookings?start=${start}&end=${end}`),
        fetch(`/api/unavailabilities?start=${start}&end=${end}`),
        fetch('/api/collective-tour-boats')
      ])

      const [boatsData, bookingsData, unavailData, ctbData] = await Promise.all([
        boatsRes.json(),
        bookingsRes.json(),
        unavailRes.json(),
        ctbRes.json()
      ])

      setBoats(boatsData || [])
      // Gli operatori (staff) non vedono le prenotazioni in attesa: solo confermate e stati attivi.
      // Gli admin vedono tutto.
      const allBookings = bookingsData || []
      setBookings(
        isStaff
          ? allBookings.filter((b: any) => b.booking_status?.code !== 'pending')
          : allBookings
      )
      setUnavailabilities(unavailData || [])
      setCollectiveTourBoats(ctbData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Errore caricamento dati')
    } finally {
      if (!silent) setLoading(false)
    }
  }
// ⭐ Calcola dati capacità collettivo per (barca, data, slot)
  // Ritorna null se non ci sono prenotazioni collettive su quella cella o se manca capienza
  function getCollectiveCapacity(boat: any, day: Date, time_slot: string) {
    const dayStr = format(day, 'yyyy-MM-dd')

    // Trova prenotazioni collettive su questa barca/data/slot (escluse cancellate)
    const collectiveBookings = bookings.filter(b => {
      if (b.boat_id !== boat.id) return false
      // ⭐ FIX 2026-04-30: identifichiamo collettivi sia da booking_type che da service_type
// (alcune vecchie prenotazioni hanno service_type='collective' e booking_type=null)
const isCollective = b.booking_type === 'collective' || b.service_type === 'collective'
if (!isCollective) return false
      if (b.booking_date !== dayStr) return false
      if (b.time_slot !== time_slot) return false
      const status = b.booking_status?.code || ''
      if (['cancelled', 'canceled', 'cancelled_final', 'expired'].includes(status)) return false
      return true
    })

    if (collectiveBookings.length === 0) return null

    // Service ID del collettivo (tutti i bookings dello stesso slot avranno lo stesso service_id)
    const serviceId = collectiveBookings[0].service_id

    // Trova capienza max in collective_tour_boats
    const ctb = collectiveTourBoats.find(c =>
      c.boat_id === boat.id && c.service_id === serviceId && c.is_active
    )

    if (!ctb) return null

    const used = collectiveBookings.reduce((sum, b) => sum + (b.num_passengers || 0), 0)
    const max = ctb.max_passengers
    const remaining = Math.max(0, max - used)

    return {
      used,
      max,
      remaining,
      bookings: collectiveBookings,
      service_id: serviceId,
      ctb_id: ctb.id
    }
  }

    function handleCellClick(boat: any, day: Date, e: React.MouseEvent) {
    if (isStaff) {
      toast.info('👁️ Modalità Solo Visualizzazione - Non puoi creare prenotazioni')
      return
    }

    const dayStr = format(day, 'yyyy-MM-dd')
    const dayBookings = bookings.filter((b) => {
      if (b.boat_id !== boat.id) return false
      if (b.booking_date === dayStr) return true
      if (b.booking_end_date && b.booking_date <= dayStr && b.booking_end_date >= dayStr) return true
      return false
    })

    const dayUnavail = unavailabilities.find(
      (u) => u.boat_id === boat.id && dayStr >= u.date_from && dayStr <= u.date_to
    )

    if (dayUnavail) {
      toast.info('Questa giornata è bloccata da indisponibilità')
      return
    }

    // ⭐ FIX 2026-04-30: Se ci sono prenotazioni collettive con posti residui,
    // apri direttamente il BookingModal pre-compilato per aggiungere altra famiglia
    const collectiveSlots: Array<'full_day' | 'morning' | 'afternoon' | 'evening'> = ['full_day', 'morning', 'afternoon', 'evening']
    for (const slot of collectiveSlots) {
      const cap = getCollectiveCapacity(boat, day, slot)
      if (cap && cap.remaining > 0) {
        // Apre BookingModal pre-compilato con dati collettivo
        setSelectedBoat(boat)
        setSelectedDate(day)
        setSelectedBooking({
          // Pseudo-record per pre-compilare il form (NON è un booking esistente, è "nuovo")
          boat_id: boat.id,
          service_id: cap.service_id,
          booking_date: dayStr,
          time_slot: slot,
          booking_type: 'collective',
          num_passengers: 1,
          _isNewCollectivePax: true,        // flag custom: stiamo aggiungendo pax a un collettivo
          _maxRemaining: cap.remaining,     // posti residui disponibili
          _collectiveInfo: { used: cap.used, max: cap.max }
        })
        setShowBookingModal(true)
        return
      }
    }

    const hasFullDay = dayBookings.some(b => b.time_slot === 'full_day')
    const hasMorning = dayBookings.some(b => b.time_slot === 'morning')
    const hasAfternoon = dayBookings.some(b => b.time_slot === 'afternoon')
    const hasEvening = dayBookings.some(b => b.time_slot === 'evening')

    if (hasFullDay || (hasMorning && hasAfternoon && hasEvening)) {
      toast.info('Questa giornata è completamente occupata')
      return
    }

    setSelectedBoat(boat)
    setSelectedDate(day)
    setMenuPosition({ x: e.clientX, y: e.clientY })
    setShowSlotMenu(true)
  }

  function openBookingModal() {
    setShowSlotMenu(false)
    setSelectedBooking(null)
    setShowBookingModal(true)
  }

  function openUnavailabilityModal() {
    setShowSlotMenu(false)
    setSelectedUnavailability(null)
    setShowUnavailabilityModal(true)
  }

  function handleBookingClick(booking: any, e: React.MouseEvent) {
    e.stopPropagation()
    if (isStaff) {
      router.push(`/bookings/${booking.id}`)
      return
    }

    const x = Math.min(e.clientX, window.innerWidth - 220)
    const y = Math.min(e.clientY, window.innerHeight - 160)

    setClickedBooking(booking)
    setBookingMenuPosition({ x, y })
    setShowBookingMenu(true)
  }

  function openEditBooking() {
    setShowBookingMenu(false)
    setSelectedBooking(clickedBooking)
    setShowBookingModal(true)
  }

  function openDeleteConfirm() {
    setShowBookingMenu(false)
    setShowDeleteConfirm(true)
  }

  async function handleDeleteBooking() {
    if (!clickedBooking) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/bookings/${clickedBooking.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Errore eliminazione')
      }

      toast.success(`Prenotazione ${clickedBooking.booking_number || ''} cancellata!`)
      setShowDeleteConfirm(false)
      setClickedBooking(null)
      loadData()
    } catch (error: any) {
      console.error('Error deleting booking:', error)
      toast.error(error.message || 'Errore durante la cancellazione')
    } finally {
      setDeleting(false)
    }
  }

  function handleUnavailabilityClick(unavail: any) {
    if (isStaff) {
      toast.info('👁️ Solo Visualizzazione - Non puoi modificare indisponibilità')
      return
    }
    setSelectedUnavailability(unavail)
    setShowUnavailabilityModal(true)
  }

  function handleClose() {
    setShowBookingModal(false)
    setShowUnavailabilityModal(false)
    setShowSlotMenu(false)
    setShowBookingMenu(false)
    setShowDeleteConfirm(false)
    setSelectedDate(null)
    setSelectedBoat(null)
    setSelectedBooking(null)
    setSelectedUnavailability(null)
    setClickedBooking(null)
  }

  function handleSave(updated?: any) {
    loadData(true)
    if (updated?.id) setSelectedBooking(updated)
  }

  function navigatePrev() {
    if (viewRange === 'month') {
      setDate(addMonths(date, -1))
    }
  }

  function navigateNext() {
    if (viewRange === 'month') {
      setDate(addMonths(date, 1))
    }
  }

  // ⭐ 2026-05-22: aggiunto case 'to_invoice' → nero distintivo "Da Fatturare"
  const getStatusColor = (code: string) => {
    switch (code) {
      case 'pending': return 'bg-yellow-500'
      case 'confirmed': return 'bg-green-500'
      case 'cancelled': return 'bg-fuchsia-500'
      case 'cancelled_final': return 'bg-purple-500 line-through'
      case 'completed': return 'bg-red-500'
      case 'in_progress': return 'bg-blue-900'
      case 'to_invoice': return 'bg-black'
      default: return 'bg-gray-500'
    }
  }
 // ⭐ Colore cella: le prenotazioni online (dal sito) hanno sfondo azzurro,
  // MA gli stati con colore proprio hanno la precedenza sul canale.
  const getCellColor = (booking: any) => {
    if (booking?.booking_source === 'online') {
      const code = booking?.booking_status?.code
      // Stati con colore proprio: vincono sul badge "online"
      if (code === 'in_progress' || code === 'completed' || code === 'cancelled' || code === 'cancelled_final' || code === 'to_invoice') {
        return getStatusColor(code)
      }
      // Scontrino non verificato: giallo di allerta
      if (booking?.scontrino_verificato === false) return 'bg-yellow-400'
      // Stati neutri (attesa/confermata) online:
      // - TOUR (charter/collective): ciano scuro
      // - LOCAZIONE (rental): azzurro
      const isTour = booking?.service_type === 'charter' || booking?.service_type === 'collective' || booking?.booking_type === 'collective'
      return isTour ? 'bg-pink-400 text-white' : 'bg-sky-300'
    }
    return getStatusColor(booking?.booking_status?.code || 'pending')
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="p-2 md:p-2 lg:p-2 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-4">
          Planning {viewRange === 'two-days' ? 'Giornaliero' : 'Mensile'}
        </h1>

        {/* ─── HEADER STAFF (skipper) ─── */}
        {isStaff ? (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            {/* Label data corrente */}
            <div className="flex items-center gap-2">
              {viewRange === 'two-days' ? (
                <span className="text-base font-semibold text-gray-700">
                  📅 {format(today, 'EEEE d MMMM', { locale: it })} &amp; {format(tomorrow, 'EEEE d MMMM', { locale: it })}
                </span>
              ) : (
                <span className="text-base font-semibold text-gray-700 uppercase">
                  {format(date, 'MMMM yyyy', { locale: it })}
                </span>
              )}
            </div>

            {/* Controlli vista staff */}
            <div className="flex gap-2 flex-wrap">
              {/* Toggle Oggi+Domani / Mese */}
              <button
                onClick={() => setViewRange('two-days')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewRange === 'two-days'
                    ? 'bg-blue-600 text-white shadow'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                📅 Oggi + Domani
              </button>
              <button
                onClick={() => setViewRange('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewRange === 'month'
                    ? 'bg-blue-600 text-white shadow'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                🗓️ Mese intero
              </button>

              {/* Prev/Next visibili solo in vista mensile */}
              {viewRange === 'month' && (
                <>
                  <button
                    onClick={navigatePrev}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    ◀ Prec
                  </button>
                  <button
                    onClick={() => setDate(new Date())}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Oggi
                  </button>
                  <button
                    onClick={navigateNext}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Succ ▶
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ─── HEADER ADMIN ─── */
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 uppercase">
                {format(date, 'MMMM', { locale: it })}
              </h2>

              <div className="flex gap-2">
                <select
                  value={date.getMonth()}
                  onChange={(e) => {
                    const newDate = new Date(date)
                    newDate.setMonth(parseInt(e.target.value))
                    setDate(newDate)
                  }}
                  className="px-3 py-2 border-2 border-blue-500 rounded-lg text-sm bg-blue-100 font-semibold text-blue-900 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                >
                  {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'].map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>

                <select
                  value={date.getFullYear()}
                  onChange={(e) => {
                    const newDate = new Date(date)
                    newDate.setFullYear(parseInt(e.target.value))
                    setDate(newDate)
                  }}
                  className="px-3 py-2 border-2 border-blue-500 rounded-lg text-sm bg-blue-100 font-semibold text-blue-900 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                >
                  {[2024, 2025, 2026, 2027].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={navigatePrev}
                className="flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs md:text-sm"
              >
                ◀ Prec
              </button>
              <button
                onClick={() => setDate(new Date())}
                className="flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm font-medium"
              >
                Oggi
              </button>
              <button
                onClick={navigateNext}
                className="flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs md:text-sm"
              >
                Succ ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="mb-3 md:mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-2 md:p-3">
        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-500"></div>
            <span>In Attesa</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500"></div>
            <span>Confermata</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-fuchsia-500"></div>
            <span>Da Recuperare</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-red-500"></div>
            <span>Chiusa</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-blue-900"></div>
            <span>In Corso</span>
          </div>
          {/* ⭐ 2026-05-22: aggiunte voci Da Fatturare (nero) + Annullata (viola) */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-black"></div>
            <span>Da Fatturare</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-purple-500"></div>
            <span>Annullata</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 bg-gray-400 opacity-50"></div>
            <span>Indisponibile</span>
          </div>
          {/* ⭐ Online: locazione (azzurro) vs tour (ciano scuro) */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-sky-300"></div>
            <span>Online · Locazione</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-pink-400"></div>
            <span>Online · Tour</span>
          </div>
        </div>
      </div>

      {/* ⭐ FIX 2026-05-01: barra scroll orizzontale sticky in alto */}
      <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 border-b-0 overflow-x-auto overflow-y-hidden" 
           id="top-scroll-bar"
           onScroll={(e) => {
             const main = document.getElementById('main-scroll-container')
             if (main && main.scrollLeft !== e.currentTarget.scrollLeft) {
               main.scrollLeft = e.currentTarget.scrollLeft
             }
           }}
           style={{ scrollbarWidth: 'thin' }}>
        <div style={{ minWidth: viewRange === 'month' ? '1800px' : '600px', height: '1px' }}></div>
      </div>

      {/* Planning Grid */}
      <div className="flex-1 bg-white rounded-b-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full" 
             id="main-scroll-container"
             style={{ scrollBehavior: 'smooth' }}
             onScroll={(e) => {
               const top = document.getElementById('top-scroll-bar')
               if (top && top.scrollLeft !== e.currentTarget.scrollLeft) {
                 top.scrollLeft = e.currentTarget.scrollLeft
               }
             }}>
          <table className="border-collapse" style={{ minWidth: viewRange === 'month' ? '1800px' : '600px' }}>
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
             <th className="border border-gray-200 p-1 md:p-2 text-left font-semibold text-gray-900 bg-gray-100 w-20 md:w-28 text-xs md:text-sm">
                  Flotta
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    onClick={() => setHighlightedDay(prev => prev === format(day, 'yyyy-MM-dd') ? null : format(day, 'yyyy-MM-dd'))}
                    className={`border border-gray-200 p-1 text-center font-semibold cursor-pointer ${
                      viewRange === 'two-days' ? 'w-40 md:w-64' : 'w-10 md:w-14'
                    } ${highlightedDay === format(day, 'yyyy-MM-dd') ? 'bg-blue-100 text-blue-800' : isSameDay(day, new Date()) ? 'bg-blue-100 text-blue-700' : 'text-gray-900 hover:bg-gray-100'}`}
                  >
                    {viewRange === 'two-days' ? (
                      <div>
                        <div className="text-xs md:text-sm font-bold capitalize">
                          {format(day, 'EEEE', { locale: it })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(day, 'd MMM', { locale: it })}
                        </div>
                      </div>
                    ) : (
                       <div>
                        <div className="text-xs md:text-sm">{format(day, 'dd', { locale: it })}</div>
                        <div className={`text-[10px] font-medium ${
                          day.getDay() === 0 ? 'text-red-500' : day.getDay() === 6 ? 'text-blue-500' : 'text-gray-400'
                        }`}>
                          {format(day, 'EEEEE', { locale: it }).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {boats.map((boat) => (
                <tr key={boat.id} className="hover:bg-gray-50">
                 <td className="border border-gray-200 p-1 md:p-2 bg-gray-50 font-medium sticky left-0 z-[5] w-20 md:w-28">
                    <div className="text-[11px] md:text-xs font-semibold text-gray-900 truncate" title={boat.name}>{boat.name}</div>
                  </td>
                  {days.map((day) => {
                    const dayStr = format(day, 'yyyy-MM-dd')

                    const dayBookings = bookings.filter((b) => {
                      if (b.boat_id !== boat.id) return false
                      if (b.booking_date === dayStr) return true
                      if (b.booking_end_date && b.booking_date <= dayStr && b.booking_end_date >= dayStr) return true
                      return false
                    })

                    const dayUnavail = unavailabilities.find(
                      (u) =>
                        u.boat_id === boat.id &&
                        dayStr >= u.date_from &&
                        dayStr <= u.date_to
                    )

                    const morningBooking = dayBookings.find(b => b.time_slot === 'morning')
                    const afternoonBooking = dayBookings.find(b => b.time_slot === 'afternoon')
                    const eveningBooking = dayBookings.find(b => b.time_slot === 'evening')
                    const fullDayBooking = dayBookings.find(b => b.time_slot === 'full_day')
                    const otherBookings = dayBookings.filter(b =>
                      !['morning', 'afternoon', 'evening', 'full_day'].includes(b.time_slot)
                    )

                    const tooltipText = dayBookings.length > 0
                      ? dayBookings.map(b => {
                          const slot = b.time_slot === 'morning' ? '🌅 Mattina' :
                                      b.time_slot === 'afternoon' ? '🌇 Pomeriggio' :
                                      b.time_slot === 'evening' ? '🌙 Sera' :
                                      b.time_slot === 'full_day' ? '☀️ Full Day' :
                                      '🕐 ' + (b.time_slot || 'Custom')
                          const multiDay = b.booking_end_date && b.booking_end_date !== b.booking_date
                            ? ` (${b.booking_date} → ${b.booking_end_date})` : ''
                          return `${slot} - ${b.customer?.first_name} ${b.customer?.last_name} - €${b.final_price}${multiDay}`
                        }).join('\n')
                      : dayUnavail
                        ? dayUnavail.reason || 'Indisponibile'
                        : ''

                    // In vista due giorni, celle più alte e con nome cliente visibile
                    const cellHeight = viewRange === 'two-days' ? 'h-20' : 'h-16'
                    const isHighlighted = highlightedDay === dayStr
                    return (
                      <td
                        key={day.toISOString()}
                        className={`border border-gray-200 p-0.5 align-middle cursor-pointer hover:bg-blue-100 transition-colors ${cellHeight} ${highlightedDay === dayStr ? 'bg-blue-100' : ''}`}
                        onClick={(e) => handleCellClick(boat, day, e)}
                        title={tooltipText}
                      >
                        {dayUnavail ? (
                          <div
                            onClick={(e) => { e.stopPropagation(); handleUnavailabilityClick(dayUnavail) }}
                            className="bg-gray-400 bg-opacity-30 rounded w-full h-full flex items-center justify-center cursor-pointer hover:bg-opacity-50 border border-dashed border-gray-500"
                          >
                            <span className="text-sm">{dayUnavail.reason === 'repair' ? '🔧' : dayUnavail.reason === 'reserved' ? '🔒' : '❌'}</span>
                          </div>
                        ) : fullDayBooking ? (() => {
                          // ⭐ FIX 2026-04-30: se è collettivo, mostra X/Y invece di emoji
                          const cap = getCollectiveCapacity(boat, day, 'full_day')
                          if (cap) {
                            // Cella COLLETTIVA: click "vuoto" della cella → handleCellClick → BookingModal
                            // Click sulla riga colorata → handleBookingClick (modifica prenotazione esistente)
                            const colorClass = cap.remaining === 0
                              ? 'bg-red-500'
                              : cap.used / cap.max >= 0.7
                                ? 'bg-orange-500'
                                : cap.used / cap.max >= 0.4
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                            return (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Se cella ha posti residui, propaga al click cella per aprire form aggiungi pax
                                  if (cap.remaining > 0) {
                                    handleCellClick(boat, day, e)
                                  } else {
                                    handleBookingClick(fullDayBooking, e)
                                  }
                                }}
                                className={`${colorClass} rounded w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex flex-col items-center justify-center gap-0`}
                                title={`Tour collettivo • ${cap.used}/${cap.max} pax • ${cap.remaining} posti liberi`}
                              >
                                <span className="text-[11px] text-white font-bold leading-tight">{cap.used}/{cap.max}</span>
                                {cap.remaining > 0 ? (
                                  <span className="text-[9px] text-white opacity-90 leading-tight">+{cap.remaining}</span>
                                ) : (
                                  <span className="text-[9px] text-white opacity-90 leading-tight">FULL</span>
                                )}
                              </div>
                            )
                          }
                          // Cella full_day standard (non collettivo)
                          return (
                            <div
                              onClick={(e) => { e.stopPropagation(); handleBookingClick(fullDayBooking, e) }}
                              className={`${getCellColor(fullDayBooking)} rounded w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex flex-col items-center justify-center gap-0.5`}
                            >
                              <span className="text-xs opacity-80">☀️</span>{fullDayBooking.booking_source === 'online' && <span className="text-[9px] font-bold text-white bg-black/30 rounded px-1 leading-tight">on-line</span>}
                              {viewRange === 'two-days' && (
                                <span className="text-xs text-white font-medium truncate px-1 max-w-full">
                                  {fullDayBooking.customer?.first_name}
                                </span>
                              )}
                            </div>
                          )
                        })() : (
                          <div className="flex gap-0.5 h-full">
                            {/* Mattina */}
                            <div className="flex-1">
                              {morningBooking ? (
                                <div
                                  onClick={(e) => { e.stopPropagation(); handleBookingClick(morningBooking, e) }}
                                  className={`${getCellColor(morningBooking)} rounded-l w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex flex-col items-center justify-center gap-0.5`}
                                >
                                  <span className="text-xs opacity-80">🌅</span>{morningBooking.booking_source === 'online' && <span className="text-[9px] font-bold text-white bg-black/30 rounded px-1 leading-tight">on-line</span>}
                                  {viewRange === 'two-days' && (
                                    <span className="text-xs text-white font-medium truncate px-1 max-w-full">
                                      {morningBooking.customer?.first_name}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className={`w-full h-full rounded-l ${isHighlighted ? 'bg-blue-10' : 'bg-gray-50'}`}></div>
                              )}
                            </div>

                            {/* Pomeriggio */}
                            <div className="flex-1">
                              {afternoonBooking ? (
                                <div
                                  onClick={(e) => { e.stopPropagation(); handleBookingClick(afternoonBooking, e) }}
                                  className={`${getCellColor(afternoonBooking)} w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex flex-col items-center justify-center gap-0.5`}
                                >
                                  <span className="text-xs opacity-80">🌇</span>{afternoonBooking.booking_source === 'online' && <span className="text-[9px] font-bold text-white bg-black/30 rounded px-1 leading-tight">on-line</span>}
                                  {viewRange === 'two-days' && (
                                    <span className="text-xs text-white font-medium truncate px-1 max-w-full">
                                      {afternoonBooking.customer?.first_name}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className={`w-full h-full ${isHighlighted ? 'bg-blue-100' : 'bg-gray-50'}`}></div>
                              )}
                            </div>

                            {/* Sera / Custom */}
                            <div className="flex-1">
                              {eveningBooking ? (
                                <div
                                  onClick={(e) => { e.stopPropagation(); handleBookingClick(eveningBooking, e) }}
                                  className={`${getCellColor(eveningBooking)} rounded-r w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex flex-col items-center justify-center gap-0.5`}
                                >
                                  <span className="text-xs opacity-80">🌙</span>{eveningBooking.booking_source === 'online' && <span className="text-[9px] font-bold text-white bg-black/30 rounded px-1 leading-tight">on-line</span>}
                                  {viewRange === 'two-days' && (
                                    <span className="text-xs text-white font-medium truncate px-1 max-w-full">
                                      {eveningBooking.customer?.first_name}
                                    </span>
                                  )}
                                </div>
                              ) : otherBookings.length > 0 ? (
                                <div
                                  onClick={(e) => { e.stopPropagation(); handleBookingClick(otherBookings[0], e) }}
                                  className={`${getCellColor(otherBookings[0])} rounded-r w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex items-center justify-center`}
                                >
                                  <span className="text-xs font-bold">
                                    {otherBookings.length > 1 ? `+${otherBookings.length}` : '🕐'}
                                  </span>
                                </div>
                              ) : (
                                <div className={`w-full h-full rounded-r ${isHighlighted ? 'bg-blue-100' : 'bg-gray-50'}`}></div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info footer */}
      <div className="mt-2 md:mt-4 text-xs md:text-sm text-gray-500 text-center">
        {isStaff
          ? '👁️ Modalità Solo Visualizzazione'
          : '💡 Tocca una cella per creare prenotazione/indisponibilità • Tocca un evento per modificarlo'}
      </div>

      {/* Slot Menu */}
      {showSlotMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSlotMenu(false)} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-2 min-w-[180px] md:min-w-[200px]"
            style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}
          >
            <button
              onClick={openBookingModal}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-left hover: flex items-center gap-2 md:gap-3 transition-colors"
            >
              <span className="text-xl md:text-2xl">📅</span>
              <div>
                <div className="font-semibold text-gray-900 text-sm md:text-base">Nuova Prenotazione</div>
                <div className="text-xs text-gray-500 truncate">
                  {selectedBoat?.name} - {selectedDate && format(selectedDate, 'd MMM', { locale: it })}
                </div>
              </div>
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              onClick={openUnavailabilityModal}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-left hover:bg-red-50 flex items-center gap-2 md:gap-3 transition-colors"
            >
              <span className="text-xl md:text-2xl">🚫</span>
              <div>
                <div className="font-semibold text-gray-900 text-sm md:text-base">Indisponibilità</div>
                <div className="text-xs text-gray-500 truncate">Blocca {selectedBoat?.name}</div>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Booking Context Menu */}
      {showBookingMenu && clickedBooking && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowBookingMenu(false)} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-2 min-w-[200px] md:min-w-[240px]"
            style={{ top: `${bookingMenuPosition.y}px`, left: `${bookingMenuPosition.x}px` }}
          >
            <div className="px-3 md:px-4 py-2 border-b border-gray-100">
              <div className="font-semibold text-gray-900 text-sm">
                {clickedBooking.booking_number || 'Prenotazione'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {clickedBooking.customer?.first_name} {clickedBooking.customer?.last_name}
                {clickedBooking.final_price ? ` • €${clickedBooking.final_price}` : ''}
              </div>
            </div>

            <button
              onClick={openEditBooking}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-left hover:bg-blue-100 flex items-center gap-2 md:gap-3 transition-colors"
            >
              <span className="text-lg md:text-xl">✏️</span>
              <div className="font-semibold text-gray-900 text-sm md:text-base">Modifica</div>
            </button>
            <div className="border-t border-gray-100"></div>
            <button
              onClick={openDeleteConfirm}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-left hover:bg-red-50 flex items-center gap-2 md:gap-3 transition-colors"
            >
              <span className="text-lg md:text-xl">🗑️</span>
              <div className="font-semibold text-red-600 text-sm md:text-base">Cancella</div>
            </button>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && clickedBooking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !deleting && setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-gray-900">Conferma Cancellazione</h3>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-sm space-y-1">
                <div><strong>Prenotazione:</strong> {clickedBooking.booking_number}</div>
                <div><strong>Cliente:</strong> {clickedBooking.customer?.first_name} {clickedBooking.customer?.last_name}</div>
                <div><strong>Barca:</strong> {clickedBooking.boat?.name}</div>
                <div><strong>Data:</strong> {clickedBooking.booking_date}</div>
                {clickedBooking.final_price && (
                  <div><strong>Importo:</strong> €{clickedBooking.final_price}</div>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-600 text-center mb-5">
              Questa azione è <strong>irreversibile</strong>. La prenotazione verrà eliminata definitivamente.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setClickedBooking(null) }}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteBooking}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <><span className="animate-spin">⏳</span> Cancellazione...</>
                ) : (
                  <>🗑️ Cancella Prenotazione</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={handleClose}
        onSave={handleSave}
        booking={selectedBooking}
        preselectedDate={selectedDate || undefined}
        preselectedBoatId={selectedBoat?.id}
      />

      <UnavailabilityModal
        isOpen={showUnavailabilityModal}
        onClose={handleClose}
        onSave={handleSave}
        unavailability={selectedUnavailability}
        preselectedDate={selectedDate || undefined}
        preselectedBoatId={selectedBoat?.id}
      />
    </div>
  )
}