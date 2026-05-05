'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import CreateCustomerModal from './CreateCustomerModal'
import { LicenseRequiredAlert } from './booking/LicenseRequiredAlert'
import { generateContractPDF } from '@/lib/generate-contract-pdf'
// ⭐ 04/05/2026 — Dialog conferma attribuzione fornitore (anti-bug NS20260503-0275)
import SupplierConfirmationDialog from './SupplierConfirmationDialog'

// ⭐ Ordine di visualizzazione dei servizi nel dropdown "Servizio".
// Match case-insensitive su frammenti del nome: i servizi non classificati
// vanno in fondo in ordine alfabetico.
const SERVICE_DISPLAY_ORDER: Array<{ keywords: string[]; position: number }> = [
  { keywords: ['privato amalfi fd e hd'],         position: 1 },
  { keywords: ['privato amalfi e positano'],      position: 2 },
  { keywords: ['privato capri'],                  position: 3 },
  { keywords: ['amalfi e positano collettivo'],   position: 4 },
  { keywords: ['capri collettivo'],               position: 5 },
  { keywords: ['sunset'],                          position: 6 },
  { keywords: ['personalizzato'],                  position: 7 },
  { keywords: ['taxi'],                            position: 8 },
  { keywords: ['locazione', 'self drive'],        position: 9 },
]

