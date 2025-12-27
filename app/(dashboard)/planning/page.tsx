'use client'

import { useState, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addDays, startOfMonth, endOfMonth } from 'date-fns'
import { it } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'
import UnavailabilityModal from '@/components/UnavailabilityModal'

const locales = {
  'it': it,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

export default function PlanningPage() {
  const [view, setView] = useState<View>('week')
  const [date, setDate] = useState(new Date())
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showUnavailabilityModal, setShowUnavailabilityModal] = useState(false)
  const [showSlotMenu, setShowSlotMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [selectedUnavailability, setSelectedUnavailability] = useState<any>(null)

  useEffect(() => {
    loadBookings()
  }, [date, view])

  async function loadBookings() {
    try {
      setLoading(true)
      
      // Calcola range date da caricare
      const start = view === 'month' 
        ? startOfMonth(date)
        : startOfWeek(date, { locale: it })
      
      const end = view === 'month'
        ? endOfMonth(date)
        : addDays(start, 6)

      // Carica prenotazioni
      const bookingsRes = await fetch(`/api/bookings?start=${format(start, 'yyyy-MM-dd')}&end=${format(end, 'yyyy-MM-dd')}`)
      const bookings = await bookingsRes.json()

      // Carica indisponibilità
      const unavailRes = await fetch(`/api/unavailabilities?start=${format(start, 'yyyy-MM-dd')}&end=${format(end, 'yyyy-MM-dd')}`)
      const unavailabilities = await unavailRes.json()

      // Converti prenotazioni in eventi
      const bookingEvents = bookings.map((booking: any) => ({
        id: booking.id,
        title: `${booking.customer?.first_name} ${booking.customer?.last_name} - ${booking.boat?.name}`,
        start: new Date(booking.booking_date + 'T' + (booking.time_slot?.start_time || '09:00')),
        end: new Date(booking.booking_date + 'T' + (booking.time_slot?.end_time || '18:00')),
        resource: booking,
        type: 'booking',
        status: booking.booking_status?.code || 'pending'
      }))

      // Converti indisponibilità in eventi
      const unavailEvents = unavailabilities.map((unavail: any) => ({
        id: unavail.id,
        title: `🚫 ${unavail.boat?.name} - ${unavail.reason || 'Indisponibile'}`,
        start: new Date(unavail.date_from + 'T00:00:00'),
        end: new Date(unavail.date_to + 'T23:59:59'),
        resource: unavail,
        type: 'unavailability',
        allDay: true
      }))

      setEvents([...bookingEvents, ...unavailEvents])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Errore caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  // Gestisci click su slot vuoto - Mostra menu
  function handleSelectSlot({ start, box }: { start: Date, box?: { x: number, y: number } }) {
    setSelectedDate(start)
    setMenuPosition({ x: box?.x || 0, y: box?.y || 0 })
    setShowSlotMenu(true)
  }

  // Crea prenotazione
  function openBookingModal() {
    setShowSlotMenu(false)
    setSelectedBooking(null)
    setShowBookingModal(true)
  }

  // Crea indisponibilità
  function openUnavailabilityModal() {
    setShowSlotMenu(false)
    setSelectedUnavailability(null)
    setShowUnavailabilityModal(true)
  }

  // Gestisci click su evento esistente
  function handleSelectEvent(event: any) {
    if (event.type === 'booking') {
      setSelectedBooking(event.resource)
      setSelectedDate(null)
      setShowBookingModal(true)
    } else if (event.type === 'unavailability') {
      setSelectedUnavailability(event.resource)
      setSelectedDate(null)
      setShowUnavailabilityModal(true)
    }
  }

  // Chiudi modals e ricarica
  function handleCloseModal() {
    setShowBookingModal(false)
    setShowUnavailabilityModal(false)
    setShowSlotMenu(false)
    setSelectedDate(null)
    setSelectedBooking(null)
    setSelectedUnavailability(null)
  }

  function handleSave() {
    loadBookings()
  }

  // Stile eventi in base al tipo e stato
  const eventStyleGetter = (event: any) => {
    if (event.type === 'unavailability') {
      return {
        style: {
          backgroundColor: '#94a3b8', // gray
          borderRadius: '5px',
          opacity: 0.7,
          color: 'white',
          border: '2px dashed #64748b',
          display: 'block',
          fontSize: view === 'month' ? '11px' : '13px',
          padding: '2px 5px'
        }
      }
    }

    let backgroundColor = '#3b82f6' // blue default
    
    switch (event.status) {
      case 'confirmed':
        backgroundColor = '#10b981' // green
        break
      case 'pending':
        backgroundColor = '#f59e0b' // yellow
        break
      case 'completed':
        backgroundColor = '#6366f1' // indigo
        break
      case 'cancelled':
        backgroundColor = '#ef4444' // red
        break
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: view === 'month' ? '11px' : '13px',
        padding: '2px 5px'
      }
    }
  }

  // Messaggi tradotti
  const messages = {
    allDay: 'Tutto il giorno',
    previous: '◀',
    next: '▶',
    today: 'Oggi',
    month: 'Mese',
    week: 'Settimana',
    day: 'Giorno',
    agenda: 'Agenda',
    date: 'Data',
    time: 'Ora',
    event: 'Evento',
    noEventsInRange: 'Nessuna prenotazione in questo periodo',
    showMore: (total: number) => `+ ${total} altre`
  }

  return (
    <div className="p-4 md:p-8 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Planning</h1>
        <p className="text-gray-600">Gestisci prenotazioni e disponibilità</p>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Vista */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Vista:</span>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setView('week')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'week' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📅 Settimana
              </button>
              <button
                onClick={() => setView('month')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'month' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📊 Mese
              </button>
            </div>
          </div>

          {/* Legenda Stati */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-600">In Attesa</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">Confermata</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
              <span className="text-gray-600">Completata</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-600">Cancellata</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-600">Caricamento...</div>
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            messages={messages}
            culture="it"
            min={new Date(2024, 0, 1, 8, 0, 0)} // Inizia alle 8:00
            max={new Date(2024, 0, 1, 20, 0, 0)} // Finisce alle 20:00
            step={30}
            timeslots={2}
            views={['month', 'week', 'day']}
            popup
          />
        )}
      </div>

      {/* Info */}
      <div className="mt-4 text-sm text-gray-500 text-center">
        💡 Clicca su uno slot vuoto per creare prenotazione o indisponibilità • Clicca su un evento per modificarlo
      </div>

      {/* Slot Menu (Prenotazione o Indisponibilità) */}
      {showSlotMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowSlotMenu(false)}
          />
          <div 
            className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-2 min-w-[200px]"
            style={{ 
              top: `${menuPosition.y}px`, 
              left: `${menuPosition.x}px` 
            }}
          >
            <button
              onClick={openBookingModal}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors"
            >
              <span className="text-2xl">📅</span>
              <div>
                <div className="font-semibold text-gray-900">Nuova Prenotazione</div>
                <div className="text-xs text-gray-500">Cliente e servizio</div>
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
                <div className="text-xs text-gray-500">Blocca date barca</div>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Booking Modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={handleCloseModal}
        onSave={handleSave}
        booking={selectedBooking}
        preselectedDate={selectedDate || undefined}
      />

      {/* Unavailability Modal */}
      <UnavailabilityModal
        isOpen={showUnavailabilityModal}
        onClose={handleCloseModal}
        onSave={handleSave}
        unavailability={selectedUnavailability}
        preselectedDate={selectedDate || undefined}
      />
    </div>
  )
}