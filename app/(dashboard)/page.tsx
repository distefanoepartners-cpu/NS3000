'use client'

import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, addWeeks } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'
import UnavailabilityModal from '@/components/UnavailabilityModal'

export default function PlanningPage() {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month')
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

  const days = viewMode === 'week'
    ? eachDayOfInterval({
        start: startOfWeek(date, { locale: it, weekStartsOn: 1 }),
        end: endOfWeek(date, { locale: it, weekStartsOn: 1 })
      })
    : eachDayOfInterval({
        start: startOfMonth(date),
        end: endOfMonth(date)
      })

  useEffect(() => {
    loadData()
  }, [date, viewMode])

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
    setSelectedBooking(booking)
    setShowBookingModal(true)
  }

  function handleUnavailabilityClick(unavail: any) {
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
    if (viewMode === 'week') {
      setDate(addWeeks(date, -1))
    } else {
      setDate(addMonths(date, -1))
    }
  }

  function navigateNext() {
    if (viewMode === 'week') {
      setDate(addWeeks(date, 1))
    } else {
      setDate(addMonths(date, 1))
    }
  }

  const getStatusColor = (code: string) => {
    switch (code) {
      case 'confirmed': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'completed': return 'bg-red-500' // Chiusa - rosso
      case 'cancelled': return 'bg-fuchsia-500' // Da Recuperare - fucsia
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
    <div className="p-2 md:p-4 lg:p-8 h-screen flex flex-col">
      {/* Header - Compact on mobile */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
          Planning {viewMode === 'week' ? 'Settimanale' : 'Mensile'}
        </h1>
        <p className="text-sm md:text-base text-gray-600 mb-3">
          {viewMode === 'week' 
            ? format(days[0], 'dd MMM', { locale: it }) + ' - ' + format(days[6], 'dd MMM yyyy', { locale: it })
            : format(date, 'MMMM yyyy', { locale: it })
          }
        </p>

        {/* View Toggle + Navigation - Stack on mobile */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Settimana
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mese
            </button>
          </div>

          {/* Navigation */}
           {/* Month/Year Selector */}
<div className="flex gap-2">
  <select
    value={date.getMonth()}
    onChange={(e) => {
      const newDate = new Date(date)
      newDate.setMonth(parseInt(e.target.value))
      setDate(newDate)
    }}
    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
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
    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
  >
    {[2024, 2025, 2026, 2027].map(year => (
      <option key={year} value={year}>{year}</option>
    ))}
  </select>
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
                <th className="border border-gray-200 p-2 md:p-3 text-left font-semibold text-gray-900 bg-gray-100 w-24 md:w-32 text-xs md:text-sm">
                  Barca
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={`border border-gray-200 p-1 text-center font-semibold w-8 md:w-10 ${
                      isSameDay(day, new Date()) ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    <div className="text-xs">{format(day, 'dd', { locale: it })}</div>
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

                    // Prepara testo tooltip
                    const tooltipText = dayBookings.length > 0
                      ? dayBookings.map(b => 
                          `${b.customer?.first_name} ${b.customer?.last_name} - €${b.final_price} - ${b.booking_status?.name || 'In Attesa'}`
                        ).join('\n')
                      : dayUnavail 
                        ? dayUnavail.reason || 'Indisponibile'
                        : ''

                    return (
                      <td
                        key={day.toISOString()}
                        className="border border-gray-200 p-0.5 align-middle cursor-pointer hover:bg-blue-50 transition-colors h-12"
                        onClick={(e) => handleCellClick(boat, day, e)}
                        title={tooltipText}
                      >
                        <div className="space-y-0.5 min-h-[2rem]">
                          {/* Indisponibilità - solo icona */}
                          {dayUnavail && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnavailabilityClick(dayUnavail)
                              }}
                              className="bg-gray-400 bg-opacity-30 rounded w-full h-8 flex items-center justify-center cursor-pointer hover:bg-opacity-50 border border-dashed border-gray-500"
                            >
                              <span className="text-sm">🚫</span>
                            </div>
                          )}
                          
                          {/* Prenotazioni - solo colore senza testo */}
                          {dayBookings.map((booking) => (
                            <div
                              key={booking.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleBookingClick(booking)
                              }}
                              className={`${getStatusColor(
                                booking.booking_status?.code || 'pending'
                              )} rounded w-full h-8 cursor-pointer hover:opacity-80 shadow-sm transition-opacity`}
                            >
                            </div>
                          ))}
                        </div>
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