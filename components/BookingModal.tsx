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
    time_slot: '', // Input libero
    num_passengers: 1,
    base_price: 0,
    final_price: 0,
    deposit_amount: 0,
    balance_amount: 0,
    deposit_payment_method_id: '', // Nuovo
    balance_payment_method_id: '', // Nuovo
    booking_status_id: '',
    notes: ''
  })

  const [options, setOptions] = useState({
    customers: [],
    boats: [],
    services: [],
    rentalServices: [],
    paymentMethods: [],
    bookingStatuses: []
  })

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [calculatingPrice, setCalculatingPrice] = useState(false)
  const [availableServices, setAvailableServices] = useState<any[]>([])

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
          time_slot: booking.time_slot || '',
          num_passengers: booking.num_passengers || 1,
          base_price: booking.base_price || 0,
          final_price: booking.final_price || 0,
          deposit_amount: booking.deposit_amount || 0,
          balance_amount: booking.balance_amount || 0,
          deposit_payment_method_id: booking.deposit_payment_method_id || '',
          balance_payment_method_id: booking.balance_payment_method_id || '',
          booking_status_id: booking.booking_status_id || '',
          notes: booking.notes || ''
        })
        
        // Set customer search text
        const customer = options.customers.find((c: any) => c.id === booking.customer_id)
        if (customer) {
          setCustomerSearch(`${customer.first_name} ${customer.last_name}`)
        }
      } else {
        setFormData(prev => ({
          ...prev,
          booking_date: preselectedDate ? format(preselectedDate, 'yyyy-MM-dd') : '',
          boat_id: preselectedBoatId || ''
        }))
      }
    }
  }, [isOpen, booking, preselectedDate, preselectedBoatId, options.customers])

  async function loadOptions() {
    try {
      setLoadingOptions(true)
      const res = await fetch('/api/bookings/options')
      const data = await res.json()
      
      const rentalRes = await fetch('/api/rental-services')
      const rentalData = await rentalRes.json()
      
      // Filter booking statuses - only 3
      const allowedStatuses = ['Confermata', 'In Attesa', 'Completata']
      const filteredStatuses = (data.bookingStatuses || []).filter((s: any) => 
        allowedStatuses.includes(s.name)
      )
      
      setOptions({
        customers: data.customers || [],
        boats: data.boats || [],
        services: data.services || [],
        rentalServices: rentalData || [],
        paymentMethods: data.paymentMethods || [],
        bookingStatuses: filteredStatuses
      })
    } catch (error) {
      console.error('Error loading options:', error)
      toast.error('Errore caricamento opzioni')
    } finally {
      setLoadingOptions(false)
    }
  }

  // Customer search filter
  useEffect(() => {
    if (customerSearch.trim()) {
      const term = customerSearch.toLowerCase()
      const filtered = options.customers.filter((c: any) =>
        c.first_name?.toLowerCase().includes(term) ||
        c.last_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term)
      )
      setFilteredCustomers(filtered)
    } else {
      setFilteredCustomers(options.customers)
    }
  }, [customerSearch, options.customers])

  function selectCustomer(customer: any) {
    setFormData(prev => ({ ...prev, customer_id: customer.id }))
    setCustomerSearch(`${customer.first_name} ${customer.last_name}`)
    setShowCustomerDropdown(false)
  }

  // Load boat services
  useEffect(() => {
    async function loadBoatServices() {
      if (!formData.boat_id) {
        setAvailableServices([])
        return
      }

      try {
        const res = await fetch(`/api/boats/${formData.boat_id}/services`)
        const data = await res.json()
        
        const servicesWithInfo = data.map((bs: any) => {
          const serviceInfo = options.rentalServices.find((s: any) => s.id === bs.service_id)
          return {
            ...bs,
            name: serviceInfo?.name || 'Servizio',
            description: serviceInfo?.description
          }
        })
        
        setAvailableServices(servicesWithInfo)
      } catch (error) {
        console.error('Error loading boat services:', error)
        setAvailableServices([])
      }
    }

    if (formData.service_type === 'rental' && formData.boat_id) {
      loadBoatServices()
    } else {
      setAvailableServices([])
    }
  }, [formData.boat_id, formData.service_type, options.rentalServices])

  // Calculate price
  useEffect(() => {
    async function calculatePrice() {
      if (
        formData.service_type !== 'rental' ||
        !formData.boat_id || 
        !formData.service_id || 
        !formData.booking_date ||
        booking
      ) {
        return
      }

      try {
        setCalculatingPrice(true)
        
        const res = await fetch('/api/bookings/calculate-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boat_id: formData.boat_id,
            service_id: formData.service_id,
            booking_date: formData.booking_date,
            num_passengers: formData.num_passengers
          })
        })

        const data = await res.json()
        
        if (data.price) {
          setFormData(prev => ({
            ...prev,
            base_price: data.price,
            final_price: data.price
          }))
          toast.success(`Prezzo calcolato: €${data.price}`)
        } else {
          toast.error('Prezzo non disponibile per questa stagione')
        }
      } catch (error) {
        console.error('Error calculating price:', error)
        toast.error('Errore calcolo prezzo')
      } finally {
        setCalculatingPrice(false)
      }
    }

    calculatePrice()
  }, [formData.boat_id, formData.service_id, formData.booking_date, formData.num_passengers, formData.service_type, booking])

  // Auto-load price for charter
  useEffect(() => {
    if (formData.service_type === 'charter' && formData.boat_id && options.boats.length > 0 && !booking) {
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
  }, [formData.boat_id, formData.service_type, options.boats, booking])

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[95vh] flex flex-col mx-2 md:mx-0">
        {/* Header */}
        <div className="p-3 md:p-4 border-b flex items-center justify-between bg-white rounded-t-xl flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">
              {booking ? 'Modifica Prenotazione' : 'Nuova Prenotazione'}
            </h2>
            {booking && (
              <p className="text-xs text-gray-600 mt-1">{booking.booking_number}</p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-2"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto flex-1">
          <form id="booking-form" onSubmit={handleSubmit} className="p-3 md:p-4">
            {loadingOptions ? (
              <div className="text-center py-8 text-gray-600">Caricamento...</div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {/* Cliente (Searchable) e Barca */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value)
                            setShowCustomerDropdown(true)
                          }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          placeholder="Cerca cliente..."
                          className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          required
                        />
                        {showCustomerDropdown && filteredCustomers.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredCustomers.slice(0, 10).map((c: any) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => selectCustomer(c)}
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
                              >
                                <div className="font-medium">{c.first_name} {c.last_name}</div>
                                {c.email && <div className="text-xs text-gray-600">{c.email}</div>}
                                {c.phone && <div className="text-xs text-gray-600">{c.phone}</div>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCreateCustomer(true)}
                        className="px-2 md:px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium whitespace-nowrap"
                      >
                        ➕
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barca *</label>
                    <select
                      value={formData.boat_id}
                      onChange={(e) => {
                        setFormData({ ...formData, boat_id: e.target.value, service_id: '' })
                      }}
                      className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
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

                {/* Tipo Servizio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Servizio</label>
                  <select
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value, service_id: '' })}
                    className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="rental">Noleggio (con servizio)</option>
                    <option value="charter">Locazione</option>
                  </select>
                </div>

                {/* Servizio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servizio * 
                    {calculatingPrice && <span className="ml-2 text-xs text-blue-600">🔄 Calcolo prezzo...</span>}
                  </label>
                  <select
                    value={formData.service_id}
                    onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                    className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                    disabled={formData.service_type === 'rental' && !formData.boat_id}
                  >
                    <option value="">
                      {formData.service_type === 'rental' 
                        ? (formData.boat_id ? 'Seleziona servizio...' : 'Prima seleziona una barca')
                        : 'Seleziona...'}
                    </option>
                    
                    {formData.service_type === 'rental' ? (
                      availableServices.map((s: any) => (
                        <option key={s.service_id} value={s.service_id}>
                          {s.name}
                        </option>
                      ))
                    ) : (
                      options.services.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Data, Fascia Oraria, Passeggeri */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                    <input
                      type="date"
                      value={formData.booking_date}
                      onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                      className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fascia Oraria</label>
                    <input
                      type="text"
                      value={formData.time_slot}
                      onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
                      placeholder="es. Full Day, Half Day, 10:00-14:00"
                      list="time-slot-presets"
                      className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <datalist id="time-slot-presets">
                      <option value="Full Day" />
                      <option value="Half Day" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passeggeri</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.num_passengers}
                      onChange={(e) => setFormData({ ...formData, num_passengers: parseInt(e.target.value) })}
                      className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Stato Prenotazione */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stato Prenotazione</label>
                  <select
                    value={formData.booking_status_id}
                    onChange={(e) => setFormData({ ...formData, booking_status_id: e.target.value })}
                    className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Seleziona...</option>
                    {options.bookingStatuses.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Prezzi */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm">
                    💰 Prezzi e Pagamenti
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Prezzo Base (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.base_price}
                        onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        disabled={calculatingPrice}
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

                  {/* Metodi Pagamento Separati */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Acconto</label>
                      <select
                        value={formData.deposit_payment_method_id}
                        onChange={(e) => setFormData({ ...formData, deposit_payment_method_id: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Seleziona...</option>
                        {options.paymentMethods.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Saldo</label>
                      <select
                        value={formData.balance_payment_method_id}
                        onChange={(e) => setFormData({ ...formData, balance_payment_method_id: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
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

                  {/* Da Ricevere */}
                  <div className="p-2 bg-white rounded border border-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Da Ricevere:</span>
                      <span className={`text-base md:text-lg font-bold ${daRicevere > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
                    className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows={2}
                    placeholder="Note aggiuntive..."
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-2 md:gap-3 p-3 md:p-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 md:px-4 py-2 md:py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm md:text-base"
            disabled={loading}
          >
            Annulla
          </button>
          <button
            type="submit"
            form="booking-form"
            className="flex-1 px-3 md:px-4 py-2 md:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm md:text-base"
            disabled={loading || loadingOptions || calculatingPrice}
          >
            {loading ? 'Salvataggio...' : (booking ? 'Aggiorna' : 'Crea')}
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
          const customer = options.customers.find((c: any) => c.id === customerId)
          if (customer) {
            setCustomerSearch(`${customer.first_name} ${customer.last_name}`)
          }
        }}
      />
    </div>
  )
}