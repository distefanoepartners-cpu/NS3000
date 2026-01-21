'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'
import UnavailabilityModal from '@/components/UnavailabilityModal'
import { useAuth } from '@/contexts/AuthContext'

export default function PlanningPage() {
  const { isAdmin, isStaff } = useAuth()
  const [date, setDate] = useState(new Date())
  const [boats, setBoats] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [unavailabilities, setUnavailabilities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showUnavailabilityModal, setShowUnavailabilityModal] = useState(false)
  const [showSlotMenu, setShowSlotMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedBoat, setSelectedBoat] = useState<any>(null)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [selectedUnavailability, setSelectedUnavailability] = useState<any>(null)

  const days = eachDayOfInterval({
    start: startOfMonth(date),
    end: endOfMonth(date)
  })

  useEffect(() => {
    loadData()
  }, [date])

  async function loadData() {
    try {
      setLoading(true)

      const start = format(days[0], 'yyyy-MM-dd')
      const end = format(days[days.length - 1], 'yyyy-MM-dd')

      const [boatsRes, bookingsRes, unavailRes] = await Promise.all([
        fetch('/api/boats'),
        fetch(`/api/bookings?start=${start}&end=${end}`),
        fetch(`/api/unavailabilities?start=${start}&end=${end}`)
      ])

      const [boatsData, bookingsData, unavailData] = await Promise.all([
        boatsRes.json(),
        bookingsRes.json(),
        unavailRes.json()
      ])

      setBoats(boatsData || [])
      setBookings(bookingsData || [])
      setUnavailabilities(unavailData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Errore caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  function handleCellClick(boat: any, day: Date, e: React.MouseEvent) {
    // Blocca se utente staff (solo visualizzazione)
    if (isStaff) {
      toast.info('👁️ Modalità Solo Visualizzazione - Non puoi creare prenotazioni')
      return
    }
    
    // Calcola disponibilità fasce orarie
    const dayStr = format(day, 'yyyy-MM-dd')
    const dayBookings = bookings.filter(
      (b) => b.boat_id === boat.id && b.booking_date === dayStr
    )
    
    const hasFullDay = dayBookings.some(b => b.time_slot === 'full_day')
    const hasMorning = dayBookings.some(b => b.time_slot === 'morning')
    const hasAfternoon = dayBookings.some(b => b.time_slot === 'afternoon')
    const hasEvening = dayBookings.some(b => b.time_slot === 'evening')
    
    // Se c'è full day o indisponibilità, non aprire il menu
    const dayUnavail = unavailabilities.find(
      (u) => u.boat_id === boat.id && dayStr >= u.date_from && dayStr <= u.date_to
    )
    
    // Blocca solo se: full day OPPURE tutte e 3 le fasce OPPURE indisponibilità
    if (hasFullDay || dayUnavail || (hasMorning && hasAfternoon && hasEvening)) {
      toast.info('Questa giornata è completamente occupata')
      return
    }
    
    // Salva info disponibilità per il modal
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

  function handleBookingClick(booking: any) {
    // Per staff: mostra solo i dettagli, non consente modifica
    if (isStaff) {
      toast.info('👁️ Solo Visualizzazione - Vai su Prenotazioni per vedere i dettagli')
      return
    }
    setSelectedBooking(booking)
    setShowBookingModal(true)
  }

  function handleUnavailabilityClick(unavail: any) {
    // Blocca modifica indisponibilità per staff
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
    setSelectedDate(null)
    setSelectedBoat(null)
    setSelectedBooking(null)
    setSelectedUnavailability(null)
  }

  function handleSave() {
    loadData()
  }

  function navigatePrev() {
    setDate(addMonths(date, -1))
  }

  function navigateNext() {
    setDate(addMonths(date, 1))
  }

  const getStatusColor = (code: string) => {
    switch (code) {
      case 'pending': return 'bg-yellow-500' // In Attesa - giallo
      case 'confirmed': return 'bg-green-500' // Confermata - verde
      case 'cancelled': return 'bg-fuchsia-500' // Da Recuperare - fucsia
      case 'completed': return 'bg-red-500' // Chiusa - rosso
      default: return 'bg-gray-500'
    }
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
          Planning Mensile
        </h1>

        {/* Month/Year Controls + Navigation */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          {/* Month/Year + Label */}
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
                className="px-3 py-2 border-2 border-blue-500 rounded-lg text-sm bg-blue-50 font-semibold text-blue-900 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
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
                className="px-3 py-2 border-2 border-blue-500 rounded-lg text-sm bg-blue-50 font-semibold text-blue-900 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
              >
                {[2024, 2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Navigation Buttons */}
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
      </div>

      {/* Legenda - Compact on mobile */}
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
            <div className="w-2 h-2 md:w-3 md:h-3 bg-gray-400 opacity-50"></div>
            <span>Indisponibile</span>
          </div>
        </div>
      </div>

      {/* Planning Grid - Horizontal scroll on mobile */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full">
          <table className="w-full border-collapse min-w-[600px]">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="border border-gray-200 p-2 md:p-3 text-left font-semibold text-gray-900 bg-gray-100 w-28 md:w-36 text-xs md:text-sm">
                  Flotta
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={`border border-gray-200 p-1 text-center font-semibold w-10 md:w-14 ${
                      isSameDay(day, new Date()) ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    <div className="text-xs md:text-sm">{format(day, 'dd', { locale: it })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {boats.map((boat) => (
                <tr key={boat.id} className="hover:bg-gray-50">
                  <td className="border border-gray-200 p-1 md:p-2 lg:p-3 bg-gray-50 font-medium sticky left-0 z-[5]">
                    <div className="text-xs md:text-sm font-semibold text-gray-900 truncate">{boat.name}</div>
                  </td>
                  {days.map((day) => {
                    const dayStr = format(day, 'yyyy-MM-dd')
                    
                    const dayBookings = bookings.filter(
                      (b) => b.boat_id === boat.id && b.booking_date === dayStr
                    )
                    
                    const dayUnavail = unavailabilities.find(
                      (u) =>
                        u.boat_id === boat.id &&
                        dayStr >= u.date_from &&
                        dayStr <= u.date_to
                    )

                    // Separa prenotazioni per fascia oraria
                    const morningBooking = dayBookings.find(b => b.time_slot === 'morning')
                    const afternoonBooking = dayBookings.find(b => b.time_slot === 'afternoon')
                    const eveningBooking = dayBookings.find(b => b.time_slot === 'evening')
                    const fullDayBooking = dayBookings.find(b => b.time_slot === 'full_day')
                    
                    // Altre prenotazioni (custom time slots o extras)
                    const otherBookings = dayBookings.filter(b => 
                      !['morning', 'afternoon', 'evening', 'full_day'].includes(b.time_slot)
                    )

                    // Prepara testo tooltip
                    const tooltipText = dayBookings.length > 0
                      ? dayBookings.map(b => {
                          const slot = b.time_slot === 'morning' ? '🌅 Mattina' : 
                                      b.time_slot === 'afternoon' ? '🌇 Pomeriggio' :
                                      b.time_slot === 'evening' ? '🌙 Sera' :
                                      b.time_slot === 'full_day' ? '☀️ Full Day' : 
                                      '🕐 ' + (b.time_slot || 'Custom')
                          return `${slot} - ${b.customer?.first_name} ${b.customer?.last_name} - €${b.final_price}`
                        }).join('\n')
                      : dayUnavail 
                        ? dayUnavail.reason || 'Indisponibile'
                        : ''

                    return (
                      <td
                        key={day.toISOString()}
                        className="border border-gray-200 p-0.5 align-middle cursor-pointer hover:bg-blue-50 transition-colors h-16"
                        onClick={(e) => handleCellClick(boat, day, e)}
                        title={tooltipText}
                      >
                        {/* Indisponibilità - occupa tutta la cella */}
                        {dayUnavail ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUnavailabilityClick(dayUnavail)
                            }}
                            className="bg-gray-400 bg-opacity-30 rounded w-full h-full flex items-center justify-center cursor-pointer hover:bg-opacity-50 border border-dashed border-gray-500"
                          >
                            <span className="text-sm">🚫</span>
                          </div>
                        ) : fullDayBooking ? (
                          /* Full Day - occupa tutta la cella */
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBookingClick(fullDayBooking)
                            }}
                            className={`${getStatusColor(
                              fullDayBooking.booking_status?.code || 'pending'
                            )} rounded w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex items-center justify-center`}
                          >
                            <span className="text-xs opacity-70">☀️</span>
                          </div>
                        ) : (
                          /* Diviso in 3 fasce: Mattina / Pomeriggio / Sera */
                          <div className="flex gap-0.5 h-full">
                            {/* Mattina - 1/3 sinistra */}
                            <div className="flex-1">
                              {morningBooking ? (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleBookingClick(morningBooking)
                                  }}
                                  className={`${getStatusColor(
                                    morningBooking.booking_status?.code || 'pending'
                                  )} rounded-l w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex items-center justify-center`}
                                >
                                  <span className="text-xs opacity-70">🌅</span>
                                </div>
                              ) : (
                                <div className="w-full h-full bg-gray-50 rounded-l"></div>
                              )}
                            </div>
                            
                            {/* Pomeriggio - 1/3 centro */}
                            <div className="flex-1">
                              {afternoonBooking ? (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleBookingClick(afternoonBooking)
                                  }}
                                  className={`${getStatusColor(
                                    afternoonBooking.booking_status?.code || 'pending'
                                  )} w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex items-center justify-center`}
                                >
                                  <span className="text-xs opacity-70">🌇</span>
                                </div>
                              ) : (
                                <div className="w-full h-full bg-gray-50"></div>
                              )}
                            </div>

                            {/* Sera/Custom - 1/3 destra */}
                            <div className="flex-1">
                              {eveningBooking ? (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleBookingClick(eveningBooking)
                                  }}
                                  className={`${getStatusColor(
                                    eveningBooking.booking_status?.code || 'pending'
                                  )} rounded-r w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex items-center justify-center`}
                                >
                                  <span className="text-xs opacity-70">🌙</span>
                                </div>
                              ) : otherBookings.length > 0 ? (
                                /* Badge per altre prenotazioni custom */
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleBookingClick(otherBookings[0])
                                  }}
                                  className={`${getStatusColor(
                                    otherBookings[0].booking_status?.code || 'pending'
                                  )} rounded-r w-full h-full cursor-pointer hover:opacity-80 shadow-sm transition-opacity flex items-center justify-center`}
                                >
                                  <span className="text-xs font-bold">
                                    {otherBookings.length > 1 ? `+${otherBookings.length}` : '🕐'}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-full h-full bg-gray-50 rounded-r"></div>
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

      {/* Info - Compact on mobile */}
      <div className="mt-2 md:mt-4 text-xs md:text-sm text-gray-500 text-center">
        💡 Tocca una cella per creare prenotazione/indisponibilità • Tocca un evento per modificarlo
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
              className="w-full px-3 md:px-4 py-2 md:py-3 text-left hover:bg-blue-50 flex items-center gap-2 md:gap-3 transition-colors"
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