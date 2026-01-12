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
    caution_amount: 0, // Cauzione
    deposit_payment_method_id: '', // Nuovo
    balance_payment_method_id: '', // Nuovo
    caution_payment_method_id: '', // Nuovo per cauzione
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
      // Load options first
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
          caution_amount: booking.caution_amount || 0,
          deposit_payment_method_id: booking.deposit_payment_method_id || '',
          balance_payment_method_id: booking.balance_payment_method_id || '',
          caution_payment_method_id: booking.caution_payment_method_id || '',
          booking_status_id: booking.booking_status_id || '',
          notes: booking.notes || ''
        })
        // Customer name will be set by loadOptions when options arrive
      } else {
        // New booking - reset customer search
        setCustomerSearch('')
        setFormData(prev => ({
          ...prev,
          booking_date: preselectedDate ? format(preselectedDate, 'yyyy-MM-dd') : '',
          boat_id: preselectedBoatId || ''
        }))
      }
    } else {
      // Reset when closing
      setCustomerSearch('')
    }
  }, [isOpen, booking, preselectedDate, preselectedBoatId]) // Removed options.customers

  async function loadOptions() {
    try {
      setLoadingOptions(true)
      const res = await fetch('/api/bookings/options')
      const data = await res.json()
      
      const rentalRes = await fetch('/api/rental-services')
      const rentalData = await rentalRes.json()
      
      console.log('📦 rentalServices caricati:', rentalData)
      
      // Filter booking statuses - tutti gli stati disponibili
      const allowedStatuses = ['In Attesa', 'Confermata', 'Da Recuperare', 'Chiusa']
      const filteredStatuses = (data.bookingStatuses || []).filter((s: any) => 
        allowedStatuses.includes(s.name)
      )
      
      const newOptions = {
        customers: data.customers || [],
        boats: data.boats || [],
        services: data.services || [],
        rentalServices: rentalData || [],
        paymentMethods: data.paymentMethods || [],
        bookingStatuses: filteredStatuses
      }
      
      setOptions(newOptions)
      
      console.log('✅ Options settati:', {
        rentalServices_count: newOptions.rentalServices.length,
        rentalServices: newOptions.rentalServices.map((s: any) => ({ id: s.id, name: s.name, type: s.service_type }))
      })
      
      // Set customer name for edit mode AFTER options are loaded
      if (booking && booking.customer_id) {
        const customer = newOptions.customers.find((c: any) => c.id === booking.customer_id)
        if (customer) {
          setCustomerSearch(`${customer.first_name} ${customer.last_name}`)
        }
      }
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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('.customer-search-container')) {
        setShowCustomerDropdown(false)
      }
    }

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCustomerDropdown])

  function selectCustomer(customer: any) {
    setFormData(prev => ({ ...prev, customer_id: customer.id }))
    setCustomerSearch(`${customer.first_name} ${customer.last_name}`)
    setShowCustomerDropdown(false)
  }

  // Load boat services
  useEffect(() => {
    // Carica TUTTI i servizi disponibili
    if (options.rentalServices.length > 0) {
      setAvailableServices(options.rentalServices)
    }
  }, [options.rentalServices])

  // Calculate price - DISABILITATO: usiamo calcolo diretto dalla barca
  // useEffect(() => {
  //   async function calculatePrice() {
  //     ...
  //   }
  //   calculatePrice()
  // }, [...])

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

  // Auto-calcolo prezzo diretto da barca (per rental, tour, transfer)
  useEffect(() => {
    console.log('🔍 CALCOLO PREZZI - Debug:', {
      boat_id: formData.boat_id,
      service_id: formData.service_id,
      booking_date: formData.booking_date,
      time_slot: formData.time_slot,
      boats_count: options.boats.length,
      booking_mode: !!booking
    })
    
    // Salta se è collective (calcolato separatamente x pax)
    const selectedService = options.rentalServices.find((s: any) => s.id === formData.service_id)
    console.log('🔍 Selected Service:', selectedService?.name, selectedService?.service_type)
    
    if (selectedService?.service_type === 'collective') {
      console.log('⏭️ Skipping - collective service')
      return
    }
    
    if (
      formData.boat_id && 
      formData.booking_date &&
      formData.time_slot &&
      options.boats.length > 0 &&
      !booking // Solo per nuove prenotazioni
    ) {
      const selectedBoat = options.boats.find((b: any) => b.id === formData.boat_id)
      console.log('🚤 Selected Boat:', selectedBoat?.name)
      
      if (selectedBoat) {
        let price = 0
       const month = new Date(formData.booking_date).getMonth() + 1
let price = 0

          // Determina se è rental o charter
          const isRental = selectedService?.service_type === 'rental'
          const pricePrefix = isRental ? 'price_rental' : 'price_charter'

          // Determina se è half day o full day
          const isFullDay = formData.time_slot === 'full_day'

    // Calcola prezzo in base a mese e fascia
      if ([4, 5, 10].includes(month)) {
        price = isFullDay 
          ? (selectedBoat[`${pricePrefix}_apr_may_oct_full_day`] || 0)
          : (selectedBoat[`${pricePrefix}_apr_may_oct_half_day`] || 0)
        } else if (month === 6) { // Giugno
            price = isFullDay
            ? (selectedBoat[`${pricePrefix}_june_full_day`] || 0)
            : (selectedBoat[`${pricePrefix}_june_half_day`] || 0)
          } else if ([7, 9].includes(month)) { // Luglio/Settembre
            price = isFullDay
            ? (selectedBoat[`${pricePrefix}_july_sept_full_day`] || 0)
            : (selectedBoat[`${pricePrefix}_july_sept_half_day`] || 0)
          } else if (month === 8) { // Agosto
            price = isFullDay
            ? (selectedBoat[`${pricePrefix}_august_full_day`] || 0)
            : (selectedBoat[`${pricePrefix}_august_half_day`] || 0)
          }
          
          console.log('💰 Prezzo dalla BARCA:', price)
        
        console.log('💰 Prezzo FINALE:', price)
        
        // Aggiorna prezzo se trovato
        if (price && price > 0) {
          setFormData(prev => ({
            ...prev,
            base_price: price,
            final_price: price
          }))
          toast.success(`Prezzo automatico: €${price}`)
        } else {
          console.warn('⚠️ No price found for this period')
        }
        
        // Auto-imposta cauzione se disponibile E servizio è rental
        if (selectedService?.service_type === 'rental' && 
            selectedBoat.caution_amount && 
            selectedBoat.caution_amount > 0 && 
            formData.caution_amount === 0) {
          setFormData(prev => ({
            ...prev,
            caution_amount: selectedBoat.caution_amount
          }))
        }
      }
    }
  }, [formData.boat_id, formData.service_id, formData.booking_date, formData.time_slot, options.boats, options.rentalServices, booking])

  // Calcolo prezzo tour/transfer/collective
  useEffect(() => {
    console.log('💰 CALCOLO COLLECTIVE - Start:', {
      service_id: formData.service_id,
      num_passengers: formData.num_passengers,
      rentalServices_length: options.rentalServices.length,
      booking_mode: !!booking
    })
    
    if (
      formData.service_id && 
      formData.num_passengers > 0 &&
      options.rentalServices.length > 0 &&
      !booking
    ) {
      const selectedService = options.rentalServices.find((s: any) => s.id === formData.service_id)
      
      console.log('💰 Selected Service for collective:', {
        name: selectedService?.name,
        type: selectedService?.service_type,
        base_price: selectedService?.base_price
      })
      
      // SOLO tour COLLETTIVI: prezzo x pax
      if (selectedService && selectedService.service_type === 'collective') {
        const pricePerPerson = selectedService.price_per_person || 0
        const totalPrice = pricePerPerson * formData.num_passengers
        
        console.log('💰 CALCOLO:', `€${pricePerPerson} x ${formData.num_passengers} = €${totalPrice}`)
        
        if (totalPrice > 0) {
          setFormData(prev => ({
            ...prev,
            base_price: totalPrice,
            final_price: totalPrice
          }))
          toast.success(`Prezzo calcolato: €${pricePerPerson} x ${formData.num_passengers} pax = €${totalPrice}`)
        } else {
          console.warn('⚠️ Prezzo = 0! price_per_person del servizio è:', selectedService.price_per_person)
        }
      } else {
        console.log('ℹ️ Non è un servizio collective, skip calcolo x pax')
      }
      // Tour normali e transfer: prendono prezzo dalla barca (gestito da altro useEffect)
    } else {
      console.log('❌ Condizioni non soddisfatte per calcolo collective')
    }
  }, [formData.service_id, formData.num_passengers, options.rentalServices, booking])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.customer_id) {
      toast.error('Seleziona un cliente dalla lista')
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

      // Controllo disponibilità
      const availabilityRes = await fetch('/api/bookings/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boat_id: formData.boat_id,
          booking_date: formData.booking_date,
          booking_id: booking?.id // Per escludere la prenotazione corrente in modifica
        })
      })

      const availabilityData = await availabilityRes.json()

      if (!availabilityData.available) {
        const errorMsg = availabilityData.reason || 'Barca non disponibile'
        toast.error(errorMsg, { duration: 5000 })
        alert(`⚠️ ${errorMsg}`)
        setLoading(false)
        return
      }

      // Procedi con il salvataggio
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
                  <div className="relative customer-search-container">
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
                      {options.boats
                        .filter((b: any) => {
                          // Filtra barche in base al servizio selezionato
                          if (!formData.service_id) return true
                          
                          const selectedService = options.rentalServices.find((s: any) => s.id === formData.service_id)
                          if (!selectedService) return true
                          
                          // Se servizio è rental → solo barche con has_rental
                          if (selectedService.service_type === 'rental') {
                            return b.has_rental === true
                          }
                          
                          // Se servizio è tour/transfer/collective → solo barche con has_charter
                          return b.has_charter === true
                        })
                        .map((b: any) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))
                      }
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
                    <option value="charter">Noleggio (con skipper)</option>
                    <option value="rental">Locazione (senza skipper)</option>
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
                    onChange={(e) => {
                      console.log('🔄 Servizio selezionato:', e.target.value)
                      setFormData({ ...formData, service_id: e.target.value })
                    }}
                    className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  >
                    <option value="">Seleziona servizio...</option>
                    
                    {availableServices.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
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
                    <select
                      value={formData.time_slot === 'morning' || formData.time_slot === 'afternoon' || formData.time_slot === 'full_day' ? formData.time_slot : 'custom'}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setFormData({ ...formData, time_slot: '' })
                        } else {
                          setFormData({ ...formData, time_slot: e.target.value })
                        }
                      }}
                      className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Seleziona fascia...</option>
                      <option value="morning">🌅 Half Day Mattina</option>
                      <option value="afternoon">🌇 Half Day Pomeriggio</option>
                      <option value="full_day">☀️ Full Day (Giornata Intera)</option>
                      <option value="custom">⏰ Personalizzata</option>
                    </select>
                    
                    {/* Campo testo per fascia personalizzata */}
                    {formData.time_slot !== 'morning' && 
                     formData.time_slot !== 'afternoon' && 
                     formData.time_slot !== 'full_day' && (
                      <input
                        type="text"
                        value={formData.time_slot}
                        onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
                        placeholder="es. Serale 18:00-23:00"
                        className="w-full px-2 md:px-3 py-2 border border-gray-300 rounded-lg text-sm mt-2"
                      />
                    )}
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
                  </div>

                  {/* Acconto + Metodo */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
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
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Acconto</label>
                      <select
                        value={formData.deposit_payment_method_id}
                        onChange={(e) => setFormData({ ...formData, deposit_payment_method_id: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Seleziona...</option>
                        {options.paymentMethods
                          .filter((p: any) => p.code === 'stripe' || p.code === 'cash' || p.code === 'pos' || p.code === 'bank_transfer')
                          .map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  </div>

                  {/* Saldo + Metodo */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
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
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Saldo</label>
                      <select
                        value={formData.balance_payment_method_id}
                        onChange={(e) => setFormData({ ...formData, balance_payment_method_id: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Seleziona...</option>
                        {options.paymentMethods
                          .filter((p: any) => p.code === 'stripe' || p.code === 'cash' || p.code === 'pos' || p.code === 'bank_transfer')
                          .map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  </div>

                  {/* Cauzione + Metodo - SOLO per servizi rental */}
                  {(() => {
                    const selectedService = options.rentalServices.find((s: any) => s.id === formData.service_id)
                    return selectedService?.service_type === 'rental'
                  })() && (
                    <div className="mb-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Cauzione (€) <span className="text-blue-600">• Solo Locazione</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.caution_amount}
                            onChange={(e) => setFormData({ ...formData, caution_amount: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            placeholder="Importo personalizzato"
                          />
                          {/* Pulsanti Rapidi */}
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, caution_amount: 150 })}
                              className="flex-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
                            >
                              €150
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, caution_amount: 250 })}
                              className="flex-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium"
                            >
                              €250
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Metodo Cauzione</label>
                          <select
                            value={formData.caution_payment_method_id}
                            onChange={(e) => setFormData({ ...formData, caution_payment_method_id: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Seleziona...</option>
                            {options.paymentMethods
                              .filter((p: any) => p.code === 'cash' || p.code === 'stripe')
                              .map((p: any) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

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