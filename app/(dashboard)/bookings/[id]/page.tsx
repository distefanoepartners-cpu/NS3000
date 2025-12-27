'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'

export default function BookingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (params.id) {
      loadBooking()
    }
  }, [params.id])

  async function loadBooking() {
    try {
      setLoading(true)

      const res = await fetch(`/api/bookings/${params.id}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Errore caricamento')

      setBooking(data)
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Errore nel caricamento della prenotazione')
      router.push('/prenotazioni')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!booking) return

    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_date: booking.booking_date,
          time_slot_id: booking.time_slot_id,
          num_passengers: booking.num_passengers,
          booking_status_id: booking.booking_status_id,
          base_price: booking.base_price,
          final_price: booking.final_price,
          deposit_amount: booking.deposit_amount,
          balance_amount: booking.balance_amount,
          security_deposit: booking.security_deposit,
          payment_method_id: booking.payment_method_id,
          notes: booking.notes,
          service_type: booking.service_type
        })
      })

      if (!res.ok) throw new Error('Errore salvataggio')

      toast.success('Prenotazione aggiornata!')
      setEditing(false)
      loadBooking()
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Errore nel salvataggio')
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

  const totalePagato = (booking.deposit_amount || 0) + (booking.balance_amount || 0)
  const daRicevere = (booking.final_price || 0) - totalePagato

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/prenotazioni')}
            className="text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-2"
          >
            ← Torna alle prenotazioni
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {booking.booking_number}
          </h1>
          <p className="text-gray-600 mt-1">
            Prenotazione di {booking.customer?.first_name} {booking.customer?.last_name}
          </p>
        </div>

        <div className="flex gap-3">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ✏️ Modifica
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditing(false)
                  loadBooking()
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                💾 Salva
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="mb-8 flex gap-3">
        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
          booking.booking_status?.code === 'confirmed' ? 'bg-green-100 text-green-700' :
          booking.booking_status?.code === 'pending' ? 'bg-yellow-100 text-yellow-700' :
          booking.booking_status?.code === 'completed' ? 'bg-blue-100 text-blue-700' :
          'bg-red-100 text-red-700'
        }`}>
          {booking.booking_status?.name || 'N/D'}
        </span>
        {booking.payment_method && (
          <span className="px-4 py-2 rounded-full text-sm font-semibold bg-purple-100 text-purple-700">
            💳 {booking.payment_method.name}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonna Sinistra - Dettagli */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Cliente */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">👤 Cliente</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Nome</div>
                <div className="font-medium text-gray-900">
                  {booking.customer?.first_name} {booking.customer?.last_name}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="font-medium text-gray-900">{booking.customer?.email}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Telefono</div>
                <div className="font-medium text-gray-900">{booking.customer?.phone || '-'}</div>
              </div>
            </div>
          </div>

          {/* Info Servizio */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🚤 Servizio e Imbarcazione</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Servizio</div>
                <div className="font-medium text-gray-900">{booking.service?.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Tipo</div>
                <div className="font-medium text-gray-900 capitalize">
                  {booking.service_type === 'rental' ? 'Noleggio' : 'Locazione'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Imbarcazione</div>
                <div className="font-medium text-gray-900">{booking.boat?.name || 'Non assegnata'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Tipo Barca</div>
                <div className="font-medium text-gray-900">{booking.boat?.boat_type || '-'}</div>
              </div>
            </div>
          </div>

          {/* Dettagli Prenotazione */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Dettagli Prenotazione</h2>
            <div className="space-y-4">
              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Servizio</label>
                {editing ? (
                  <input
                    type="date"
                    value={booking.booking_date}
                    onChange={(e) => setBooking({...booking, booking_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <div className="font-medium text-gray-900">
                    {format(new Date(booking.booking_date), 'EEEE, dd MMMM yyyy', { locale: it })}
                  </div>
                )}
              </div>

              {/* Ora e Passeggeri */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fascia Oraria</label>
                  {editing ? (
                    <select
                      value={booking.time_slot_id || ''}
                      onChange={(e) => setBooking({...booking, time_slot_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Nessuna</option>
                      {/* TODO: Caricare time slots */}
                    </select>
                  ) : (
                    <div className="font-medium text-gray-900">
                      {booking.time_slot ? `${booking.time_slot.name} (${booking.time_slot.start_time} - ${booking.time_slot.end_time})` : '-'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Numero Passeggeri</label>
                  {editing ? (
                    <input
                      type="number"
                      min="1"
                      value={booking.num_passengers || ''}
                      onChange={(e) => setBooking({...booking, num_passengers: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  ) : (
                    <div className="font-medium text-gray-900">{booking.num_passengers || '-'} persone</div>
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                {editing ? (
                  <textarea
                    value={booking.notes || ''}
                    onChange={(e) => setBooking({...booking, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                ) : (
                  <div className="text-gray-700">{booking.notes || 'Nessuna nota'}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Colonna Destra - Pagamenti */}
        <div className="space-y-6">
          {/* Riepilogo Importi */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <h2 className="text-lg font-bold mb-4">💰 Riepilogo Importi</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-white/20">
                <span className="text-sm opacity-90">Prezzo Totale</span>
                <span className="text-2xl font-bold">€{(booking.final_price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-90">Totale Ricevuto</span>
                <span className="text-lg font-semibold text-green-200">€{totalePagato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/20">
                <span className="text-sm opacity-90">Da Ricevere</span>
                <span className={`text-lg font-semibold ${daRicevere > 0 ? 'text-yellow-200' : 'text-green-200'}`}>
                  €{daRicevere.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <div className="text-xs opacity-75">Acconto</div>
                  <div className="font-semibold">€{(booking.deposit_amount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div className="text-xs opacity-75">Saldo</div>
                  <div className="font-semibold">€{(booking.balance_amount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Metodo Pagamento */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">💳 Metodo Pagamento</h2>
            
            {editing ? (
              <select
                value={booking.payment_method_id || ''}
                onChange={(e) => setBooking({...booking, payment_method_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Seleziona...</option>
                {/* TODO: Caricare payment methods */}
              </select>
            ) : (
              <div className="text-center">
                {booking.payment_method ? (
                  <div>
                    <div className="text-4xl mb-2">
                      {booking.payment_method.code === 'stripe' && '💳'}
                      {booking.payment_method.code === 'cash' && '💵'}
                      {booking.payment_method.code === 'pos' && '💳'}
                      {booking.payment_method.code === 'bank_transfer' && '🏦'}
                    </div>
                    <div className="font-semibold text-gray-900">{booking.payment_method.name}</div>
                  </div>
                ) : (
                  <div className="text-red-600">⚠️ Non impostato</div>
                )}
              </div>
            )}
          </div>

          {/* Azioni Rapide */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⚡ Azioni Rapide</h2>
            <div className="space-y-2">
              <button
                onClick={() => toast.info('Funzione in arrivo')}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                📧 Invia Email Conferma
              </button>
              <button
                onClick={() => toast.info('Funzione in arrivo')}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                📄 Genera PDF
              </button>
              <button
                onClick={() => toast.info('Funzione in arrivo')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                📊 Esporta Excel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}