function getServiceOrder(serviceName: string): number {
  const name = (serviceName || '').toLowerCase().trim()
  for (const rule of SERVICE_DISPLAY_ORDER) {
    if (rule.keywords.some(kw => name.includes(kw))) {
      return rule.position
    }
  }
  return 999 // non classificato → in fondo
}

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
    booking_end_date: '',
    num_days: 1,
    daily_price: 0,
    time_slot: '',
    num_passengers: 1,
    num_minors: 0,
    base_price: 0,
    final_price: 0,
    deposit_amount: 0,
    balance_amount: 0,
    caution_amount: 0,
    deposit_payment_method_id: '',
    balance_payment_method_id: '',
    caution_payment_method_id: '',
    deposit_payment_date: '',
    balance_payment_date: '',
    booking_status_id: '',
    notes: '',
    booking_source: 'online',
    supplier_id: '',
    skipper_id: '',
    lang: 'it',
    has_license: false,
    license_number: '',
    license_expiry: '',
    document_type: '',
    document_number: '',
    document_expiry: '',
    passengers_documents: [] as Array<{type: string, number: string, expiry: string}>,
    hostess_name: '',
    // ⭐ Porti di imbarco e sbarco (campi liberi per contratto PDF)
    boarding_port: '',
    disembark_port: '',
  })

  const [options, setOptions] = useState({
    customers: [],
    boats: [],
    services: [],
    rentalServices: [],
    paymentMethods: [],
    bookingStatuses: [],
    suppliers: [],
    skippers: []
  })

  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sendingSms, setSendingSms] = useState(false)

  const [cautionStatus, setCautionStatus] = useState<any>(null)
  const [loadingCaution, setLoadingCaution] = useState(false)
  const [showCaptureDialog, setShowCaptureDialog] = useState(false)
  const [captureAmount, setCaptureAmount] = useState(0)

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [calculatingPrice, setCalculatingPrice] = useState(false)
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [selectedBoat, setSelectedBoat] = useState<any>(null)

  // ⭐ 04/05/2026 — Dialog conferma attribuzione fornitore (anti-bug NS20260503-0275).
  // Si attiva quando una NUOVA prenotazione (no booking.id) creata dal modal ha
  // un supplier_id valorizzato e non proviene da sync esterna BA (no external_id).
  const [showSupplierConfirm, setShowSupplierConfirm] = useState(false)
  // ⭐ 04/05/2026 — Pulsante Recensione Google via WhatsApp (Twilio Content Template)
  const [sendingReview, setSendingReview] = useState(false)
  const [reviewSent, setReviewSent] = useState(false)
 
  const daRicevere = Math.max(0, 
    (formData.final_price || 0) - (formData.deposit_amount || 0) - (formData.balance_amount || 0)
  )

  useEffect(() => {
    if (!booking?.id || !cautionStatus?.stripe_status) return
    if (cautionStatus.stripe_status !== 'pending') return

    console.log('🔄 [caution] Auto-polling attivato (ogni 15s)')

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/${booking.id}/caution`)
        const data = await res.json()
        if (data.error) return

        if (data.stripe_status !== cautionStatus.stripe_status) {
          console.log('🔔 [caution] Stato cambiato:', cautionStatus.stripe_status, '→', data.stripe_status)
          setCautionStatus(data)

          if (data.stripe_status === 'requires_capture') {
            toast.success('🔒 Cauzione pre-autorizzata dal cliente!', { duration: 8000 })
          } else if (data.stripe_status === 'failed') {
            toast.error('❌ Autorizzazione cauzione fallita')
          } else if (data.stripe_status === 'expired') {
            toast.error('⏰ Link cauzione scaduto')
          }
        }
      } catch {
        // Silenzioso
      }
    }, 15000)

    return () => {
      console.log('🔄 [caution] Auto-polling disattivato')
      clearInterval(interval)
    }
  }, [booking?.id, cautionStatus?.stripe_status])

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
        console.log('📂 CARICO PRENOTAZIONE:', {
          id: booking.id,
          service_id: booking.service_id,
          service_type: booking.service_type,
          booking_type: booking.booking_type,
          boat_id: booking.boat_id,
          passengers_documents: booking.passengers_documents
        })

        // ⭐ 04/05/2026 — Pseudo-booking detection (no id).
        // I pseudo-booking sono pre-compilati da un parent (es. nuovo pax di
        // un collettivo BA). NON devono ereditare l'attribuzione supplier
        // del parent: se il nuovo pax è realmente legato al parent, l'operatore
        // potrà selezionarlo manualmente. Default sicuro: in_person + nessun supplier.
        // (Anti-bug NS20260503-0275)
        const isPseudoBooking = !booking.id

        setFormData({
          customer_id: booking.customer_id || '',
          boat_id: booking.boat_id || '',
          service_id: booking.service_id || '',
          service_type: booking.booking_type === 'collective' ? 'collective' : (booking.service_type || booking.booking_type || 'rental'),
          booking_date: booking.booking_date || '',
          booking_end_date: booking.booking_end_date || '',
          num_days: booking.num_days || 1,
          daily_price: booking.daily_price || 0,
          time_slot: booking.time_slot || '',
          num_passengers: booking.num_passengers || 1,
          num_minors: booking.num_minors || 0,
          base_price: booking.base_price || 0,
          final_price: booking.final_price || 0,
          deposit_amount: booking.deposit_amount || 0,
          balance_amount: booking.balance_amount || 0,
          caution_amount: booking.caution_amount || 0,
          deposit_payment_method_id: booking.deposit_payment_method_id || '',
          balance_payment_method_id: booking.balance_payment_method_id || '',
          caution_payment_method_id: booking.caution_payment_method_id || '',
          deposit_payment_date: booking.deposit_payment_date || '',
          balance_payment_date: booking.balance_payment_date || '',
          booking_status_id: booking.booking_status_id || '',
          notes: booking.notes || '',
          // ⭐ Pseudo-booking: forza canale interno e niente supplier
          booking_source: isPseudoBooking ? 'in_person' : (booking.booking_source || 'online'),
          supplier_id: isPseudoBooking ? '' : (booking.supplier_id || ''),
          skipper_id: booking.skipper_id || '',
          hostess_name: booking.hostess_name || '', 
          lang: booking.lang || 'it',
          has_license: booking.has_license || false,
          license_number: booking.license_number || '',
          license_expiry: booking.license_expiry || '',
          document_type: booking.document_type || '',
          document_number: booking.document_number || '',
          document_expiry: booking.document_expiry || '',
          passengers_documents: booking.passengers_documents || [],
          // ⭐ Carica porti da DB (possono essere null su prenotazioni vecchie)
          boarding_port: booking.boarding_port || '',
          disembark_port: booking.disembark_port || '',
        })
        if (booking.boat_id && options.boats.length > 0) {
          const boat = options.boats.find((b: any) => b.id === booking.boat_id)
          setSelectedBoat(boat || null)
        }
        setEmailSent(!!booking.email_sent_at)
        setReviewSent(!!booking.google_review_sent_at) // ⭐ 04/05/2026
      } else {
        setCustomerSearch('')
        setEmailSent(false)
        setReviewSent(false) // ⭐ 04/05/2026
        // ⭐ 04/05/2026 — Reset esplicito di booking_source/supplier_id per
        // evitare leak di stato da una prenotazione precedente nello stesso
        // ciclo di vita del componente (anti-bug NS20260503-0275).
        setFormData(prev => ({
          ...prev,
          booking_date: preselectedDate ? format(preselectedDate, 'yyyy-MM-dd') : '',
          boat_id: preselectedBoatId || '',
          booking_source: 'online',
          supplier_id: '',
        }))
      }

      if (booking?.id) {
        fetch(`/api/bookings/${booking.id}/caution`)
          .then(res => res.json())
          .then(data => {
            if (!data.error) setCautionStatus(data)
          })
          .catch(() => {})
      } else {
        setCautionStatus(null)
      }
    } else {
      setCustomerSearch('')
      setCautionStatus(null)
      setShowCaptureDialog(false)
      setShowSupplierConfirm(false) // ⭐ reset al close
      setReviewSent(false) // ⭐ 04/05/2026 reset review state
    }
  }, [isOpen, booking, preselectedDate, preselectedBoatId])

  async function loadOptions() {
    try {
      setLoadingOptions(true)
      const res = await fetch('/api/bookings/options')
      const data = await res.json()
      
      const rentalRes = await fetch('/api/rental-services')
      const rentalData = await rentalRes.json()
      
      const suppliersRes = await fetch('/api/suppliers')
      const suppliersData = await suppliersRes.json()
      
      const skippersRes = await fetch('/api/skippers')
      const skippersData = await skippersRes.json()
      
      console.log('📦 rentalServices caricati:', rentalData)
      console.log('📦 suppliers caricati:', suppliersData)
      console.log('📦 skippers caricati:', skippersData)
      
      const allowedStatuses = ['In Attesa', 'Confermata', 'In Corso', 'Chiusa', 'Da Recuperare']
      const filteredStatuses = allowedStatuses
        .map(name => (data.bookingStatuses || []).find((s: any) => s.name === name))
        .filter(Boolean)
      
      const newOptions = {
        customers: data.customers || [],
        boats: data.boats || [],
        services: data.services || [],
        rentalServices: rentalData || [],
        paymentMethods: data.paymentMethods || [],
        bookingStatuses: filteredStatuses,
        suppliers: suppliersData || [],
        skippers: skippersData || []
      }
      
      setOptions(newOptions)
      
      console.log('✅ Options settati:', {
        rentalServices_count: newOptions.rentalServices.length,
        rentalServices: newOptions.rentalServices.map((s: any) => ({ id: s.id, name: s.name, type: s.service_type })),
        suppliers_count: newOptions.suppliers.length
      })
      
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

  async function loadCustomersOnly(): Promise<any[]> {
    try {
      const res = await fetch('/api/bookings/options')
      const data = await res.json()
      const updatedCustomers = data.customers || []
      setOptions(prev => ({ ...prev, customers: updatedCustomers }))
      return updatedCustomers
    } catch (error) {
      console.error('Error loading customers:', error)
      return []
    }
  }

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
    // Mappa tipo documento dal formato DB al formato select
    const docTypeMap: Record<string, string> = {
      'Carta Identità': 'carta_identita',
      "Carta d'Identità": 'carta_identita',
      'Passaporto': 'passaporto',
      'Patente': 'patente',
      'carta_identita': 'carta_identita',
      'passaporto': 'passaporto',
      'patente': 'patente',
    }
    const mappedDocType = customer.document_type ? (docTypeMap[customer.document_type] || customer.document_type) : ''

    setFormData(prev => ({
      ...prev,
      customer_id: customer.id,
      document_type: mappedDocType || prev.document_type || '',
      document_number: customer.document_number || prev.document_number || '',
      document_expiry: customer.document_expiry || prev.document_expiry || '',
      has_license: customer.has_boat_license || customer.has_license || prev.has_license || false,
      license_number: customer.boat_license_number || customer.license_number || prev.license_number || '',
      license_expiry: customer.boat_license_expiry || customer.license_expiry || prev.license_expiry || '',
    }))
    setCustomerSearch(`${customer.first_name} ${customer.last_name}`)
    setShowCustomerDropdown(false)
  }

  useEffect(() => {
    if (options.rentalServices.length > 0) {
      setAvailableServices(options.rentalServices)
    }
  }, [options.rentalServices])

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

  useEffect(() => {
    console.log('🔍 CALCOLO PREZZI - Debug:', {
      boat_id: formData.boat_id,
      service_id: formData.service_id,
      booking_date: formData.booking_date,
      time_slot: formData.time_slot,
      boats_count: options.boats.length,
      rentalServices_count: options.rentalServices.length,
      booking_mode: !!booking
    })
    
    if (options.rentalServices.length === 0) {
      console.log('⏭️ Skipping - rentalServices non ancora caricati')
      return
    }
    
    const selectedService = options.rentalServices.find((s: any) => s.id === formData.service_id)
    console.log('🔍 Selected Service:', selectedService?.name, selectedService?.service_type)
    
    if (selectedService?.service_type === 'collective') {
      console.log('⏭️ Skipping - collective service')
      return
    }
    
    const hasBoatId = !!formData.boat_id
    const hasDate = !!formData.booking_date
    const hasTimeSlot = !!formData.time_slot
    const hasBoats = options.boats.length > 0
    const isNewBooking = !booking
    
    console.log('🔍 CHECK CONDIZIONI:', {
      hasBoatId,
      hasDate,
      hasTimeSlot,
      hasBoats,
      isNewBooking,
      TUTTE_OK: hasBoatId && hasDate && hasTimeSlot && hasBoats && isNewBooking
    })
    
    if (
      formData.boat_id && 
      formData.booking_date &&
      formData.time_slot &&
      formData.service_id &&
      options.boats.length > 0
    ) {
      const selectedBoat = options.boats.find((b: any) => b.id === formData.boat_id)
      console.log('🚤 Selected Boat:', selectedBoat?.name)
      
      if (selectedBoat) {
        let price = 0
        const month = new Date(formData.booking_date).getMonth() + 1
        const isFullDay = formData.time_slot === 'full_day'
        console.log('📅 Month:', month, 'IsFullDay:', isFullDay)
        
        const isRental = selectedService?.service_type === 'rental'
        console.log('🏷️ Tipo servizio:', isRental ? 'RENTAL (Locazione)' : 'CHARTER/TOUR')
        
        if (isRental) {
          if ([4, 5, 10].includes(month)) {
            price = isFullDay 
              ? (selectedBoat.price_charter_apr_may_oct_full_day || 0)
              : (selectedBoat.price_charter_apr_may_oct_half_day || 0)
          } else if (month === 6) {
            price = isFullDay
              ? (selectedBoat.price_charter_june_full_day || 0)
              : (selectedBoat.price_charter_june_half_day || 0)
          } else if ([7, 9].includes(month)) {
            price = isFullDay
              ? (selectedBoat.price_charter_july_sept_full_day || 0)
              : (selectedBoat.price_charter_july_sept_half_day || 0)
          } else if (month === 8) {
            price = isFullDay
              ? (selectedBoat.price_charter_august_full_day || 0)
              : (selectedBoat.price_charter_august_half_day || 0)
          }
          console.log('💰 Prezzo LOCAZIONE dalla barca:', price)
        } else {
          console.log('🔍 Caricamento prezzo da boat_services...')
          
          fetch(`/api/boats/${formData.boat_id}/services`)
            .then(res => res.json())
            .then(boatServices => {
              console.log('📋 Boat services:', boatServices)
              
              const servicePrice = boatServices.find((bs: any) => 
                bs.service_id === formData.service_id
              )
              
              if (servicePrice) {
                let priceFromService = 0
                if ([4, 5, 10].includes(month)) {
                  priceFromService = servicePrice.price_apr_may_oct || 0
                } else if (month === 6) {
                  priceFromService = servicePrice.price_june || 0
                } else if ([7, 9].includes(month)) {
                  priceFromService = servicePrice.price_july_sept || 0
                } else if (month === 8) {
                  priceFromService = servicePrice.price_august || 0
                }
                
                console.log('💰 Prezzo TOUR da boat_services:', priceFromService)
                
                if (priceFromService > 0) {
                  setFormData(prev => ({
                    ...prev,
                    // ⭐ FIX 27/04/2026: in modifica NON sovrascrivere prezzi salvati
                    base_price: (booking && booking.id) ? prev.base_price : priceFromService,
                    final_price: (booking && booking.id) ? prev.final_price : priceFromService
                  }))
                  if (!(booking && booking.id) || formData.final_price === formData.base_price) {
                    toast.success(`Prezzo automatico: €${priceFromService}`)
                  }
                } else {
                  console.warn('⚠️ Prezzo tour non configurato per questo periodo')
                }
              } else {
                console.warn('⚠️ Servizio non configurato per questa barca')
              }
            })
            .catch(err => {
              console.error('❌ Errore caricamento boat_services:', err)
            })
          
          return
        }
          
        console.log('💰 Prezzo dalla BARCA:', price)
        console.log('💰 Prezzo FINALE:', price)
        
        if (price && price > 0) {
          setFormData(prev => {
            const days = prev.num_days || 1
            const totalPrice = price * days
            return {
              ...prev,
              daily_price: price,
              // ⭐ FIX 27/04/2026: in modifica NON sovrascrivere il prezzo salvato
              base_price: (booking && booking.id) ? prev.base_price : price,
              final_price: (booking && booking.id) ? prev.final_price : totalPrice
            }
          })
          const days = formData.num_days || 1
          if (!booking || formData.final_price === formData.base_price) {
            toast.success(days > 1 
              ? `Prezzo: €${price}/giorno × ${days} giorni = €${price * days}` 
              : `Prezzo automatico: €${price}`)
          }
        } else {
          console.warn('⚠️ No price found for this period')
        }
        
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
    } else {
      console.warn('⚠️ CONDIZIONI NON SODDISFATTE per calcolo prezzi:', {
        boat_id: formData.boat_id,
        booking_date: formData.booking_date,
        time_slot: formData.time_slot,
        boats_length: options.boats.length,
        is_editing: !!booking
      })
    }
  }, [formData.boat_id, formData.service_id, formData.booking_date, formData.booking_end_date, formData.num_days, formData.time_slot, options.boats, options.rentalServices, booking])

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
      options.rentalServices.length > 0
    ) {
      const selectedService = options.rentalServices.find((s: any) => s.id === formData.service_id)
      
      console.log('💰 Selected Service for collective:', {
        name: selectedService?.name,
        type: selectedService?.service_type,
        base_price: selectedService?.base_price
      })
      
      if (selectedService && selectedService.service_type === 'collective') {
        const pricePerPerson = selectedService.price_per_person || 0
        const totalPrice = pricePerPerson * formData.num_passengers
        
        console.log('💰 CALCOLO:', `€${pricePerPerson} x ${formData.num_passengers} = €${totalPrice}`)
        
        if (totalPrice > 0) {
          // ⭐ FIX 2026-04-30: i pseudo-booking (nuovo pax collettivo) NON sono booking esistenti
          // → sovrascrivi sempre il prezzo (come per le nuove prenotazioni)
          const isExistingBooking = !!(booking && booking.id)
          setFormData(prev => ({
            ...prev,
            base_price: isExistingBooking ? prev.base_price : totalPrice,
            final_price: isExistingBooking ? prev.final_price : totalPrice
          }))
          if (!isExistingBooking || formData.final_price === formData.base_price) {
            toast.success(`Prezzo calcolato: €${pricePerPerson} x ${formData.num_passengers} pax = €${totalPrice}`)
          }
        } else {
          console.warn('⚠️ Prezzo = 0! price_per_person del servizio è:', selectedService.price_per_person)
        }
      } else {
        console.log('ℹ️ Non è un servizio collective, skip calcolo x pax')
      }
    } else {
      console.log('❌ Condizioni non soddisfatte per calcolo collective')
    }
  }, [formData.service_id, formData.num_passengers, options.rentalServices, booking])

  useEffect(() => {
    if (formData.service_type === 'collective' && formData.num_passengers > 0) {
      const currentDocs = formData.passengers_documents.length
      const numPax = formData.num_passengers
      
      if (currentDocs < numPax) {
        const newDocs = [...formData.passengers_documents]
        for (let i = currentDocs; i < numPax; i++) {
          newDocs.push({ type: '', number: '', expiry: '' })
        }
        setFormData(prev => ({ ...prev, passengers_documents: newDocs }))
      } else if (currentDocs > numPax) {
        setFormData(prev => ({ ...prev, passengers_documents: prev.passengers_documents.slice(0, numPax) }))
      }
    }
  }, [formData.num_passengers, formData.service_type])

  async function getCurrentUser(): Promise<{ id: string; full_name?: string; email?: string } | null> {
    try {
      console.log('🔐 [auth] Chiamata /api/auth/me...')
      const authRes = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      console.log('🔐 [auth] Status:', authRes.status, '| OK:', authRes.ok)

      if (!authRes.ok) {
        console.warn('🔐 [auth] Response non-OK:', authRes.status, authRes.statusText)
        return null
      }

      const rawText = await authRes.text()
      console.log('🔐 [auth] Raw response (primi 200 car):', rawText.substring(0, 200))

      if (!rawText || rawText.trim() === '') {
        console.warn('🔐 [auth] Risposta vuota')
        return null
      }

      if (rawText.trim().startsWith('<')) {
        console.warn('🔐 [auth] Risposta HTML ricevuta invece di JSON — sessione scaduta?')
        return null
      }

      let authData: any
      try {
        authData = JSON.parse(rawText)
      } catch (parseErr) {
        console.error('🔐 [auth] Errore parsing JSON:', parseErr, '| testo:', rawText)
        return null
      }

      const user = authData.user ?? authData
      console.log('🔐 [auth] Utente estratto:', user)

      if (!user || !user.id) {
        console.warn('🔐 [auth] Nessun id utente trovato nella risposta:', authData)
        return null
      }

      return user
    } catch (err) {
      console.error('🔐 [auth] Eccezione nel fetch /api/auth/me:', err)
      return null
    }
  }

  /**
   * handleSubmit
   * ------------
   * Esegue le validazioni base + il guard per attribuzione fornitore.
   * Se il guard scatta, mostra il dialog di conferma e attende la scelta utente;
   * altrimenti chiama doSubmit() per il salvataggio effettivo.
   *
   * Refactored il 04/05/2026 per inserire SupplierConfirmationDialog senza
   * stravolgere la logica di salvataggio (anti-bug NS20260503-0275).
   */
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
    if (formData.booking_source !== 'online' && !formData.booking_status_id) {
      toast.error('Seleziona lo stato della prenotazione')
      return
    }

    // ⭐ 04/05/2026 — GUARD: conferma esplicita per attribuzione supplier su
    // NUOVE prenotazioni create dal modal (anti-bug NS20260503-0275).
    // Skip in tre casi:
    //   - editing di prenotazione esistente (booking.id presente)
    //   - prenotazione sincronizzata da BA (external_id valorizzato)
    //   - nessun supplier_id impostato
    const isNewBooking = !booking?.id
    const isExternalSync = !!booking?.external_id
    if (formData.supplier_id && isNewBooking && !isExternalSync) {
      console.log('⚠️ [supplier-guard] Mostro dialog conferma:', {
        supplier_id: formData.supplier_id,
        booking_source: formData.booking_source,
      })
      setShowSupplierConfirm(true)
      return // attesa conferma utente; doSubmit() partirà dal callback del dialog
    }

    await doSubmit()
  }

  /**
   * doSubmit
   * --------
   * Esegue il salvataggio effettivo della prenotazione: check disponibilità,
   * cleanData, POST/PUT, auto-email su "Confermata", chiusura modale.
   *
   * Estratta da handleSubmit il 04/05/2026 per consentire l'inserimento del
   * dialog di conferma fornitore tra le validazioni e le chiamate di rete.
   * Viene invocata in due punti: direttamente da handleSubmit (quando il guard
   * non scatta) o dal callback onConfirm del SupplierConfirmationDialog.
   */
  async function doSubmit() {
    try {
      setLoading(true)

      // ⭐ FIX 2026-04-30: identifica se è prenotazione collettiva
      const selectedServiceForCheck = options.rentalServices.find((s: any) => s.id === formData.service_id) as any
      const isCollectiveBooking = 
        formData.service_type === 'collective' ||
        booking?._isNewCollectivePax === true ||
        booking?.booking_type === 'collective' ||
        selectedServiceForCheck?.service_type === 'collective'

      const availabilityRes = await fetch('/api/bookings/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boat_id: formData.boat_id,
          booking_date: formData.booking_date,
          booking_end_date: formData.booking_end_date || formData.booking_date,
          booking_id: booking?.id,
          time_slot: formData.time_slot,
          is_collective: isCollectiveBooking,
          service_id: formData.service_id,
          num_passengers: formData.num_passengers
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

      // ⭐ FIX 2026-04-30: i pseudo-booking pre-compilati per nuovo pax collettivo
      // NON sono booking esistenti → trattali come POST (nuovo)
      const isExistingBooking = !!(booking && booking.id)
      
      const url = isExistingBooking
        ? `/api/bookings/${booking.id}` 
        : '/api/bookings'
      
      const method = isExistingBooking ? 'PUT' : 'POST'

      const cleanData = { ...formData }
      // ⭐ FIX 2026-04-30: garantisci che booking_type sia salvato per i collettivi
      if (isCollectiveBooking) {
        (cleanData as any).booking_type = 'collective'
      }
      const uuidFields = [
        'customer_id', 'boat_id', 'service_id', 'booking_status_id',
        'deposit_payment_method_id', 'balance_payment_method_id', 
        'caution_payment_method_id', 'supplier_id', 'skipper_id'
      ]
      uuidFields.forEach(field => {
        if ((cleanData as any)[field] === '') {
          (cleanData as any)[field] = null
        }
      })
      const dateFields = [
        'booking_end_date', 'deposit_payment_date', 'balance_payment_date',
        'license_expiry', 'document_expiry'
      ]
      dateFields.forEach(field => {
        if ((cleanData as any)[field] === '') {
          (cleanData as any)[field] = null
        }
      })
      // ⭐ Porti: trim e null-ify se vuoti (DB li accetta come null)
      const portFields = ['boarding_port', 'disembark_port']
      portFields.forEach(field => {
        const v = ((cleanData as any)[field] || '').toString().trim()
        ;(cleanData as any)[field] = v === '' ? null : v
      })

      const currentUser = await getCurrentUser()
      if (currentUser) {
        if (!isExistingBooking) {  // ⭐ FIX: pseudo-booking → traccia created_by
          ;(cleanData as any).created_by = currentUser.id
          ;(cleanData as any).created_by_name = currentUser.full_name || currentUser.email || ''
        }
        ;(cleanData as any).updated_by = currentUser.id
        ;(cleanData as any).updated_by_name = currentUser.full_name || currentUser.email || ''
        console.log('👤 Utente tracciato:', currentUser.full_name || currentUser.email)
      } else {
        console.warn('⚠️ Impossibile tracciare operatore: utente non disponibile')
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Errore salvataggio')
      }

      let savedId = booking?.id
      try {
        const savedData = await res.json()
        if (!savedId) savedId = savedData?.id
      } catch {
        console.log('ℹ️ Response non-JSON (normale per PUT)')
      }

      toast.success(booking ? 'Prenotazione aggiornata!' : 'Prenotazione creata!')

      const selectedStatus = options.bookingStatuses.find(
        (s: any) => s.id === formData.booking_status_id
      )
      const isConfirmed = selectedStatus?.name === 'Confermata' || selectedStatus?.code === 'confirmed'
      const wasAlreadyConfirmed = booking?.booking_status?.code === 'confirmed' || 
                                   booking?.booking_status?.name === 'Confermata'

      if (isConfirmed && !wasAlreadyConfirmed && savedId) {
        try {
          console.log('📧 Auto-email: sending to booking', savedId, 'lang:', formData.lang)
          const emailRes = await fetch(`/api/bookings/${savedId}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: formData.lang })
          })
          const emailData = await emailRes.json()
          console.log('📧 Auto-email response:', emailRes.status, emailData)
          
          if (emailRes.ok) {
            toast.success('📧 Email di conferma inviata automaticamente!')
          } else {
            console.error('Auto-email error:', emailData)
            toast.error('Email non inviata: ' + (emailData.error || 'Errore sconosciuto'))
          }
        } catch (emailErr) {
          console.error('Auto-email fetch error:', emailErr)
          toast.error('Errore connessione invio email')
        }
      } else {
        console.log('ℹ️ Auto-email skip:', { isConfirmed, wasAlreadyConfirmed, savedId })
      }

      await new Promise(resolve => setTimeout(resolve, 300))
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
              <div className="mt-1">
                <p className="text-xs text-gray-600">{booking.booking_number}</p>
                {(booking.created_by_name || booking.updated_by_name) && (
                  <p className="text-xs text-gray-400">
                    {booking.created_by_name && `Creata da: ${booking.created_by_name}`}
                    {booking.updated_by_name && ` • Ultima modifica: ${booking.updated_by_name}`}
                  </p>
                )}
              </div>
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
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
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
                    {formData.customer_id && (() => {
                      const customer = options.customers.find((c: any) => c.id === formData.customer_id)
                      return customer?.phone ? (
                        <div className="text-xs text-gray-500 mt-1">📱 {customer.phone}{customer.email ? ` • 📧 ${customer.email}` : ''}</div>
                      ) : null
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barca *</label>
                    <select
                      value={formData.boat_id}
                      onChange={(e) => {
                        const boat = options.boats.find((b: any) => b.id === e.target.value)
                        setSelectedBoat(boat || null)
                        setFormData({ ...formData, boat_id: e.target.value, service_id: '' })
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      required
                    >
                      <option value="">Seleziona...</option>
                      {options.boats
                        .filter((b: any) => {
                          if (formData.service_id) {
                            const selectedService = options.rentalServices.find((s: any) => s.id === formData.service_id)
                            if (selectedService && selectedService.name.toLowerCase().includes('capri')) {
                              if (!b.can_go_capri) return false
                            }
                          }
                          if (formData.service_id) {
                            const selectedService = options.rentalServices.find((s: any) => s.id === formData.service_id)
                            if (!selectedService) return true
                            if (selectedService.service_type === 'rental') return b.has_rental === true
                            if (selectedService.service_type === 'collective') return b.has_collective === true
                            return b.has_charter === true
                          }
                          if (formData.service_type) {
                            if (formData.service_type === 'rental') return b.has_rental === true
                            if (formData.service_type === 'collective') return b.has_collective === true
                            return b.has_charter === true
                          }
                          return true
                        })
                        .map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                {selectedBoat?.requires_license && (
                  <LicenseRequiredAlert boatName={selectedBoat.name} />
                )}

                {/* Riga 2: Tipo Servizio | Servizio | Pax | Bambini */}
                <div className="grid grid-cols-2 md:grid-cols-[2fr_3fr_1fr_1fr] gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tipo Servizio</label>
                    <select
                      value={formData.service_type}
                      onChange={(e) => setFormData({ ...formData, service_type: e.target.value, service_id: '' })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    >
                      <option value="charter">Noleggio</option>
                      <option value="rental">Locazione</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Servizio *
                      {calculatingPrice && <span className="ml-1 text-blue-600">🔄</span>}
                    </label>
                    <select
                      value={formData.service_id}
                      onChange={(e) => {
                        console.log('🔄 Servizio selezionato:', e.target.value)
                        setFormData({ ...formData, service_id: e.target.value })
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      required
                    >
                      <option value="">Seleziona...</option>
                      {availableServices
                        .filter((s: any) => {
                          if (formData.service_type === 'charter' && s.service_type === 'rental') return false
                          if (formData.service_type === 'rental' && s.service_type !== 'rental') return false
                          return true
                        })
                        .sort((a: any, b: any) => {
                          const orderA = getServiceOrder(a.name)
                          const orderB = getServiceOrder(b.name)
                          if (orderA !== orderB) return orderA - orderB
                          // Stessa priorità (o entrambi non classificati): ordine alfabetico
                          return (a.name || '').localeCompare(b.name || '', 'it')
                        })
                        .map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))
                      }
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pax</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.num_passengers}
                      onChange={(e) => setFormData({ ...formData, num_passengers: parseInt(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bambini</label>
                    <input
                      type="number"
                      min="0"
                      max={formData.num_passengers}
                      value={formData.num_minors}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0
                        const minors = Math.min(value, formData.num_passengers)
                        setFormData({ ...formData, num_minors: minors })
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Riga 3: Date e Fasce */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Inizio *</label>
                    <input
                      type="date"
                      value={formData.booking_date}
                      onChange={(e) => {
                        const newStart = e.target.value
                        const endDate = formData.booking_end_date && formData.booking_end_date < newStart 
                          ? '' : formData.booking_end_date
                        const numDays = endDate 
                          ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(newStart).getTime()) / (1000 * 60 * 60 * 24)) + 1)
                          : 1
                        setFormData({ ...formData, booking_date: newStart, booking_end_date: endDate, num_days: numDays })
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Data Fine
                      {formData.num_days > 1 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                          {formData.num_days} gg
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={formData.booking_end_date}
                      min={formData.booking_date || undefined}
                      onChange={(e) => {
                        const endDate = e.target.value
                        const numDays = endDate && formData.booking_date
                          ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(formData.booking_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)
                          : 1
                        const dailyPrice = formData.daily_price || formData.base_price || 0
                        const newFinalPrice = numDays > 1 ? dailyPrice * numDays : formData.final_price
                        setFormData({ 
                          ...formData, 
                          booking_end_date: endDate,
                          num_days: numDays,
                          final_price: numDays > 1 ? newFinalPrice : formData.final_price
                        })
                      }}
                      className={`w-full px-2 py-1.5 border rounded text-sm h-[34px] ${
                        formData.num_days > 1 ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                      }`}
                      placeholder="Singolo giorno"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fascia Oraria</label>
                    <select
                      value={formData.time_slot === 'morning' || formData.time_slot === 'afternoon' || formData.time_slot === 'full_day' || formData.time_slot === 'evening' ? formData.time_slot : (formData.time_slot ? 'custom' : '')}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setFormData({ ...formData, time_slot: '' })
                        } else {
                          setFormData({ ...formData, time_slot: e.target.value })
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    >
                      <option value="">Seleziona...</option>
                      <option value="full_day">☀️ Full Day</option>
                      <option value="morning">🌅 Mattina</option>
                      <option value="afternoon">🌇 Pomeriggio</option>
                      <option value="evening">🌙 Serale</option>
                      <option value="custom">⏰ Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Orario Personalizzato</label>
                    <input
                      type="text"
                      value={formData.time_slot === 'morning' || formData.time_slot === 'afternoon' || formData.time_slot === 'full_day' || formData.time_slot === 'evening' ? '' : formData.time_slot}
                      onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
                      placeholder="es. 18:00-23:00"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      disabled={formData.time_slot === 'morning' || formData.time_slot === 'afternoon' || formData.time_slot === 'full_day' || formData.time_slot === 'evening'}
                    />
                  </div>
                </div>

                {/* ⭐ Riga PORTI: Imbarco | Sbarco (solo testo libero, facoltativi) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      ⚓ Porto di Imbarco
                    </label>
                    <input
                      type="text"
                      value={formData.boarding_port}
                      onChange={(e) => setFormData({ ...formData, boarding_port: e.target.value })}
                      placeholder="es. Porto di Salerno"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      ⚓ Porto di Sbarco
                    </label>
                    <input
                      type="text"
                      value={formData.disembark_port}
                      onChange={(e) => setFormData({ ...formData, disembark_port: e.target.value })}
                      placeholder="es. Porto di Salerno"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      maxLength={200}
                    />
                  </div>
                </div>

                {/* Dati Documento e Patente */}
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
                    </svg>
                    Documento e Patente Nautica
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="p-2 bg-white rounded border border-amber-300">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="has_license"
                          checked={formData.has_license}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            has_license: e.target.checked,
                            license_number: e.target.checked ? formData.license_number : '',
                            license_expiry: e.target.checked ? formData.license_expiry : ''
                          })}
                          className="w-4 h-4 text-amber-600 rounded"
                        />
                        <label htmlFor="has_license" className="cursor-pointer text-sm font-medium text-gray-900">
                          ⛵ Cliente possiede Patente Nautica valida
                        </label>
                      </div>
                      
                      {formData.has_license && (
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-amber-200">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">N° Patente Nautica</label>
                            <input
                              type="text"
                              value={formData.license_number}
                              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                              placeholder="es. 12345/SA"
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Scadenza Patente</label>
                            <input
                              type="date"
                              value={formData.license_expiry}
                              onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                              min={new Date().toISOString().split('T')[0]}
                              className={`w-full px-2 py-1.5 border rounded text-sm h-[34px] ${
                                formData.license_expiry && new Date(formData.license_expiry) < new Date() 
                                  ? 'border-red-400 bg-red-50' 
                                  : 'border-gray-300'
                              }`}
                            />
                            {formData.license_expiry && new Date(formData.license_expiry) < new Date() && (
                              <p className="text-xs text-red-500 mt-0.5">⚠️ Patente scaduta!</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {formData.service_type === 'collective' ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 italic">📄 Documento per ciascun partecipante (facoltativo)</p>
                        
                        {formData.passengers_documents.map((doc: any, idx: number) => (
                          <div key={idx} className="bg-white border border-amber-300 rounded p-2 relative">
                            <span className="absolute top-1.5 left-2 text-xs font-bold text-amber-600">#{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = formData.passengers_documents.filter((_: any, i: number) => i !== idx)
                                setFormData({ ...formData, passengers_documents: updated })
                              }}
                              className="absolute top-1.5 right-2 text-red-400 hover:text-red-600 text-sm font-bold"
                            >×</button>
                            
                            <div className="grid grid-cols-3 gap-2 mt-4">
                              <div>
                                <label className="block text-xs text-gray-500 mb-0.5">Tipo</label>
                                <select
                                  value={doc.type || ''}
                                  onChange={(e) => {
                                    const updated = [...formData.passengers_documents]
                                    updated[idx] = { ...updated[idx], type: e.target.value }
                                    setFormData({ ...formData, passengers_documents: updated })
                                  }}
                                  className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                                >
                                  <option value="">Seleziona...</option>
                                  <option value="carta_identita">Carta d'Identità</option>
                                  <option value="passaporto">Passaporto</option>
                                  <option value="patente">Patente</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-0.5">Numero</label>
                                <input
                                  type="text"
                                  value={doc.number || ''}
                                  onChange={(e) => {
                                    const updated = [...formData.passengers_documents]
                                    updated[idx] = { ...updated[idx], number: e.target.value }
                                    setFormData({ ...formData, passengers_documents: updated })
                                  }}
                                  placeholder="es. AB123456"
                                  className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-0.5">Scadenza</label>
                                <input
                                  type="date"
                                  value={doc.expiry || ''}
                                  onChange={(e) => {
                                    const updated = [...formData.passengers_documents]
                                    updated[idx] = { ...updated[idx], expiry: e.target.value }
                                    setFormData({ ...formData, passengers_documents: updated })
                                  }}
                                  className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              passengers_documents: [...formData.passengers_documents, { type: '', number: '', expiry: '' }]
                            })
                          }}
                          className="w-full py-1.5 border border-dashed border-amber-400 rounded text-xs text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          ➕ Aggiungi Documento Partecipante
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Tipo Documento</label>
                          <select
                            value={formData.document_type}
                            onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                          >
                            <option value="">Seleziona...</option>
                            <option value="carta_identita">Carta d'Identità</option>
                            <option value="passaporto">Passaporto</option>
                            <option value="patente">Patente</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Numero Documento</label>
                          <input
                            type="text"
                            value={formData.document_number}
                            onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                            placeholder="es. AB123456"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Scadenza</label>
                          <input
                            type="date"
                            value={formData.document_expiry}
                            onChange={(e) => setFormData({ ...formData, document_expiry: e.target.value })}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Riga: Origine | Lingua | Stato | Skipper | Hostess */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">📍 Canale</label>
                    <select
                      value={formData.booking_source}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          booking_source: e.target.value,
                          supplier_id: e.target.value !== 'supplier' ? '' : formData.supplier_id
                        })
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    >
                      <option value="in_person">🏢 NS3000</option>
                      <option value="online">🌐 Online</option>
                      <option value="supplier">🤝 Fornitori</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">🌍 Lingua</label>
                    <select
                      value={formData.lang}
                      onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    >
                      <option value="it">🇮🇹 Italiano</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="es">🇪🇸 Español</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Stato {formData.booking_source !== 'online' && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={formData.booking_status_id}
                      onChange={(e) => setFormData({ ...formData, booking_status_id: e.target.value })}
                      className={`w-full px-2 py-1.5 border rounded text-sm h-[34px] ${
                        formData.booking_source !== 'online' && !formData.booking_status_id 
                          ? 'border-red-400 bg-red-50' 
                          : 'border-gray-300'
                      }`}
                      required={formData.booking_source !== 'online'}
                    >
                      <option value="">Seleziona...</option>
                      {options.bookingStatuses.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {formData.booking_source !== 'online' && !formData.booking_status_id && (
                      <p className="text-xs text-red-500 mt-0.5">⚠️ Obbligatorio</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">⚓ Skipper</label>
                    <select
                      value={formData.skipper_id}
                      onChange={(e) => setFormData({ ...formData, skipper_id: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    >
                      <option value="">Nessuno</option>
                      {options.skippers
                        .filter((s: any) => s.is_active)
                        .map((skipper: any) => {
                          const isExpired = skipper.license_expiry_date && 
                            new Date(skipper.license_expiry_date) < new Date()
                          const isExpiring = skipper.license_expiry_date && 
                            new Date(skipper.license_expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                          let statusIcon = '✅'
                          if (isExpired) statusIcon = '🔴'
                          else if (isExpiring) statusIcon = '🟡'
                          return (
                            <option key={skipper.id} value={skipper.id}>
                              {statusIcon} {skipper.first_name} {skipper.last_name}
                              {skipper.license_number && ` - ${skipper.license_number}`}
                            </option>
                          )
                        })
                      }
                    </select>
                    {formData.skipper_id && (() => {
                      const sk = options.skippers.find((s: any) => s.id === formData.skipper_id)
                      if (!sk) return null
                      const isExpired = sk.license_expiry_date && new Date(sk.license_expiry_date) < new Date()
                      const isExpiring = sk.license_expiry_date && new Date(sk.license_expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                      return (
                        <div className="text-xs space-y-0.5 mt-1 bg-gray-50 rounded p-1.5">
                          {sk.phone && <div className="text-gray-600">📱 {sk.phone}</div>}
                          {sk.license_expiry_date && (
                            <div className={isExpired ? 'text-red-600' : isExpiring ? 'text-yellow-600' : 'text-gray-600'}>
                              📋 Scad: {new Date(sk.license_expiry_date).toLocaleDateString('it-IT')}
                              {isExpired && ' ⚠️ SCADUTA'}
                              {!isExpired && isExpiring && ' ⚠️'}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">💃 Hostess</label>
                    <input
                      type="text"
                      value={formData.hostess_name}
                      onChange={(e) => setFormData({ ...formData, hostess_name: e.target.value })}
                      placeholder="Nome hostess..."
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                    />
                  </div>
                </div>

               {/* Fornitore (solo se canale = supplier) */}
                {formData.booking_source === 'supplier' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fornitore *</label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      required
                    >
                      <option value="">Seleziona fornitore...</option>
                      {options.suppliers
                        .filter((s: any) => s.is_active)
                        .map((supplier: any) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                            {supplier.commission_percentage > 0 && ` (${supplier.commission_percentage}%)`}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}

                {/* ⭐ 04/05/2026 — Avviso supplier "fantasma" (anti-bug NS20260503-0275).
                    Si attiva quando supplier_id è valorizzato ma il canale non è 'supplier'
                    (può capitare su prenotazioni sincronizzate da BA o pseudo-booking
                    inheritati). Mostra il fornitore, il canale e un pulsante per
                    ripulire l'attribuzione. NON viene mostrato per prenotazioni
                    già sincronizzate da BA (external_id valorizzato): in quel caso
                    l'attribuzione è legittima. */}
                {formData.supplier_id && formData.booking_source !== 'supplier' && !booking?.external_id && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 flex items-start md:items-center justify-between gap-2 text-sm">
                    <span className="text-amber-800 flex-1">
                      ⚠️ Questa prenotazione è attribuita al fornitore{' '}
                      <b>
                        {options.suppliers.find((s: any) => s.id === formData.supplier_id)?.name || 'sconosciuto'}
                      </b>
                      {' '}ma il canale è <b>{formData.booking_source}</b>. Verifica.
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, supplier_id: '' })}
                      className="ml-2 px-2 py-1 text-xs bg-white border border-amber-400 text-amber-700 rounded hover:bg-amber-100 whitespace-nowrap"
                    >
                      Rimuovi
                    </button>
                  </div>
                )}

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
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
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
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
                      />
                    </div>
                  </div>

                  {/* Acconto + Metodo + Data */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Acconto (€)</label>
                      <input type="number" step="0.01" value={formData.deposit_amount} onChange={(e) => setFormData({ ...formData, deposit_amount: parseFloat(e.target.value) || 0 })} onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo</label>
                      <select value={formData.deposit_payment_method_id} onChange={(e) => setFormData({ ...formData, deposit_payment_method_id: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                        <option value="">Seleziona...</option>
                        {options.paymentMethods.filter((p: any) => p.code === 'stripe' || p.code === 'cash' || p.code === 'pos' || p.code === 'bank_transfer').map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
                      <input type="date" value={formData.deposit_payment_date} onChange={(e) => setFormData({ ...formData, deposit_payment_date: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                  </div>

                  {/* Saldo + Metodo + Data */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Saldo (€)</label>
                      <input type="number" step="0.01" value={formData.balance_amount} onChange={(e) => setFormData({ ...formData, balance_amount: parseFloat(e.target.value) || 0 })} onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Metodo</label>
                      <select value={formData.balance_payment_method_id} onChange={(e) => setFormData({ ...formData, balance_payment_method_id: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]">
                        <option value="">Seleziona...</option>
                        {options.paymentMethods.filter((p: any) => p.code === 'stripe' || p.code === 'cash' || p.code === 'pos' || p.code === 'bank_transfer').map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
                      <input type="date" value={formData.balance_payment_date} onChange={(e) => setFormData({ ...formData, balance_payment_date: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" />
                    </div>
                  </div>

                  {/* Cauzione - SOLO rental */}
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
                          <input type="number" step="0.01" value={formData.caution_amount} onChange={(e) => setFormData({ ...formData, caution_amount: parseFloat(e.target.value) || 0 })} onFocus={(e) => e.target.select()} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]" placeholder="Importo personalizzato" />
                          <div className="flex gap-2 mt-2">
                            <button type="button" onClick={() => setFormData({ ...formData, caution_amount: 150 })} className="flex-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium">€150</button>
                            <button type="button" onClick={() => setFormData({ ...formData, caution_amount: 250 })} className="flex-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium">€250</button>
                          </div>
                        </div>
                        <div className="flex flex-col justify-end">
                          {booking && formData.caution_amount > 0 && (() => {
                            const status = cautionStatus?.stripe_status
                            return (
                              <button
                                type="button"
                                onClick={async () => {
                                  const customer = options.customers.find((c: any) => c.id === formData.customer_id)
                                  const email = customer?.email
                                  const phone = customer?.phone
                                  if (!email && !phone) { toast.error('Il cliente non ha né email né telefono'); return }
                                  const canali: string[] = []
                                  if (email) canali.push(`📧 ${email}`)
                                  if (phone) canali.push(`📱 ${phone}`)
                                  const msg = status === 'pending' 
                                    ? `Inviare un NUOVO link cauzione a:\n${canali.join('\n')}\n\n(Il link precedente verrà sostituito)`
                                    : `Inviare link cauzione di €${formData.caution_amount.toFixed(2)} a:\n${canali.join('\n')}`
                                  if (!confirm(msg)) return
                                  setLoadingCaution(true)
                                  try {
                                    const res = await fetch(`/api/bookings/${booking.id}/caution`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ send_email: true, send_sms: true }) })
                                    const data = await res.json()
                                    if (res.ok) {
                                      if (data.sent && data.sent.length > 0) toast.success(`🔒 ${data.sent.join(' + ')}`, { duration: 5000 })
                                      else toast.success('🔒 Sessione cauzione creata')
                                      if (data.errors && data.errors.length > 0) toast.error(`⚠️ ${data.errors.join(', ')}`, { duration: 5000 })
                                      setCautionStatus((prev: any) => ({ ...prev, stripe_status: 'pending', has_session: true }))
                                      if (data.checkout_url) navigator.clipboard.writeText(data.checkout_url).then(() => toast.success('📋 Link copiato negli appunti', { duration: 3000 })).catch(() => {})
                                    } else toast.error(data.error || 'Errore invio cauzione')
                                  } catch { toast.error('Errore connessione') } finally { setLoadingCaution(false) }
                                }}
                                disabled={loadingCaution || status === 'requires_capture' || status === 'captured' || status === 'released'}
                                className={`w-full px-3 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all duration-300 ${
                                  status === 'requires_capture' ? 'bg-green-500 text-white cursor-default border border-green-600 shadow-md shadow-green-200' :
                                  status === 'captured' ? 'bg-red-100 text-red-600 cursor-default border border-red-300' :
                                  status === 'released' ? 'bg-green-100 text-green-600 cursor-default border border-green-300' :
                                  status === 'pending' ? 'bg-blue-500 text-white hover:bg-blue-600 animate-pulse' :
                                  'bg-amber-500 text-white hover:bg-amber-600'
                                }`}
                                title={status === 'requires_capture' ? '✅ Cauzione pre-autorizzata dal cliente' : status === 'captured' ? '💳 Cauzione addebitata' : status === 'released' ? '✅ Cauzione rilasciata' : status === 'pending' ? '⏳ In attesa di autorizzazione dal cliente' : 'Invia link cauzione al cliente'}
                              >
                                {loadingCaution ? '⏳ Invio...' : (
                                  status === 'requires_capture' ? '✅ Cauzione Acquisita' :
                                  status === 'captured' ? `💳 Addebitata €${cautionStatus?.captured_amount?.toFixed(2)}` :
                                  status === 'released' ? '✅ Rilasciata' :
                                  status === 'pending' ? '⏳ In attesa...' :
                                  '🔒 Invia Cauzione'
)}
                              </button>
                            )
                          })()}                          {booking && formData.service_type === 'rental' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const customer = options.customers.find((c: any) => c.id === formData.customer_id)
                                if (!customer?.phone) { toast.error('Il cliente non ha un numero di telefono'); return }
                                if (!confirm(`Inviare info locazione WhatsApp a ${customer.first_name} ${customer.last_name} (${customer.phone})?`)) return
                                try {
                                  const res = await fetch(`/api/bookings/${booking.id}/send-welcome`, { method: 'POST' })
                                  const data = await res.json()
                                  if (data.success) {
                                    toast.success(`📱 ${data.message}`, { duration: 5000 })
                                  } else {
                                    toast.error(data.error || 'Errore invio')
                                  }
                                } catch { toast.error('Errore connessione') }
                              }}
                              className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center justify-center gap-1.5 mt-2"
                            >
                              📱 Invia Info Locazione
                            </button>
                          )}
                           {!booking && (<p className="text-xs text-gray-400 italic mt-1">Salva per inviare la cauzione</p>)}
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
{/* ⭐ STATO SETTLEMENT PARTNER (BA, STH, ecc.) */}
                  {(() => {
                    if (!booking) return null
                    const status = booking.settlement_status
                    if (!status || status === 'not_applicable') return null

                    const supplier = options.suppliers.find((s: any) => s.id === booking.supplier_id)
                    const supplierName = supplier?.name || 'Partner'
                    const commissionPct = booking.supplier_commission_percentage || supplier?.commission_percentage || 0
                    const grossAmount = booking.final_price || 0
                    const commissionAmount = booking.supplier_commission_amount || 
                      parseFloat(((grossAmount * commissionPct) / 100).toFixed(2))
                    const netAmount = parseFloat((grossAmount - commissionAmount).toFixed(2))

                    return (
                      <div className={`mt-3 p-3 rounded-lg border ${
                        status === 'pending' ? 'bg-yellow-50 border-yellow-300' :
                        status === 'reported' ? 'bg-blue-50 border-blue-300' :
                        status === 'settled' ? 'bg-green-50 border-green-300' :
                        'bg-gray-50 border-gray-300'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                            🤝 Vendita tramite {supplierName}
                          </h4>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            status === 'reported' ? 'bg-blue-100 text-blue-700' :
                            status === 'settled' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {status === 'pending' && '⏳ In attesa report'}
                            {status === 'reported' && '📋 Reportata'}
                            {status === 'settled' && '✅ Saldata da partner'}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Importo lordo cliente:</span>
                            <span className="font-semibold text-gray-900">€{grossAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Provvigione {supplierName} ({commissionPct.toFixed(2)}%):
                            </span>
                            <span className="font-semibold text-gray-900">−€{commissionAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-gray-300">
                            <span className="font-semibold text-gray-700">Da ricevere da {supplierName}:</span>
                            <span className={`font-bold text-base ${
                              status === 'settled' ? 'text-green-700' : 'text-amber-700'
                            }`}>
                              €{netAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Dettagli stato */}
                        {status === 'pending' && (
                          <p className="text-xs text-yellow-700 italic mt-2">
                            Il cliente ha pagato a {supplierName}. NS3000 attende il report mensile.
                          </p>
                        )}
                        {status === 'reported' && booking.settlement_batch_id && (
                          <p className="text-xs text-blue-700 mt-2">
                            📋 Inclusa nel batch settlement
                          </p>
                        )}
                        {status === 'settled' && booking.settlement_paid_at && (
                          <p className="text-xs text-green-700 mt-2">
                            ✅ Pagata da {supplierName} il {new Date(booking.settlement_paid_at).toLocaleDateString('it-IT')}
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  {/* STATO CAUZIONE STRIPE */}
                  {(() => {
                    const selectedService = options.rentalServices.find((s: any) => s.id === formData.service_id)
                    if (selectedService?.service_type !== 'rental') return null
                    if (!booking) return null
                    const status = cautionStatus?.stripe_status
                    return (
                      <div className={`mt-3 p-3 rounded-lg border ${
                        status === 'requires_capture' ? 'bg-amber-50 border-amber-300' :
                        status === 'captured' ? 'bg-red-50 border-red-300' :
                        status === 'released' ? 'bg-green-50 border-green-300' :
                        'bg-gray-50 border-gray-300'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                            🔒 Cauzione Stripe
                            <button type="button" onClick={async () => {
                              setLoadingCaution(true)
                              try {
                                const res = await fetch(`/api/bookings/${booking.id}/caution`)
                                const data = await res.json()
                                if (!data.error) {
                                  const oldStatus = cautionStatus?.stripe_status
                                  setCautionStatus(data)
                                  if (data.stripe_status !== oldStatus) {
                                    if (data.stripe_status === 'requires_capture') toast.success('🔒 Cauzione pre-autorizzata dal cliente!', { duration: 5000 })
                                    else if (data.stripe_status === 'captured') toast.success('💳 Cauzione addebitata')
                                    else if (data.stripe_status === 'released') toast.success('✅ Cauzione rilasciata')
                                    else toast.info(`Stato aggiornato: ${data.stripe_status}`)
                                  } else toast.info('Stato invariato', { duration: 2000 })
                                }
                              } catch { toast.error('Errore aggiornamento') } finally { setLoadingCaution(false) }
                            }} disabled={loadingCaution} className="text-blue-500 hover:text-blue-700 disabled:opacity-50" title="Aggiorna stato cauzione da Stripe">🔄</button>
                          </h4>
                          {status && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              status === 'pending' ? 'bg-blue-100 text-blue-700' :
                              status === 'requires_capture' ? 'bg-amber-100 text-amber-700' :
                              status === 'captured' ? 'bg-red-100 text-red-700' :
                              status === 'released' ? 'bg-green-100 text-green-700' :
                              status === 'expired' ? 'bg-gray-100 text-gray-500' :
                              status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {status === 'pending' && '⏳ Link inviato'}
                              {status === 'requires_capture' && '🔒 Pre-autorizzata'}
                              {status === 'captured' && `💳 Addebitata €${cautionStatus.captured_amount?.toFixed(2)}`}
                              {status === 'released' && '✅ Rilasciata'}
                              {status === 'expired' && '⏰ Scaduta'}
                              {status === 'failed' && '❌ Fallita'}
                            </span>
                          )}
                        </div>

                        {cautionStatus?.authorized_at && (<p className="text-xs text-gray-500 mb-2">Autorizzata: {new Date(cautionStatus.authorized_at).toLocaleString('it-IT')}</p>)}
                        {cautionStatus?.captured_at && (<p className="text-xs text-gray-500 mb-2">Addebitata: {new Date(cautionStatus.captured_at).toLocaleString('it-IT')}</p>)}
                        {cautionStatus?.released_at && (<p className="text-xs text-gray-500 mb-2">Rilasciata: {new Date(cautionStatus.released_at).toLocaleString('it-IT')}</p>)}

                        {status === 'requires_capture' && (
                          <div className="flex gap-2 mt-2">
                            <button type="button" onClick={async () => {
                              if (!confirm('Rilasciare la cauzione? Il cliente NON verrà addebitato.')) return
                              setLoadingCaution(true)
                              try {
                                const res = await fetch(`/api/bookings/${booking.id}/caution`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release' }) })
                                const data = await res.json()
                                if (res.ok) { toast.success('✅ Cauzione rilasciata!'); setCautionStatus((prev: any) => ({ ...prev, stripe_status: 'released', released_at: new Date().toISOString() })) }
                                else toast.error(data.error || 'Errore rilascio')
                              } catch { toast.error('Errore connessione') } finally { setLoadingCaution(false) }
                            }} disabled={loadingCaution} className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50">✅ Rilascia</button>
                            <button type="button" onClick={() => { setCaptureAmount(formData.caution_amount); setShowCaptureDialog(true) }} disabled={loadingCaution} className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50">💳 Addebita</button>
                          </div>
                        )}

                        {showCaptureDialog && (
                          <div className="mt-3 p-3 bg-white rounded border border-red-300">
                            <p className="text-xs font-medium text-gray-700 mb-2">Importo da addebitare (max €{formData.caution_amount.toFixed(2)}):</p>
                            <div className="flex gap-2">
                              <input type="number" step="0.01" min="0.50" max={formData.caution_amount} value={captureAmount} onChange={(e) => setCaptureAmount(parseFloat(e.target.value) || 0)} className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                              <button type="button" onClick={async () => {
                                if (!confirm(`Addebitare €${captureAmount.toFixed(2)} al cliente? Questa azione è IRREVERSIBILE.`)) return
                                setLoadingCaution(true)
                                try {
                                  const res = await fetch(`/api/bookings/${booking.id}/caution`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'capture', capture_amount: captureAmount }) })
                                  const data = await res.json()
                                  if (res.ok) { toast.success(`💳 Addebitati €${captureAmount.toFixed(2)}`); setCautionStatus((prev: any) => ({ ...prev, stripe_status: 'captured', captured_amount: captureAmount, captured_at: new Date().toISOString() })); setShowCaptureDialog(false) }
                                  else toast.error(data.error || 'Errore addebito')
                                } catch { toast.error('Errore connessione') } finally { setLoadingCaution(false) }
                              }} disabled={loadingCaution || captureAmount <= 0} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50">{loadingCaution ? '⏳' : 'Conferma'}</button>
                              <button type="button" onClick={() => setShowCaptureDialog(false)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs">✕</button>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button type="button" onClick={() => setCaptureAmount(formData.caution_amount)} className="flex-1 px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded">Totale €{formData.caution_amount.toFixed(2)}</button>
                              <button type="button" onClick={() => setCaptureAmount(Math.round(formData.caution_amount / 2 * 100) / 100)} className="flex-1 px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded">50% €{(formData.caution_amount / 2).toFixed(2)}</button>
                            </div>
                          </div>
                        )}

                        {!status && formData.caution_amount > 0 && (
                          <p className="text-xs text-gray-500 italic">Nessuna pre-autorizzazione attiva. Imposta l'importo e clicca "🔒 Invia Cauzione".</p>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm h-[34px]"
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
          <button type="button" onClick={onClose} className="px-3 md:px-4 py-2 md:py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm md:text-base" disabled={loading}>Annulla</button>
          {booking && (() => {
            const customer = options.customers.find((c: any) => c.id === formData.customer_id)
            const email = customer?.email
            return email ? (
              <button type="button" onClick={async () => {
                if (!confirm(`Inviare email di conferma a:\n${email}?`)) return
                try {
                  setSendingEmail(true)
                  const res = await fetch(`/api/bookings/${booking.id}/send-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: formData.lang }) })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || 'Errore invio email')
                  toast.success('✅ Email inviata!')
                  setEmailSent(true)
                } catch (err: any) { toast.error(err.message || 'Errore invio email') } finally { setSendingEmail(false) }
              }} className={`px-3 md:px-4 py-2 md:py-2.5 border rounded-lg font-medium text-sm md:text-base flex items-center gap-1.5 disabled:opacity-50 transition-all duration-300 ${emailSent ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`} disabled={sendingEmail} title={emailSent ? `Email inviata${booking.email_sent_at ? ' il ' + new Date(booking.email_sent_at).toLocaleString('it-IT') : ''}` : 'Invia email di conferma al cliente'}>
                {sendingEmail ? '⏳ Invio...' : (emailSent ? '✅ Email Inviata' : '📧 Invia Email')}
              </button>
            ) : null
          })()}
          {booking && (
            <button type="button" onClick={() => {
              const customer = options.customers.find((c: any) => c.id === formData.customer_id) as any
              const boat = options.boats.find((b: any) => b.id === formData.boat_id) as any
              if (!customer) { toast.error('Seleziona un cliente per generare il contratto'); return }
              generateContractPDF({
                customer_first_name: customer?.first_name || '', customer_last_name: customer?.last_name || '', customer_phone: customer?.phone || '', customer_email: customer?.email || '', customer_fiscal_code: customer?.fiscal_code || '',
                document_type: formData.document_type || '', document_number: formData.document_number || '', document_expiry: formData.document_expiry || '',
                boat_name: boat?.name || '', booking_date: formData.booking_date, time_slot: formData.time_slot, num_passengers: formData.num_passengers,
                // ⭐ Porti (se vuoti, il PDF userà fallback "Porto di Salerno")
                boarding_port: formData.boarding_port || '',
                disembark_port: formData.disembark_port || '',
                final_price: formData.final_price, deposit_amount: formData.deposit_amount, balance_amount: Math.max(0, (formData.final_price || 0) - (formData.deposit_amount || 0) - (formData.balance_amount || 0)),
                booking_number: booking?.booking_number || '', has_license: formData.has_license, license_number: formData.license_number, notes: formData.notes
              })
              toast.success('Contratto PDF generato!')
            }} className="px-3 md:px-4 py-2 md:py-2.5 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 font-medium text-sm md:text-base flex items-center gap-1.5">📄 Contratto</button>
          )}
          {booking && (
            <button type="button" onClick={async () => {
              const skipper = formData.skipper_id ? options.skippers.find((s: any) => s.id === formData.skipper_id) : null
              const destinatari = ['NS3000']
              if (skipper) destinatari.push(`Skipper ${skipper.first_name} ${skipper.last_name}`)
              if (!confirm(`Inviare SMS di notifica a:\n${destinatari.join('\n')}`)) return
              try {
                setSendingSms(true)
                const res = await fetch(`/api/bookings/${booking.id}/send-sms`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Errore invio SMS')
                toast.success(data.message || '✅ SMS inviato!')
              } catch (err: any) { toast.error(err.message || 'Errore invio SMS') } finally { setSendingSms(false) }
            }} className="px-3 md:px-4 py-2 md:py-2.5 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 font-medium text-sm md:text-base flex items-center gap-1.5 disabled:opacity-50" disabled={sendingSms}>
              {sendingSms ? '⏳ Invio...' : '📱 SMS'}
            </button>
          )}
          {/* ⭐ 04/05/2026 — Pulsante Recensione Google via WhatsApp */}
          {booking && (() => {
            const customer = options.customers.find((c: any) => c.id === formData.customer_id) as any
            return customer?.phone ? (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`Inviare WhatsApp di ringraziamento + link recensione Google a:\n${customer.first_name} ${customer.last_name}\n📱 ${customer.phone}\n\nLingua: ${formData.lang.toUpperCase()}${reviewSent ? '\n\n⚠️ Già inviato in precedenza — verrà reinviato.' : ''}`)) return
                  try {
                    setSendingReview(true)
                    const currentUser = await getCurrentUser()
                    const res = await fetch(`/api/bookings/${booking.id}/send-google-review`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        user_id: currentUser?.id,
                        user_name: currentUser?.full_name || currentUser?.email,
                      }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Errore invio')
                    toast.success(data.message || '⭐ Recensione richiesta inviata!', { duration: 5000 })
                    setReviewSent(true)
                  } catch (err: any) {
                    toast.error(err.message || 'Errore invio recensione')
                  } finally {
                    setSendingReview(false)
                  }
                }}
                disabled={sendingReview}
                className={`px-3 md:px-4 py-2 md:py-2.5 border rounded-lg font-medium text-sm md:text-base flex items-center gap-1.5 disabled:opacity-50 transition-all duration-300 ${
                  reviewSent
                    ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100'
                    : 'border-yellow-400 text-yellow-700 hover:bg-yellow-50'
                }`}
                title={reviewSent ? 'Richiesta già inviata. Click per inviare di nuovo.' : 'Invia richiesta recensione Google via WhatsApp'}
              >
                {sendingReview
                  ? '⏳ Invio...'
                  : reviewSent
                    ? '⭐ Inviata'
                    : '⭐ Recensione'}
              </button>
            ) : null
          })()}
          <button type="submit" form="booking-form"className="flex-1 px-3 md:px-4 py-2 md:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm md:text-base" disabled={loading || loadingOptions || calculatingPrice}>
            {loading ? 'Salvataggio...' : (booking ? 'Aggiorna' : 'Crea')}
          </button>
        </div>
      </div>

      {/* Create Customer Modal */}
      <CreateCustomerModal
        isOpen={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        onCustomerCreated={async (customerId) => {
          const updatedCustomers = await loadCustomersOnly()
          const customer = updatedCustomers.find((c: any) => c.id === customerId)
          if (customer) {
            setCustomerSearch(`${customer.first_name} ${customer.last_name}`)
            setFormData(prev => ({
              ...prev,
              customer_id: customerId,
              document_type: customer.document_type || prev.document_type || '',
              document_number: customer.document_number || prev.document_number || '',
              document_expiry: customer.document_expiry || prev.document_expiry || '',
              has_license: customer.has_boat_license || customer.has_license || prev.has_license || false,
              license_number: customer.boat_license_number || customer.license_number || prev.license_number || '',
              license_expiry: customer.boat_license_expiry || customer.license_expiry || prev.license_expiry || '',
            }))
          } else {
            setFormData(prev => ({ ...prev, customer_id: customerId }))
          }
        }}
      />

      {/* ⭐ 04/05/2026 — Dialog conferma attribuzione fornitore (anti-bug NS20260503-0275) */}
      {(() => {
        const supplier = options.suppliers.find((s: any) => s.id === formData.supplier_id) as any
        return (
          <SupplierConfirmationDialog
            isOpen={showSupplierConfirm}
            supplierName={supplier?.name || 'Fornitore'}
            bookingSource={formData.booking_source}
            commissionPercentage={supplier?.commission_percentage}
            finalPrice={formData.final_price}
            isCommissionConfigured={!!supplier?.commission_percentage && supplier.commission_percentage > 0}
            onConfirm={async () => {
              setShowSupplierConfirm(false)
              await doSubmit()
            }}
            onCancel={() => setShowSupplierConfirm(false)}
          />
        )
      })()}
    </div>
  )
}