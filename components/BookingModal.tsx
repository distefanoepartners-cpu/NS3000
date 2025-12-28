'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import CreateCustomerModal from './CreateCustomerModal'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  booking?: any
  preselectedDate?: Date
  preselectedBoatId?: string
}

export default function BookingModal({ 
  isOpen, 
  onClose, 
  onSave, 
  booking, 
  preselectedDate,
  preselectedBoatId 
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
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)

  // Calcolo automatico "Da ricevere"
  const daRicevere = Math.max(0, 
    (formData.final_price || 0) - (formData.deposit_amount || 0) - (formData.balance_amount || 0)
  )

  // Auto-calcolo: se final_price è vuoto, usa base_price
  useEffect(() => {
    if (!booking && formData.base_price > 0 && formData.final_price === 0) {
      setFormData(prev => ({
        ...prev,
        final_price: prev.base_price
      }))
    }
  }, [formData.base_price, formData.final_price, booking])

  useEffect(() => {
    if (isOpen) {
      loadOptions()
      
      if (booking) {
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
      } else {
        // Nuova prenotazione - precompila data e barca
        setFormData(prev => ({
          ...prev,
          booking_date: preselectedDate ? format(preselectedDate, 'yyyy-MM-dd') : '',
          boat_id: preselectedBoatId || ''
        }))
      }
    }
  }, [isOpen, booking, preselectedDate, preselectedBoatId])

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

  // Auto-carica prezzo quando si seleziona una barca
  useEffect(() => {
    if (formData.boat_id && options.boats.length > 0 && !booking) {
      const selectedBoat = options.boats.find((b: any) => b.id === formData.boat_id)
      if (selectedBoat) {
        const basePrice = selectedBoat.rental_price_high_season || 0
        setFormData(prev => ({
          ...prev,
          base_price: basePrice,
          final_price: basePrice
        }))
      }
    }
  }, [formData.boat_id, options.boats, booking])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="p-4 border-b flex items-center justify-between bg-white rounded-t-xl flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {booking ? 'Modifica Prenotazione' : 'Nuova Prenotazione'}
            </h2>
            {booking && (
              <p className="text-xs text-gray-600 mt-1">{booking.booking_number}</p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form - Scrollable */}
        <div className="overflow-y-auto flex-1">
          <form id="booking-form" onSubmit={handleSubmit} className="p-4">
            {loadingOptions ? (
              <div className="text-center py-8 text-gray-600">Caricamento...</div>
            ) : (
              <div className="space-y-4">
                {/* Cliente e Barca - 2 colonne */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.customer_id}
                        onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        required
                      >
                        <option value="">Seleziona...</option>
                        {options.customers.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.first_name} {c.last_name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCreateCustomer(true)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium whitespace-nowrap"
                        title="Crea nuovo cliente"
                      >
                        ➕ Nuovo
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barca *</label>
                    <select
                      value={formData.boat_id}
                      onChange={(e) => setFormData({ ...formData, boat_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      required
                    >
                      <option value="">Seleziona...</option>
                      {options.boats.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Servizio e Tipo - 2 colonne */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Servizio *</label>
                    <select
                      value={formData.service_id}
                      onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      required
                    >
                      <option value="">Seleziona...</option>
                      {options.services.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Servizio</label>
                    <select
                      value={formData.service_type}
                      onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="rental">Noleggio</option>
                      <option value="charter">Locazione</option>
                    </select>
                  </div>
                </div>

                {/* Data, Orario, Passeggeri - 3 colonne */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                    <input
                      type="date"
                      value={formData.booking_date}
                      onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fascia Oraria</label>
                    <select
                      value={formData.time_slot_id}
                      onChange={(e) => setFormData({ ...formData, time_slot_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Nessuna</option>
                      {options.timeSlots.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passeggeri</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.num_passengers}
                      onChange={(e) => setFormData({ ...formData, num_passengers: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Stato e Metodo Pagamento - 2 colonne */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stato Prenotazione</label>
                    <select
                      value={formData.booking_status_id}
                      onChange={(e) => setFormData({ ...formData, booking_status_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Seleziona...</option>
                      {options.bookingStatuses.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Metodo Pagamento</label>
                    <select
                      value={formData.payment_method_id}
                      onChange={(e) => setFormData({ ...formData, payment_method_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Seleziona...</option>
                      {options.paymentMethods.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Prezzi - Box */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm">💰 Prezzi e Pagamenti</h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Prezzo Base (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.base_price}
                        onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Prezzo Finale (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.final_price}
                        onChange={(e) => setFormData({ ...formData, final_price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Acconto (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.deposit_amount}
                        onChange={(e) => setFormData({ ...formData, deposit_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Saldo (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.balance_amount}
                        onChange={(e) => setFormData({ ...formData, balance_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>

                  {/* Da Ricevere - Display */}
                  <div className="mt-3 p-2 bg-white rounded border border-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Da Ricevere:</span>
                      <span className={`text-lg font-bold ${daRicevere > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        €{daRicevere.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows={2}
                    placeholder="Note aggiuntive..."
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer - Fixed */}
        <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
            disabled={loading}
          >
            Annulla
          </button>
          <button
            type="submit"
            form="booking-form"
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            disabled={loading || loadingOptions}
          >
            {loading ? 'Salvataggio...' : (booking ? 'Aggiorna' : 'Crea Prenotazione')}
          </button>
        </div>
      </div>

      {/* Create Customer Modal */}
      <CreateCustomerModal
        isOpen={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        onCustomerCreated={async (customerId) => {
          await loadOptions()
          setFormData(prev => ({ ...prev, customer_id: customerId }))
        }}
      />
    </div>
  )
}