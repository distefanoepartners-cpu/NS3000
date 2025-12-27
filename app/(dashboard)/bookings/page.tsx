'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'

export default function PrenotazioniPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroMetodo, setFiltroMetodo] = useState<string>('tutti')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingBooking, setEditingBooking] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // Carica statistiche
      const statsRes = await fetch('/api/bookings/stats')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      // Carica prenotazioni
      const bookingsRes = await fetch('/api/bookings')
      const bookingsData = await bookingsRes.json()

      setBookings(bookingsData || [])
    } catch (error: any) {
      console.error('Errore:', error)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  const bookingsFiltrate = bookings.filter(b => {
    // Filtro stato
    if (filtroStato !== 'tutti' && b.booking_status?.code !== filtroStato) return false
    
    // Filtro metodo pagamento
    if (filtroMetodo !== 'tutti') {
      if (filtroMetodo === 'non_impostato' && b.payment_method_id) return false
      if (filtroMetodo !== 'non_impostato' && b.payment_method?.code !== filtroMetodo) return false
    }
    
    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const matchCodice = b.booking_number?.toLowerCase().includes(term)
      const matchCliente = `${b.customer?.first_name} ${b.customer?.last_name}`.toLowerCase().includes(term)
      const matchEmail = b.customer?.email?.toLowerCase().includes(term)
      const matchServizio = b.service?.name?.toLowerCase().includes(term)
      
      if (!matchCodice && !matchCliente && !matchEmail && !matchServizio) return false
    }
    
    return true
  })

  function handleEdit(booking: any) {
    setEditingBooking(booking)
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditingBooking(null)
  }

  function handleSave() {
    loadData()
  }

  const getStatoColor = (code: string) => {
    switch (code) {
      case 'confirmed': return 'bg-green-100 text-green-700'
      case 'pending': return 'bg-yellow-100 text-yellow-700'
      case 'completed': return 'bg-blue-100 text-blue-700'
      case 'cancelled': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  // Calcola incassi per metodo
  const incassiPerMetodo = {
    stripe: bookings
      .filter(b => b.payment_method?.code === 'stripe')
      .reduce((sum, b) => sum + (b.deposit_amount || 0) + (b.balance_amount || 0), 0),
    cash: bookings
      .filter(b => b.payment_method?.code === 'cash')
      .reduce((sum, b) => sum + (b.deposit_amount || 0) + (b.balance_amount || 0), 0),
    pos: bookings
      .filter(b => b.payment_method?.code === 'pos')
      .reduce((sum, b) => sum + (b.deposit_amount || 0) + (b.balance_amount || 0), 0),
    bank_transfer: bookings
      .filter(b => b.payment_method?.code === 'bank_transfer')
      .reduce((sum, b) => sum + (b.deposit_amount || 0) + (b.balance_amount || 0), 0),
    nonImpostato: bookings.filter(b => !b.payment_method_id).length
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento prenotazioni...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Prenotazioni</h1>
          <p className="text-gray-600">Gestisci tutte le prenotazioni e i pagamenti</p>
        </div>
        <button
          onClick={() => {
            setEditingBooking(null)
            setShowModal(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          ➕ Nuova Prenotazione
        </button>
      </div>

      {/* Statistiche Ricavi */}
      {stats && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistiche Ricavi</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Ricavi Oggi */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">💰</span>
                <span className="text-xs opacity-80">Oggi</span>
              </div>
              <div className="text-2xl font-bold">
                €{(stats.ricavi_oggi || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs opacity-80 mt-1">Ricavi Oggi</div>
            </div>

            {/* Ricavi Settimana */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📊</span>
                <span className="text-xs opacity-80">7 giorni</span>
              </div>
              <div className="text-2xl font-bold">
                €{(stats.ricavi_settimana || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs opacity-80 mt-1">Ricavi Settimana</div>
            </div>

            {/* Ricavi Mese */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📈</span>
                <span className="text-xs opacity-80">30 giorni</span>
              </div>
              <div className="text-2xl font-bold">
                €{(stats.ricavi_mese || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs opacity-80 mt-1">Ricavi Mese</div>
            </div>

            {/* Totale Incassato */}
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">✅</span>
                <span className="text-xs opacity-80">Incassato</span>
              </div>
              <div className="text-2xl font-bold">
                €{(stats.totale_incassato || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs opacity-80 mt-1">Totale Incassato</div>
            </div>

            {/* Da Incassare */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">⏳</span>
                <span className="text-xs opacity-80">Pending</span>
              </div>
              <div className="text-2xl font-bold">
                €{(stats.totale_da_incassare || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs opacity-80 mt-1">Da Incassare</div>
            </div>

            {/* Prenotazioni */}
            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📋</span>
                <span className="text-xs opacity-80">Totali</span>
              </div>
              <div className="text-2xl font-bold">
                {stats.totale_prenotazioni || 0}
              </div>
              <div className="text-xs opacity-80 mt-1">Prenotazioni</div>
            </div>
          </div>
        </div>
      )}

      {/* Incassi per Metodo */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Incassi per Metodo</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-2xl mb-1">💳</div>
            <div className="text-2xl font-bold text-blue-600">
              €{incassiPerMetodo.stripe.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-blue-700 mt-1">Stripe</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-2xl mb-1">💵</div>
            <div className="text-2xl font-bold text-green-600">
              €{incassiPerMetodo.cash.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-green-700 mt-1">Contanti</div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-2xl mb-1">💳</div>
            <div className="text-2xl font-bold text-purple-600">
              €{incassiPerMetodo.pos.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-purple-700 mt-1">POS</div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="text-2xl mb-1">🏦</div>
            <div className="text-2xl font-bold text-orange-600">
              €{incassiPerMetodo.bank_transfer.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-orange-700 mt-1">Bonifico</div>
          </div>

          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-2xl mb-1">⚠️</div>
            <div className="text-2xl font-bold text-red-600">
              {incassiPerMetodo.nonImpostato}
            </div>
            <div className="text-xs text-red-700 mt-1">Non Impostato</div>
          </div>
        </div>
      </div>

      {/* Stato Prenotazioni */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Stato Prenotazioni</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-3xl font-bold text-yellow-600">
              {bookings.filter(b => b.booking_status?.code === 'pending').length}
            </div>
            <div className="text-sm text-yellow-700 mt-1">In Attesa</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-3xl font-bold text-green-600">
              {bookings.filter(b => b.booking_status?.code === 'confirmed').length}
            </div>
            <div className="text-sm text-green-700 mt-1">Confermate</div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-3xl font-bold text-blue-600">
              {bookings.filter(b => b.booking_status?.code === 'completed').length}
            </div>
            <div className="text-sm text-blue-700 mt-1">Completate</div>
          </div>

          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-3xl font-bold text-red-600">
              {bookings.filter(b => b.booking_status?.code === 'cancelled').length}
            </div>
            <div className="text-sm text-red-700 mt-1">Cancellate</div>
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cerca</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Codice, cliente, email, servizio..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Stato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stato Prenotazione</label>
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutti">Tutte</option>
              <option value="pending">In Attesa</option>
              <option value="confirmed">Confermate</option>
              <option value="completed">Completate</option>
              <option value="cancelled">Cancellate</option>
            </select>
          </div>

          {/* Metodo Pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Metodo Pagamento</label>
            <select
              value={filtroMetodo}
              onChange={(e) => setFiltroMetodo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="tutti">Tutti</option>
              <option value="stripe">💳 Stripe</option>
              <option value="cash">💵 Contanti</option>
              <option value="pos">💳 POS</option>
              <option value="bank_transfer">🏦 Bonifico</option>
              <option value="non_impostato">⚠️ Non Impostato</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista Prenotazioni */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">DATA</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">CLIENTE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">SERVIZIO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">IMPORTO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">METODO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">STATO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">AZIONI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bookingsFiltrate.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  {/* Data */}
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">
                      {format(new Date(booking.booking_date), 'dd MMM yyyy', { locale: it })}
                    </div>
                    {booking.time_slot && (
                      <div className="text-sm text-gray-500">
                        {booking.time_slot.start_time} - {booking.time_slot.end_time}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {booking.booking_number}
                    </div>
                  </td>

                  {/* Cliente */}
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">
                      {booking.customer?.first_name} {booking.customer?.last_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {booking.customer?.email}
                    </div>
                    {booking.num_passengers && (
                      <div className="text-xs text-gray-400 mt-1">
                        👥 {booking.num_passengers} persone
                      </div>
                    )}
                  </td>

                  {/* Servizio */}
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">
                      {booking.service?.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {booking.boat?.name}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {booking.service_type === 'rental' ? 'Noleggio' : 'Locazione'}
                    </div>
                  </td>

                  {/* Importo */}
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="text-gray-600">Totale: </span>
                        <span className="font-bold text-gray-900">
                          €{(booking.final_price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-xs text-blue-600">
                        Acconto: €{(booking.deposit_amount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">
                        Saldo: €{(booking.balance_amount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs font-semibold text-red-600">
                        Da ricevere: €{(
                          (booking.final_price || 0) - 
                          (booking.deposit_amount || 0) - 
                          (booking.balance_amount || 0)
                        ).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </td>

                  {/* Metodo Pagamento */}
                  <td className="px-4 py-4">
                    {booking.payment_method ? (
                      <div className="text-sm font-semibold">
                        {booking.payment_method.name}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-red-600">
                        ⚠️ Non impostato
                      </div>
                    )}
                  </td>

                  {/* Stato */}
                  <td className="px-4 py-4">
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatoColor(booking.booking_status?.code || '')}`}>
                      {booking.booking_status?.name || 'N/D'}
                    </span>
                  </td>

                  {/* Azioni */}
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEdit(booking)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                        title="Modifica"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => router.push(`/bookings/${booking.id}`)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors" 
                        title="Dettagli"
                      >
                        👁️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {bookingsFiltrate.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p>Nessuna prenotazione trovata con i filtri selezionati</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-6 text-sm text-gray-500 text-center">
        Visualizzate {bookingsFiltrate.length} di {bookings.length} prenotazioni
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSave={handleSave}
        booking={editingBooking}
      />
    </div>
  )
}