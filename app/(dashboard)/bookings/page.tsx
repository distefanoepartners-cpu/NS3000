'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import Link from 'next/link'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'

export default function PrenotazioniPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)

  useEffect(() => {
    loadBookings()
    loadStats()
  }, [])

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

  // Filtri
  const filteredBookings = bookings.filter((b) => {
    // Filtro ricerca
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = 
      b.booking_number?.toLowerCase().includes(searchLower) ||
      b.customer?.first_name?.toLowerCase().includes(searchLower) ||
      b.customer?.last_name?.toLowerCase().includes(searchLower) ||
      b.customer?.email?.toLowerCase().includes(searchLower) ||
      b.service?.name?.toLowerCase().includes(searchLower)

    // Filtro stato
    const matchesStatus = 
      filterStatus === 'all' || 
      b.booking_status?.code === filterStatus

    // Filtro metodo pagamento
    const matchesPayment = 
      filterPayment === 'all' || 
      b.payment_method?.code === filterPayment

    return matchesSearch && matchesStatus && matchesPayment
  })

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Prenotazioni</h1>
          <p className="text-gray-600">Gestisci tutte le prenotazioni</p>
        </div>
        <button
          onClick={() => setShowBookingModal(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          ➕ Nuova Prenotazione
        </button>
      </div>

      {/* Filtri */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cerca</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Codice, cliente, email, servizio..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stato Prenotazione</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tutte</option>
              <option value="pending">In Attesa</option>
              <option value="confirmed">Confermate</option>
              <option value="completed">Completate</option>
              <option value="cancelled">Cancellate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Metodo Pagamento</label>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tutti</option>
              <option value="stripe">Stripe</option>
              <option value="cash">Contanti</option>
              <option value="pos">POS</option>
              <option value="bank_transfer">Bonifico</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabella Prenotazioni */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Servizio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Importo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Metodo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Stato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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
                          {format(new Date(booking.booking_date), 'dd MMM yyyy', { locale: it })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {booking.time_slot?.name || booking.booking_number}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {booking.customer?.first_name} {booking.customer?.last_name}
                        </div>
                        <div className="text-xs text-gray-500">{booking.customer?.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{booking.service?.name}</div>
                        <div className="text-xs text-gray-500">{booking.boat?.name}</div>
                      </td>
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
                          {booking.payment_method?.name || '⚠️ Non impostato'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          booking.booking_status?.code === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.booking_status?.code === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          booking.booking_status?.code === 'completed' ? 'bg-blue-100 text-blue-800' :
                          booking.booking_status?.code === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.booking_status?.name || 'N/D'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <Link
                            href={`/bookings/${booking.id}`}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            👁️ Dettagli
                          </Link>
                          <button
                            onClick={() => {
                              setSelectedBooking(booking)
                              setShowEditModal(true)
                            }}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            ✏️ Modifica
                          </button>
                          <button
                            onClick={() => handleDelete(booking.id)}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            🗑️ Elimina
                          </button>
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

      {/* Statistiche - SOTTO */}
      {stats && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Statistiche</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Totale Prenotazioni</div>
              <div className="text-2xl font-bold text-blue-900">{stats.totale_prenotazioni || 0}</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-green-600 font-medium">Totale Incassato</div>
              <div className="text-2xl font-bold text-green-900">€{(stats.totale_incassato || 0).toFixed(2)}</div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="text-sm text-orange-600 font-medium">Da Incassare</div>
              <div className="text-2xl font-bold text-orange-900">€{(stats.totale_da_incassare || 0).toFixed(2)}</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-sm text-purple-600 font-medium">Ricavi Oggi</div>
              <div className="text-2xl font-bold text-purple-900">€{(stats.ricavi_oggi || 0).toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-600 font-medium">Ricavi Settimana</div>
              <div className="text-xl font-bold text-gray-900">€{(stats.ricavi_settimana || 0).toFixed(2)}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-600 font-medium">Ricavi Mese</div>
              <div className="text-xl font-bold text-gray-900">€{(stats.ricavi_mese || 0).toFixed(2)}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-600 font-medium">Prenotazioni Confermate</div>
              <div className="text-xl font-bold text-gray-900">{stats.prenotazioni_confermate || 0}</div>
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