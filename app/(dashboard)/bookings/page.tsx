'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'
import { useAuth } from '@/contexts/AuthContext'

export default function PrenotazioniPage() {
  const { isAdmin, isStaff } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [boats, setBoats] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [filterBoat, setFilterBoat] = useState('all')
  const [filterDate, setFilterDate] = useState('all')
  const [customDate, setCustomDate] = useState('')
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)

  // Helper per tradurre time_slot
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
    if (isAdmin) {
      loadStats()
    }
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
    if (!confirm('Sei sicuro di voler eliminare questa prenotazione?')) {
      return
    }

    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Errore eliminazione')

      toast.success('Prenotazione eliminata!')
      loadBookings()
      loadStats()
    } catch (error: any) {
      console.error('Error deleting booking:', error)
      toast.error(error.message)
    }
  }

  const filteredBookings = bookings.filter((b) => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = 
      b.booking_number?.toLowerCase().includes(searchLower) ||
      b.customer?.first_name?.toLowerCase().includes(searchLower) ||
      b.customer?.last_name?.toLowerCase().includes(searchLower) ||
      b.customer?.email?.toLowerCase().includes(searchLower) ||
      b.service?.name?.toLowerCase().includes(searchLower)

    const matchesStatus = 
      filterStatus === 'all' || 
      b.booking_status?.code === filterStatus

    const matchesPayment = 
      filterPayment === 'all' || 
      b.payment_method?.code === filterPayment

    const matchesBoat = 
      filterBoat === 'all' || 
      b.boat_id === filterBoat

    const matchesDate = 
      filterDate === 'all' || 
      (filterDate === 'today' && b.booking_date === format(new Date(), 'yyyy-MM-dd')) ||
      (filterDate === 'custom' && customDate && b.booking_date === customDate)

    return matchesSearch && matchesStatus && matchesPayment && matchesBoat && matchesDate
  })

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
          <p className="text-sm md:text-base text-gray-600">Gestisci tutte le prenotazioni</p>
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
        <div className={`grid grid-cols-1 gap-3 md:gap-4 ${isStaff ? 'md:grid-cols-2' : 'md:grid-cols-5'}`}>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Data</label>
            <select
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value)
                if (e.target.value !== 'custom') {
                  setCustomDate('')
                }
              }}
              className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base font-medium"
            >
              <option value="all">Tutte le date</option>
              <option value="today">🗓️ Prenotazioni Oggi</option>
              <option value="custom">📅 Cerca per data...</option>
            </select>
          </div>

          {/* Campo data personalizzata (appare solo se selezionato) */}
          {filterDate === 'custom' && (
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Seleziona Data</label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 md:px-4 py-2 border-2 border-blue-500 rounded-lg text-sm md:text-base bg-blue-50 font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
          
          {/* FILTRI SOLO ADMIN */}
          {isAdmin && (
            <>
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
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Stato</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
                >
                  <option value="all">Tutte</option>
                  <option value="pending">In Attesa</option>
                  <option value="option">Opzionate</option>
                  <option value="confirmed">Confermate</option>
                  <option value="cancelled">Annullate</option>
                  <option value="completed">Completate</option>
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
            </>
          )}
        </div>
      </div>

      {/* Lista Prenotazioni - Cards on mobile, Table on desktop */}
      
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
              <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                {/* Header Card */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {booking.customer?.first_name} {booking.customer?.last_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(booking.booking_date), 'dd/MM/yyyy')}
                    </div>
                  </div>
                  {isAdmin && (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      booking.booking_status?.code === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      booking.booking_status?.code === 'option' ? 'bg-orange-100 text-orange-800' :
                      booking.booking_status?.code === 'confirmed' ? 'bg-green-100 text-green-800' :
                      booking.booking_status?.code === 'cancelled' ? 'bg-fuchsia-100 text-fuchsia-800' :
                      booking.booking_status?.code === 'completed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {booking.booking_status?.name || 'N/D'}
                    </span>
                  )}
                </div>

                {/* Info - SEMPLIFICATA PER STAFF */}
                <div className="space-y-2 mb-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Servizio:</span>
                    <span className="font-medium text-gray-900">{booking.service?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Barca:</span>
                    <span className="font-medium text-gray-900">{booking.boat?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Passeggeri:</span>
                    <span className="font-medium text-gray-900">{booking.num_passengers} Pax</span>
                  </div>
                  {booking.skipper && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Skipper:</span>
                      <span className="font-medium text-gray-900">
                        {booking.skipper.first_name} {booking.skipper.last_name}
                      </span>
                    </div>
                  )}
                  {/* SOLO ADMIN vede importi */}
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

                {/* Actions */}
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
                        onClick={() => {
                          setSelectedBooking(booking)
                          setShowEditModal(true)
                        }}
                        className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        ✏️ Modifica
                      </button>
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
                {/* COLONNE SOLO ADMIN */}
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
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(booking.booking_date), 'dd/MM/yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getTimeSlotLabel(booking.time_slot)}
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
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900">{booking.num_passengers}</div>
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
                                if (days < 0) {
                                  return <div className="text-xs text-red-600 font-semibold">🔴 Patente SCADUTA</div>
                                } else if (days <= 30) {
                                  return <div className="text-xs text-orange-600 font-semibold">⚠️ Scade tra {days}g</div>
                                }
                                return null
                              })()
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Nessuno skipper</span>
                        )}
                      </td>
                      {/* COLONNE SOLO ADMIN */}
                      {isAdmin && (
                        <>
                          <td className="px-4 py-4">
                            <div className="text-sm font-semibold text-gray-900">
                              Totale: €{(booking.final_price || 0).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-600">
                              Acconto: €{(booking.deposit_amount || 0).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-600">
                              Saldo: €{(booking.balance_amount || 0).toFixed(2)}
                            </div>
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
                              booking.booking_status?.code === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              booking.booking_status?.code === 'option' ? 'bg-orange-100 text-orange-800' :
                              booking.booking_status?.code === 'confirmed' ? 'bg-green-100 text-green-800' :
                              booking.booking_status?.code === 'cancelled' ? 'bg-fuchsia-100 text-fuchsia-800' :
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
                                onClick={() => {
                                  setSelectedBooking(booking)
                                  setShowEditModal(true)
                                }}
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

      {/* Statistiche - SOLO ADMIN */}
      {isAdmin && stats && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">📊 Statistiche</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-blue-50 rounded-lg p-3 md:p-4 border border-blue-200">
              <div className="text-xs md:text-sm text-blue-600 font-medium">Tot. Prenotazioni</div>
              <div className="text-xl md:text-2xl font-bold text-blue-900">{stats.totale_prenotazioni || 0}</div>
            </div>

            <div className="bg-green-50 rounded-lg p-3 md:p-4 border border-green-200">
              <div className="text-xs md:text-sm text-green-600 font-medium">Tot. Incassato</div>
              <div className="text-lg md:text-2xl font-bold text-green-900">€{(stats.totale_incassato || 0).toFixed(0)}</div>
            </div>

            <div className="bg-orange-50 rounded-lg p-3 md:p-4 border border-orange-200">
              <div className="text-xs md:text-sm text-orange-600 font-medium">Da Incassare</div>
              <div className="text-lg md:text-2xl font-bold text-orange-900">€{(stats.totale_da_incassare || 0).toFixed(0)}</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-3 md:p-4 border border-purple-200">
              <div className="text-xs md:text-sm text-purple-600 font-medium">Ricavi Oggi</div>
              <div className="text-lg md:text-2xl font-bold text-purple-900">€{(stats.ricavi_oggi || 0).toFixed(0)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-3 md:mt-4">
            <div className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
              <div className="text-xs md:text-sm text-gray-600 font-medium">Ricavi Settimana</div>
              <div className="text-lg md:text-xl font-bold text-gray-900">€{(stats.ricavi_settimana || 0).toFixed(0)}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
              <div className="text-xs md:text-sm text-gray-600 font-medium">Ricavi Mese</div>
              <div className="text-lg md:text-xl font-bold text-gray-900">€{(stats.ricavi_mese || 0).toFixed(0)}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
              <div className="text-xs md:text-sm text-gray-600 font-medium">Prenotazioni Confermate</div>
              <div className="text-lg md:text-xl font-bold text-gray-900">{stats.prenotazioni_confermate || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuova Prenotazione */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onSave={() => {
          loadBookings()
          loadStats()
        }}
      />

      {/* Modal Modifica Prenotazione */}
      <BookingModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedBooking(null)
        }}
        onSave={() => {
          loadBookings()
          loadStats()
        }}
        booking={selectedBooking}
      />
    </div>
  )
}