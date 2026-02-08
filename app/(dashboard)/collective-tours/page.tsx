'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isBefore } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface BoatBooking {
  id: string
  booking_number: string
  num_passengers: number
  customer_name: string
  customer_phone: string
  customer_email: string
  final_price: number
  deposit_amount: number
  balance_amount: number
  status: string
  status_name: string
  booking_source: string
  boat_assigned: boolean
  notes: string | null
}

interface BoatOccupancy {
  boat_id: string
  boat_name: string
  capacity: number
  passengers_booked: number
  passengers_available: number
  occupancy_percent: number
  is_full: boolean
  bookings: BoatBooking[]
}

interface ExcludedBoat {
  boat_id: string
  boat_name: string
  capacity: number
  reason: 'unavailable' | 'booked_other_service' | 'unknown'
  reason_label: string
}

interface TourDayData {
  date: string
  service_id: string
  service_name: string
  price_per_person: number
  total_capacity: number
  total_booked: number
  total_available: number
  num_boats_available: number
  num_boats_total: number
  boats: BoatOccupancy[]
  excluded_boats: ExcludedBoat[]
  overflow_bookings: BoatBooking[]
  total_revenue: number
  num_bookings: number
}

type ViewMode = 'day' | 'week'

export default function CollectiveToursPage() {
  const { isAdmin } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [tourData, setTourData] = useState<TourDayData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBoat, setExpandedBoat] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      let url: string
      if (viewMode === 'day') {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        url = `/api/collective-tours/capacity?date=${dateStr}`
      } else {
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
        url = `/api/collective-tours/capacity?start=${format(weekStart, 'yyyy-MM-dd')}&end=${format(weekEnd, 'yyyy-MM-dd')}`
      }

      const res = await fetch(url)
      if (!res.ok) throw new Error('Errore caricamento dati')
      const data = await res.json()
      setTourData(data || [])
    } catch (error: any) {
      console.error('Error loading collective tour data:', error)
      toast.error('Errore caricamento dati tour collettivi')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, viewMode])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Navigazione date
  const goToday = () => setSelectedDate(new Date())
  const goPrev = () => setSelectedDate(viewMode === 'day' ? subDays(selectedDate, 1) : subDays(selectedDate, 7))
  const goNext = () => setSelectedDate(viewMode === 'day' ? addDays(selectedDate, 1) : addDays(selectedDate, 7))

  // Dati raggruppati per data (per vista settimanale)
  const dataByDate = tourData.reduce<Record<string, TourDayData[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = []
    acc[item.date].push(item)
    return acc
  }, {})

  // Colore barra occupazione
  function getOccupancyColor(percent: number): string {
    if (percent >= 100) return 'bg-red-500'
    if (percent >= 75) return 'bg-orange-500'
    if (percent >= 50) return 'bg-yellow-500'
    if (percent > 0) return 'bg-green-500'
    return 'bg-gray-200'
  }

  function getOccupancyBg(percent: number): string {
    if (percent >= 100) return 'bg-red-50 border-red-200'
    if (percent >= 75) return 'bg-orange-50 border-orange-200'
    if (percent >= 50) return 'bg-yellow-50 border-yellow-200'
    if (percent > 0) return 'bg-green-50 border-green-200'
    return 'bg-gray-50 border-gray-200'
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-red-100 text-red-800',
      cancelled: 'bg-fuchsia-100 text-fuchsia-800',
      option: 'bg-orange-100 text-orange-800',
    }
    return styles[status] || 'bg-gray-100 text-gray-800'
  }

  // Render singolo tour per un giorno
  function renderTourDay(tour: TourDayData, showDate = false) {
    const dateLabel = showDate
      ? format(new Date(tour.date + 'T12:00:00'), 'EEEE d MMMM', { locale: it })
      : null

    return (
      <div key={`${tour.date}-${tour.service_id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header Tour */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              {dateLabel && (
                <div className="text-xs opacity-80 mb-0.5 capitalize">{dateLabel}</div>
              )}
              <h3 className="text-lg font-bold">{tour.service_name}</h3>
              <div className="text-sm opacity-90">
                €{tour.price_per_person}/persona • {tour.num_boats_available}/{tour.num_boats_total} barche disponibili
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{tour.total_booked}/{tour.total_capacity}</div>
              <div className="text-xs opacity-80">posti occupati</div>
            </div>
          </div>

          {/* Barra totale */}
          <div className="mt-3">
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-white/80 transition-all duration-500"
                style={{ width: `${Math.min(100, tour.total_capacity > 0 ? (tour.total_booked / tour.total_capacity) * 100 : 0)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1 opacity-80">
              <span>{tour.total_booked} prenotati</span>
              <span>{tour.total_available} disponibili</span>
            </div>
          </div>
        </div>

        {/* KPI Riga */}
        <div className="grid grid-cols-3 border-b border-gray-200">
          <div className="px-4 py-3 text-center border-r border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{tour.num_bookings}</div>
            <div className="text-xs text-gray-500">Prenotazioni</div>
          </div>
          <div className="px-4 py-3 text-center border-r border-gray-200">
            <div className="text-2xl font-bold text-green-600">€{tour.total_revenue.toFixed(0)}</div>
            <div className="text-xs text-gray-500">Ricavi giorno</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className={`text-2xl font-bold ${tour.total_available > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {tour.total_available}
            </div>
            <div className="text-xs text-gray-500">Posti vendibili</div>
          </div>
        </div>

        {/* Barche con riempimento progressivo */}
        <div className="p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Riempimento Barche
          </h4>

          {tour.boats.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              Nessuna barca configurata per questo tour
            </div>
          ) : (
            tour.boats.map((boat, idx) => {
              const isExpanded = expandedBoat === `${tour.date}-${tour.service_id}-${boat.boat_id}`
              const expandKey = `${tour.date}-${tour.service_id}-${boat.boat_id}`

              return (
                <div
                  key={boat.boat_id}
                  className={`rounded-lg border p-3 transition-all ${getOccupancyBg(boat.occupancy_percent)}`}
                >
                  {/* Barca header */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedBoat(isExpanded ? null : expandKey)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">
                          {boat.is_full ? '🔴' : boat.occupancy_percent >= 75 ? '🟠' : boat.occupancy_percent > 0 ? '🟢' : '⚪'}
                        </span>
                        <span className="font-semibold text-gray-900">{boat.boat_name}</span>
                      </div>
                      {idx === 0 && !boat.is_full && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          In riempimento
                        </span>
                      )}
                      {boat.is_full && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          Completa
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-900">
                          {boat.passengers_booked}/{boat.capacity}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">pax</span>
                      </div>
                      <span className="text-gray-400 text-sm">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Barra occupazione barca */}
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full transition-all duration-500 flex items-center justify-center ${getOccupancyColor(boat.occupancy_percent)}`}
                        style={{ width: `${Math.min(100, boat.occupancy_percent)}%` }}
                      >
                        {boat.occupancy_percent >= 20 && (
                          <span className="text-xs font-bold text-white">{boat.occupancy_percent}%</span>
                        )}
                      </div>
                    </div>
                    {/* Visualizzazione posti individuali */}
                    <div className="flex gap-0.5 mt-1.5">
                      {Array.from({ length: boat.capacity }, (_, i) => (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded-sm transition-all ${
                            i < boat.passengers_booked
                              ? boat.is_full ? 'bg-red-400' : 'bg-blue-400'
                              : 'bg-gray-200'
                          }`}
                          title={`Posto ${i + 1}: ${i < boat.passengers_booked ? 'Occupato' : 'Disponibile'}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Dettaglio prenotazioni (espandibile) */}
                  {isExpanded && boat.bookings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200/70 space-y-2">
                      {boat.bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-gray-900">
                                {booking.num_passengers}×
                              </span>
                              <span className="text-lg">👤</span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{booking.customer_name}</div>
                              <div className="text-xs text-gray-500">
                                {booking.customer_phone && <span>{booking.customer_phone} • </span>}
                                {booking.booking_source === 'online' ? '🌐 Online' : '📞 Manuale'}
                                {!booking.boat_assigned && (
                                  <span className="ml-1 text-orange-600 font-medium">• ⚠️ Non assegnata</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">€{booking.final_price.toFixed(0)}</div>
                              {isAdmin && booking.balance_amount > 0 && (
                                <div className="text-xs text-red-600">saldo €{booking.balance_amount.toFixed(0)}</div>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(booking.status)}`}>
                              {booking.status_name}
                            </span>
                            <Link
                              href={`/bookings/${booking.id}`}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              👁️
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && boat.bookings.length === 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200/70 text-center text-sm text-gray-400 py-2">
                      Nessuna prenotazione su questa barca
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* Prenotazioni overflow (senza barca) */}
          {tour.overflow_bookings.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h5 className="text-sm font-semibold text-red-700 mb-2">
                ⚠️ Prenotazioni in eccesso ({tour.overflow_bookings.reduce((s, b) => s + b.num_passengers, 0)} pax)
              </h5>
              <p className="text-xs text-red-600 mb-2">
                Queste prenotazioni superano la capienza totale delle barche disponibili
              </p>
              {tour.overflow_bookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm mb-1">
                  <div>
                    <span className="font-medium">{booking.customer_name}</span>
                    <span className="text-gray-500 ml-2">{booking.num_passengers} pax</span>
                  </div>
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Gestisci
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* ⭐ Barche escluse (occupate da altri servizi o indisponibili) */}
          {tour.excluded_boats && tour.excluded_boats.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <h5 className="text-sm font-semibold text-gray-600 mb-2">
                🚫 Barche non disponibili ({tour.excluded_boats.length} su {tour.num_boats_total})
              </h5>
              <div className="space-y-1">
                {tour.excluded_boats.map((boat) => (
                  <div key={boat.boat_id} className="flex items-center justify-between text-sm px-2 py-1.5 bg-white rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">
                        {boat.reason === 'booked_other_service' ? '📅' : '🔧'}
                      </span>
                      <span className="font-medium text-gray-700">{boat.boat_name}</span>
                      <span className="text-xs text-gray-400">({boat.capacity} pax)</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      boat.reason === 'booked_other_service'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {boat.reason_label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Caricamento tour collettivi...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
          👥 Tour Collettivi
        </h1>
        <p className="text-sm text-gray-600">
          Disponibilità e riempimento barche per i tour di gruppo
        </p>
      </div>

      {/* Controlli */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Navigazione data */}
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              ◀ {viewMode === 'day' ? 'Ieri' : 'Sett. prec.'}
            </button>
            <button
              onClick={goToday}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Oggi
            </button>
            <button
              onClick={goNext}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              {viewMode === 'day' ? 'Domani' : 'Sett. succ.'} ▶
            </button>
          </div>

          {/* Data selezionata + picker */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 capitalize">
              {viewMode === 'day'
                ? format(selectedDate, 'EEEE d MMMM yyyy', { locale: it })
                : `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMM', { locale: it })} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: it })}`
              }
            </h2>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => e.target.value && setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Toggle vista */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Giorno
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Settimana
            </button>
          </div>
        </div>
      </div>

      {/* Contenuto */}
      {tourData.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">🚢</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun tour collettivo configurato</h3>
          <p className="text-gray-500 text-sm">
            {viewMode === 'day'
              ? `Non ci sono tour collettivi per ${format(selectedDate, 'd MMMM yyyy', { locale: it })}`
              : 'Non ci sono tour collettivi per questa settimana'
            }
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Configura i servizi di tipo "collective" e associa le barche in Amministrazione → Servizi
          </p>
        </div>
      ) : viewMode === 'day' ? (
        /* VISTA GIORNO */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tourData.map(tour => renderTourDay(tour, false))}
        </div>
      ) : (
        /* VISTA SETTIMANA */
        <div className="space-y-6">
          {Object.entries(dataByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateStr, tours]) => {
              const dateObj = new Date(dateStr + 'T12:00:00')
              const isPast = isBefore(dateObj, new Date()) && !isToday(dateObj)
              
              return (
                <div key={dateStr} className={isPast ? 'opacity-60' : ''}>
                  <h3 className={`text-lg font-bold mb-3 capitalize ${
                    isToday(dateObj) ? 'text-blue-700' : 'text-gray-800'
                  }`}>
                    {isToday(dateObj) && '📌 '}
                    {format(dateObj, 'EEEE d MMMM', { locale: it })}
                    {isToday(dateObj) && ' (Oggi)'}
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {tours.map(tour => renderTourDay(tour, false))}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Footer info */}
      <div className="mt-6 text-center text-xs text-gray-400">
        💡 Clicca su una barca per vedere le prenotazioni dettagliate •
        Le barche vengono riempite in ordine progressivo (dalla più piccola alla più grande)
      </div>
    </div>
  )
}