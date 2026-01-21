'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import Link from 'next/link'
import { toast } from 'sonner'
import BookingModal from '@/components/BookingModal'
import { useAuth } from '@/contexts/AuthContext'

export default function BookingDetailPage() {
  const { isAdmin } = useAuth()
  const params = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    loadBooking()
  }, [params.id])

  async function loadBooking() {
    try {
      setLoading(true)
      const res = await fetch(`/api/bookings/${params.id}`)
      
      if (!res.ok) {
        throw new Error('Prenotazione non trovata')
      }

      const data = await res.json()
      setBooking(data)
    } catch (error: any) {
      console.error('Error loading booking:', error)
      toast.error(error.message)
      router.push('/bookings')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Sei sicuro di voler eliminare questa prenotazione?')) {
      return
    }

    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Errore eliminazione')

      toast.success('Prenotazione eliminata!')
      router.push('/bookings')
    } catch (error: any) {
      console.error('Error deleting booking:', error)
      toast.error(error.message)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="p-8">
        <div className="text-red-600">Prenotazione non trovata</div>
      </div>
    )
  }

  const daRicevere = Math.max(0, 
    (booking.final_price || 0) - 
    (booking.deposit_amount || 0) - 
    (booking.balance_amount || 0)
  )

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/bookings"
            className="text-blue-600 hover:text-blue-700 text-sm md:text-base"
          >
            ← Torna alle prenotazioni
          </Link>
        </div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">
          {booking.booking_number}
        </h1>
        <p className="text-gray-600 mt-1 text-sm md:text-base">
          Prenotazione del {format(new Date(booking.booking_date), 'dd MMMM yyyy', { locale: it })}
        </p>
        
        {/* Buttons - Stack on mobile */}
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
            <button
              onClick={() => setShowEditModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm md:text-base"
            >
              ✏️ Modifica
            </button>
            <button
              onClick={handleDelete}
              className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm md:text-base"
            >
              🗑️ Elimina
            </button>
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="mb-6">
        <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${
          booking.booking_status?.code === 'confirmed' ? 'bg-green-100 text-green-800' :
          booking.booking_status?.code === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          booking.booking_status?.code === 'completed' ? 'bg-blue-100 text-blue-800' :
          booking.booking_status?.code === 'cancelled' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {booking.booking_status?.name || 'N/D'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Cliente */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">👤 Cliente</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <div className="text-sm text-gray-600">Nome Completo</div>
                <div className="text-base font-semibold text-gray-900">
                  {booking.customer?.first_name} {booking.customer?.last_name}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="text-base text-gray-900 break-all">{booking.customer?.email}</div>
              </div>
              {booking.customer?.phone && (
                <div>
                  <div className="text-sm text-gray-600">Telefono</div>
                  <div className="text-base text-gray-900">{booking.customer.phone}</div>
                </div>
              )}
            </div>
          </div>

          {/* Servizio e Barca */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🚤 Servizio e Imbarcazione</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <div className="text-sm text-gray-600">Servizio</div>
                <div className="text-base font-semibold text-gray-900">{booking.service?.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Tipo</div>
                <div className="text-base text-gray-900">
                  {booking.service_type === 'rental' ? 'Noleggio' : 'Locazione'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Imbarcazione</div>
                <div className="text-base font-semibold text-gray-900">{booking.boat?.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Tipo Barca</div>
                <div className="text-base text-gray-900">{booking.boat?.boat_type}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Data</div>
                <div className="text-base text-gray-900">
                  {format(new Date(booking.booking_date), 'EEEE dd MMMM yyyy', { locale: it })}
                </div>
              </div>
              {booking.time_slot && (
                <div>
                  <div className="text-sm text-gray-600">Fascia Oraria</div>
                  <div className="text-base text-gray-900">{booking.time_slot.name}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-600">Passeggeri</div>
                <div className="text-base text-gray-900">{booking.num_passengers}</div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📝 Note</h2>
            {booking.notes ? (
              <p className="text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
            ) : (
              <p className="text-gray-400 italic">Nessuna nota inserita</p>
            )}
          </div>

        </div>

        {/* Sidebar - Pagamenti */}
        <div className="space-y-6">
          
          {/* Riepilogo Prezzi */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <h2 className="text-lg font-bold mb-4">💰 Riepilogo Prezzi</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-blue-400">
                <span className="text-blue-100">Prezzo Base</span>
                <span className="font-semibold">€{(booking.base_price || 0).toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center pb-3 border-b border-blue-400">
                <span className="text-blue-100">Prezzo Finale</span>
                <span className="text-xl font-bold">€{(booking.final_price || 0).toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-blue-100">Acconto Ricevuto</span>
                <span className="font-semibold">€{(booking.deposit_amount || 0).toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-blue-100">Saldo Ricevuto</span>
                <span className="font-semibold">€{(booking.balance_amount || 0).toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center pt-3 border-t-2 border-blue-400">
                <span className="font-bold">Da Ricevere</span>
                <span className={`text-xl font-bold ${daRicevere > 0 ? 'text-yellow-300' : 'text-green-300'}`}>
                  €{daRicevere.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Metodo Pagamento */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">💳 Pagamento</h2>
            <div className="text-base text-gray-900">
              {booking.payment_method?.name || '⚠️ Non impostato'}
            </div>
          </div>

        </div>
      </div>

      {/* Edit Modal */}
      <BookingModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={() => {
          loadBooking()
        }}
        booking={booking}
      />
    </div>
  )
}