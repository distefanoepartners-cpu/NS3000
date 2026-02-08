'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

interface Booking {
  id: string
  booking_number: string
  booking_date: string
  time_slot: string
  num_passengers: number
  final_price: number
  deposit_amount: number
  balance_amount: number
  notes: string | null
  booking_source: string
  created_at: string
  customer: { first_name: string; last_name: string; email: string; phone: string } | null
  boat: { name: string } | null
  service: { name: string } | null
  booking_status: { name: string; code: string } | null
}

export default function PartnerBookingsPage() {
  const { user, isPartner } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (user?.supplier_id) {
      loadBookings()
    }
  }, [user])

  async function loadBookings() {
    try {
      setLoading(true)
      const res = await fetch(`/api/bookings?supplier_id=${user!.supplier_id}`)
      if (!res.ok) throw new Error('Errore caricamento')
      const data = await res.json()
      setBookings(data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('Errore caricamento prenotazioni')
    } finally {
      setLoading(false)
    }
  }

  function getTimeSlotLabel(slot: string) {
    const labels: Record<string, string> = {
      morning: '🌅 Mattina',
      afternoon: '🌇 Pomeriggio',
      evening: '🌙 Sera',
      full_day: '☀️ Giornata intera',
    }
    return labels[slot] || slot
  }

  function getStatusBadge(code: string, name: string) {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
      option: 'bg-orange-100 text-orange-800',
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[code] || 'bg-gray-100 text-gray-800'}`}>
        {name}
      </span>
    )
  }

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      !searchQuery ||
      b.booking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customer?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customer?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())

    const today = format(new Date(), 'yyyy-MM-dd')
    const matchesDate =
      filterDate === 'all' ||
      (filterDate === 'today' && b.booking_date === today) ||
      (filterDate === 'upcoming' && b.booking_date >= today) ||
      (filterDate === 'past' && b.booking_date < today)

    return matchesSearch && matchesDate
  })

  // Statistiche rapide
  const today = format(new Date(), 'yyyy-MM-dd')
  const stats = {
    total: bookings.length,
    upcoming: bookings.filter(b => b.booking_date >= today).length,
    totalRevenue: bookings.reduce((sum, b) => sum + (b.final_price || 0), 0),
    totalPax: bookings.reduce((sum, b) => sum + (b.num_passengers || 0), 0),
  }

  if (!isPartner) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Accesso non autorizzato</h1>
        <p className="text-gray-600 mt-2">Questa pagina è riservata ai partner.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Caricamento prenotazioni...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📋 Le mie Prenotazioni</h1>
        <p className="text-sm text-gray-600 mt-1">
          Prenotazioni effettuate dalla tua struttura
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Totale</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500">In programma</div>
          <div className="text-2xl font-bold text-blue-600">{stats.upcoming}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Passeggeri totali</div>
          <div className="text-2xl font-bold text-green-600">{stats.totalPax}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Valore totale</div>
          <div className="text-2xl font-bold text-purple-600">€{stats.totalRevenue.toFixed(0)}</div>
        </div>
      </div>

      {/* Filtri */}
      <div className="mb-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cerca</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Codice, nome cliente..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Periodo</label>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">Tutte</option>
              <option value="today">Oggi</option>
              <option value="upcoming">Future</option>
              <option value="past">Passate</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessuna prenotazione</h3>
          <p className="text-gray-500 text-sm">Non hai ancora effettuato prenotazioni</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((booking) => (
            <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-blue-600">{booking.booking_number}</span>
                    {booking.booking_status && getStatusBadge(booking.booking_status.code, booking.booking_status.name)}
                  </div>
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {booking.customer?.first_name} {booking.customer?.last_name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">€{(booking.final_price || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{booking.num_passengers} pax</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Data: </span>
                  <span className="font-medium">
                    {format(new Date(booking.booking_date + 'T12:00:00'), 'dd/MM/yyyy')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Orario: </span>
                  <span className="font-medium">{getTimeSlotLabel(booking.time_slot)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Servizio: </span>
                  <span className="font-medium">{booking.service?.name || 'N/D'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Barca: </span>
                  <span className="font-medium">{booking.boat?.name || 'Da assegnare'}</span>
                </div>
              </div>

              {booking.notes && (
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
                  📝 {booking.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}