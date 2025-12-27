'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'
import UnavailabilityModal from '@/components/UnavailabilityModal'

export default function PlanningPage() {
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

  const weekStart = startOfWeek(date, { locale: it, weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    loadData()
  }, [date])

  async function loadData() {
    try {
      setLoading(true)

      const start = format(weekStart, 'yyyy-MM-dd')
      const end = format(endOfWeek(date, { locale: it, weekStartsOn: 1 }), 'yyyy-MM-dd')

      // Carica barche
      const boatsRes = await fetch('/api/boats')
      const boatsData = await boatsRes.json()

      // Carica prenotazioni
      const bookingsRes = await fetch(`/api/bookings?start=${start}&end=${end}`)
      const bookingsData = await bookingsRes.json()

      // Carica indisponibilità
      const unavailRes = await fetch(`/api/unavailabilities?start=${start}&end=${end}`)
      const unavailData = await unavailRes.json()

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

  const getStatusColor = (code: string) => {
    switch (code) {
      case 'confirmed': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'completed': return 'bg-blue-500'
      case 'cancelled': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Planning Settimanale</h1>
          <p className="text-gray-600">Vista disponibilità barche</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDate(addDays(date, -7))}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ◀ Settimana Precedente
          </button>
          <button
            onClick={() => setDate(new Date())}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Oggi
          </button>
          <button
            onClick={() => setDate(addDays(date, 7))}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Settimana Successiva ▶
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>In Attesa</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Confermata</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Completata</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Cancellata</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-400 opacity-50"></div>
            <span>Indisponibile</span>
          </div>
        </div>
      </div>

      {/* Planning Grid */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="border border-gray-200 p-3 text-left font-semibold text-gray-900 bg-gray-100 w-48">
                Imbarcazione
              </th>
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  className={`border border-gray-200 p-3 text-center font-semibold min-w-[140px] ${
                    isSameDay(day, new Date()) ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                  }`}
                >
                  <div>{format(day, 'EEE', { locale: it })}</div>
                  <div className="text-lg">{format(day, 'd MMM', { locale: it })}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {boats.map((boat) => (
              <tr key={boat.id} className="hover:bg-gray-50">
                <td className="border border-gray-200 p-3 bg-gray-50 font-medium">
                  <div className="text-sm font-semibold text-gray-900">{boat.name}</div>
                  <div className="text-xs text-gray-600">{boat.boat_type}</div>
                </td>
                {weekDays.map((day) => {
                  const dayStr = format(day, 'yyyy-MM-dd')
                  
                  // Trova prenotazioni per questo giorno e barca
                  const dayBookings = bookings.filter(
                    (b) => b.boat_id === boat.id && b.booking_date === dayStr
                  )
                  
                  // Trova indisponibilità per questo giorno e barca
                  const dayUnavail = unavailabilities.find(
                    (u) =>
                      u.boat_id === boat.id &&
                      dayStr >= u.date_from &&
                      dayStr <= u.date_to
                  )

                  return (
                    <td
                      key={day.toISOString()}
                      className="border border-gray-200 p-1 align-top cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={(e) => handleCellClick(boat, day, e)}
                    >
                      <div className="space-y-1">
                        {/* Indisponibilità */}
                        {dayUnavail && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUnavailabilityClick(dayUnavail)
                            }}
                            className="bg-gray-400 bg-opacity-30 rounded p-1.5 text-xs cursor-pointer hover:bg-opacity-50 border border-dashed border-gray-500"
                          >
                            🚫 {dayUnavail.reason || 'Indisponibile'}
                          </div>
                        )}
                        
                        {/* Prenotazioni */}
                        {dayBookings.map((booking) => (
                          <div
                            key={booking.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBookingClick(booking)
                            }}
                            className={`${getStatusColor(
                              booking.booking_status?.code || ''
                            )} text-white rounded p-1.5 text-xs cursor-pointer hover:opacity-80 shadow-sm`}
                          >
                            <div className="font-semibold">
                              {booking.customer?.first_name} {booking.customer?.last_name}
                            </div>
                            <div className="opacity-90">
                              {booking.time_slot?.name || booking.service?.name}
                            </div>
                            <div className="opacity-75">
                              €{(booking.final_price || 0).toFixed(0)}
                            </div>
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

      {/* Info */}
      <div className="mt-4 text-sm text-gray-500 text-center">
        💡 Clicca su una cella per creare prenotazione o indisponibilità • Clicca su un evento per modificarlo
      </div>

      {/* Slot Menu */}
      {showSlotMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSlotMenu(false)} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-2 min-w-[200px]"
            style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}
          >
            <button
              onClick={openBookingModal}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors"
            >
              <span className="text-2xl">📅</span>
              <div>
                <div className="font-semibold text-gray-900">Nuova Prenotazione</div>
                <div className="text-xs text-gray-500">
                  {selectedBoat?.name} - {selectedDate && format(selectedDate, 'd MMM', { locale: it })}
                </div>
              </div>
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              onClick={openUnavailabilityModal}
              className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-3 transition-colors"
            >
              <span className="text-2xl">🚫</span>
              <div>
                <div className="font-semibold text-gray-900">Indisponibilità</div>
                <div className="text-xs text-gray-500">Blocca {selectedBoat?.name}</div>
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