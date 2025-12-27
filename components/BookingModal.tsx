'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  booking?: any // Se presente, è modifica. Se null, è creazione
  preselectedDate?: Date // Data preselezionata dal calendario
}

export default function BookingModal({ 
  isOpen, 
  onClose, 
  onSave, 
  booking, 
  preselectedDate 
}: BookingModalProps) {
  const [formData, setFormData] = useState({
    customer_id: '',
    boat_id: '',
    service_id: '',
    service_type: 'rental',
    booking_date: '',
    time_slot_id: '',
    num_passengers: 1,
    base_price: 0,
    final_price: 0,
    deposit_amount: 0,
    balance_amount: 0,
    payment_method_id: '',
    booking_status_id: '',
    notes: ''
  })

  const [options, setOptions] = useState({
    customers: [],
    boats: [],
    services: [],
    timeSlots: [],
    paymentMethods: [],
    bookingStatuses: []
  })

  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadOptions()
      
      if (booking) {
        // Modalità modifica
        setFormData({
          customer_id: booking.customer_id || '',
          boat_id: booking.boat_id || '',
          service_id: booking.service_id || '',
          service_type: booking.service_type || 'rental',
          booking_date: booking.booking_date || '',
          time_slot_id: booking.time_slot_id || '',
          num_passengers: booking.num_passengers || 1,
          base_price: booking.base_price || 0,
          final_price: booking.final_price || 0,
          deposit_amount: booking.deposit_amount || 0,
          balance_amount: booking.balance_amount || 0,
          payment_method_id: booking.payment_method_id || '',
          booking_status_id: booking.booking_status_id || '',
          notes: booking.notes || ''
        })
      } else if (preselectedDate) {
        // Modalità creazione con data preselezionata
        setFormData(prev => ({
          ...prev,
          booking_date: format(preselectedDate, 'yyyy-MM-dd')
        }))
      }
    }
  }, [isOpen, booking, preselectedDate])

  async function loadOptions() {
    try {
      setLoadingOptions(true)
      const res = await fetch('/api/bookings/options')
      const data = await res.json()
      
      setOptions({
        customers: data.customers || [],
        boats: data.boats || [],
        services: data.services || [],
        timeSlots: data.timeSlots || [],
        paymentMethods: data.paymentMethods || [],
        bookingStatuses: data.bookingStatuses || []
      })
    } catch (error) {
      console.error('Error loading options:', error)
      toast.error('Errore caricamento opzioni')
    } finally {
      setLoadingOptions(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validazioni
    if (!formData.customer_id) {
      toast.error('Seleziona un cliente')
      return
    }
    if (!formData.boat_id) {
      toast.error('Seleziona una barca')
      return
    }
    if (!formData.service_id) {
      toast.error('Seleziona un servizio')
      return
    }
    if (!formData.booking_date) {
      toast.error('Seleziona una data')
      return
    }

    try {
      setLoading(true)

      const url = booking 
        ? `/api/bookings/${booking.id}` 
        : '/api/bookings'
      
      const method = booking ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Errore salvataggio')
      }

      toast.success(booking ? 'Prenotazione aggiornata!' : 'Prenotazione creata!')
      onSave()
      onClose()
    } catch (error: any) {
      console.error('Error saving booking:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {booking ? 'Modifica Prenotazione' : 'Nuova Prenotazione'}
            </h2>
            {booking && (
              <p className="text-sm text-gray-600 mt-1">{booking.booking_number}</p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {loadingOptions ? (
            <div className="text-center py-8 text-gray-600">Caricamento...</div>
          ) : (
            <>
              {/* Cliente e Barca */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente *
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seleziona cliente...</option>
                    {options.customers.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} - {c.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Barca *
                  </label>
                  <select
                    value={formData.boat_id}
                    onChange={(e) => setFormData({ ...formData, boat_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seleziona barca...</option>
                    {options.boats.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.boat_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Servizio e Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Servizio *
                  </label>
                  <select
                    value={formData.service_id}
                    onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seleziona servizio...</option>
                    {options.services.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo Servizio
                  </label>
                  <select
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="rental">Noleggio</option>
                    <option value="charter">Locazione</option>
                  </select>
                </div>
              </div>

              {/* Data e Orario */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={formData.booking_date}
                    onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fascia Oraria
                  </label>
                  <select
                    value={formData.time_slot_id}
                    onChange={(e) => setFormData({ ...formData, time_slot_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleziona orario...</option>
                    {options.timeSlots.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.start_time} - {t.end_time})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Passeggeri e Stato */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numero Passeggeri
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.num_passengers}
                    onChange={(e) => setFormData({ ...formData, num_passengers: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stato Prenotazione
                  </label>
                  <select
                    value={formData.booking_status_id}
                    onChange={(e) => setFormData({ ...formData, booking_status_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleziona stato...</option>
                    {options.bookingStatuses.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prezzi */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-4">💰 Prezzi e Pagamenti</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prezzo Base (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.base_price}
                      onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prezzo Finale (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.final_price}
                      onChange={(e) => setFormData({ ...formData, final_price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Acconto (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.deposit_amount}
                      onChange={(e) => setFormData({ ...formData, deposit_amount: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Saldo (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.balance_amount}
                      onChange={(e) => setFormData({ ...formData, balance_amount: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Metodo Pagamento
                  </label>
                  <select
                    value={formData.payment_method_id}
                    onChange={(e) => setFormData({ ...formData, payment_method_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleziona metodo...</option>
                    {options.paymentMethods.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Note aggiuntive..."
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading || loadingOptions}
            >
              {loading ? 'Salvataggio...' : (booking ? 'Aggiorna' : 'Crea Prenotazione')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}