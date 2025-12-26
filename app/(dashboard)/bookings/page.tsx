'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Calendar, Clock, UserPlus, User } from 'lucide-react'

type BookingOption = {
  customers: Array<{ id: string; first_name: string; last_name: string }>
  boats: Array<{ 
    id: string
    name: string
    price_low_season_half_day: number | null
    price_low_season_full_day: number | null
    price_low_season_week: number | null
    price_july_half_day: number | null
    price_july_full_day: number | null
    price_july_week: number | null
    price_august_half_day: number | null
    price_august_full_day: number | null
    price_august_week: number | null
    price_september_half_day: number | null
    price_september_full_day: number | null
    price_september_week: number | null
  }>
  services: Array<{ 
    id: string
    name: string
    type: string
    price_per_person: number | null
    is_collective_tour: boolean
  }>
  suppliers: Array<{ id: string; name: string }>
  ports: Array<{ id: string; name: string; code: string }>
  timeSlots: Array<{ id: string; name: string; start_time: string; end_time: string }>
  statuses: Array<{ id: string; name: string; code: string }>
}

type Booking = {
  id: string
  booking_number: string
  booking_date: string
  base_price: number
  security_deposit: number
  notes: string | null
  customer: { id: string; first_name: string; last_name: string; email: string; phone: string }
  boat: { id: string; name: string; boat_type: string }
  service: { id: string; name: string; type: string }
  supplier?: { id: string; name: string }
  port: { id: string; name: string; code: string }
  time_slot: { id: string; name: string; start_time: string; end_time: string }
  booking_status: { id: string; name: string; code: string; color_code: string }
  final_price: number
  deposit_amount: number
  balance_amount: number
  num_passengers: number | null
  custom_time: string | null
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [options, setOptions] = useState<BookingOption | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<any>(null)

  const [formData, setFormData] = useState({
    booking_date: '',
    customer_id: '',
    boat_id: '',
    service_id: '',
    supplier_id: '',
    port_id: '',
    time_slot_id: '',
    custom_time: '',
    booking_status_id: '',
    num_passengers: '',
    base_price: '',
    final_price: '',
    deposit_amount: '0',
    balance_amount: '0',
    security_deposit: '0',
    notes: ''
  })

  const [customerFormData, setCustomerFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    document_type: 'Carta Identità',
    document_number: '',
    document_expiry: '',
    has_boat_license: false,
    boat_license_number: '',
    boat_license_expiry: '',
    notes: ''
  })

  useEffect(() => {
    loadBookings()
    loadOptions()
  }, [])

  // Calcola prezzo automatico basato su servizio/barca + data + passeggeri
  const calculatePrice = (
    serviceId: string,
    boatId: string, 
    date: string, 
    timeSlotId: string,
    numPassengers: string
  ) => {
    if (!serviceId || !date || !timeSlotId || !options) return null

    const service = options.services.find(s => s.id === serviceId)
    if (!service) return null

    // TOUR COLLETTIVO - Prezzo per persona
    if (service.is_collective_tour && service.price_per_person) {
      const passengers = parseInt(numPassengers) || 1
      return service.price_per_person * passengers
    }

    // NOLEGGIO BARCA - Prezzo stagionale
    if (!boatId) return null
    const boat = options.boats.find(b => b.id === boatId)
    const timeSlot = options.timeSlots.find(t => t.id === timeSlotId)
    if (!boat || !timeSlot) return null

    const bookingDate = new Date(date)
    const month = bookingDate.getMonth() + 1

    let price = null

    // Determina stagione
    if (month >= 4 && month <= 6) {
      if (timeSlot.name === 'Mattina' || timeSlot.name === 'Pomeriggio') {
        price = boat.price_low_season_half_day
      } else if (timeSlot.name === 'Full Day') {
        price = boat.price_low_season_full_day
      } else if (timeSlot.name === 'Week') {
        price = boat.price_low_season_week
      }
    } else if (month === 7) {
      if (timeSlot.name === 'Mattina' || timeSlot.name === 'Pomeriggio') {
        price = boat.price_july_half_day
      } else if (timeSlot.name === 'Full Day') {
        price = boat.price_july_full_day
      } else if (timeSlot.name === 'Week') {
        price = boat.price_july_week
      }
    } else if (month === 8) {
      if (timeSlot.name === 'Mattina' || timeSlot.name === 'Pomeriggio') {
        price = boat.price_august_half_day
      } else if (timeSlot.name === 'Full Day') {
        price = boat.price_august_full_day
      } else if (timeSlot.name === 'Week') {
        price = boat.price_august_week
      }
    } else if (month === 9) {
      if (timeSlot.name === 'Mattina' || timeSlot.name === 'Pomeriggio') {
        price = boat.price_september_half_day
      } else if (timeSlot.name === 'Full Day') {
        price = boat.price_september_full_day
      } else if (timeSlot.name === 'Week') {
        price = boat.price_september_week
      }
    }

    return price
  }

  // Aggiorna prezzi quando cambiano servizio/barca/data/fascia/passeggeri
  useEffect(() => {
    const price = calculatePrice(
      formData.service_id,
      formData.boat_id,
      formData.booking_date,
      formData.time_slot_id,
      formData.num_passengers
    )
    if (price !== null && price !== undefined) {
      setFormData(prev => ({
        ...prev,
        base_price: price.toString(),
        final_price: price.toString(),
        balance_amount: (price - parseFloat(prev.deposit_amount || '0')).toFixed(2)
      }))
    }
  }, [formData.service_id, formData.boat_id, formData.booking_date, formData.time_slot_id, formData.num_passengers])

  const loadBookings = async () => {
    try {
      const response = await fetch('/api/bookings')
      const data = await response.json()
      setBookings(data)
    } catch (error) {
      console.error('Errore caricamento prenotazioni:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOptions = async () => {
    try {
      const response = await fetch('/api/bookings/options')
      const data = await response.json()
      setOptions(data)
    } catch (error) {
      console.error('Errore caricamento opzioni:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      booking_date: '',
      customer_id: '',
      boat_id: '',
      service_id: '',
      supplier_id: '',
      port_id: '',
      time_slot_id: '',
      custom_time: '',
      booking_status_id: options?.statuses.find(s => s.code === 'pending')?.id || '',
      num_passengers: '',
      base_price: '',
      final_price: '',
      deposit_amount: '0',
      balance_amount: '0',
      security_deposit: '0',
      notes: ''
    })
    setEditingBooking(null)
  }

  const resetCustomerForm = () => {
    setCustomerFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      document_type: 'Carta Identità',
      document_number: '',
      document_expiry: '',
      has_boat_license: false,
      boat_license_number: '',
      boat_license_expiry: '',
      notes: ''
    })
  }

  const handleNew = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (booking: Booking) => {
    setEditingBooking(booking)
    setFormData({
      booking_date: booking.booking_date,
      customer_id: booking.customer?.id || '',
      boat_id: booking.boat?.id || '',
      service_id: booking.service?.id || '',
      supplier_id: booking.supplier?.id || '',
      port_id: booking.port?.id || '',
      time_slot_id: booking.time_slot?.id || '',
      custom_time: booking.custom_time || '',
      booking_status_id: booking.booking_status?.id || '',
      num_passengers: booking.num_passengers?.toString() || '',
      base_price: booking.base_price?.toString() || '',
      final_price: booking.final_price.toString(),
      deposit_amount: booking.deposit_amount.toString(),
      balance_amount: booking.balance_amount.toString(),
      security_deposit: booking.security_deposit?.toString() || '0',
      notes: booking.notes || ''
    })
    setDialogOpen(true)
  }

  const handleCreateCustomer = async () => {
    if (!customerFormData.first_name || !customerFormData.last_name) {
      alert('Nome e Cognome sono obbligatori')
      return
    }

    try {
      const payload = {
        ...customerFormData,
        document_expiry: customerFormData.document_expiry || null,
        boat_license_expiry: customerFormData.boat_license_expiry || null
      }

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        alert('Errore durante la creazione del cliente')
        return
      }

      const newCustomer = await response.json()
      await loadOptions()
      setFormData({ ...formData, customer_id: newCustomer.id })
      setCustomerDialogOpen(false)
      resetCustomerForm()
      alert('Cliente creato con successo!')
    } catch (error) {
      console.error('Errore creazione cliente:', error)
      alert('Errore durante la creazione del cliente')
    }
  }

  const handleSave = async () => {
    try {
      const selectedSlot = options?.timeSlots.find(s => s.id === formData.time_slot_id)
      const isFullDay = selectedSlot?.name === 'Full Day'

      const payload = {
        customer_id: formData.customer_id,
        boat_id: formData.boat_id,
        service_id: formData.service_id,
        supplier_id: formData.supplier_id || null,
        port_id: formData.port_id,
        time_slot_id: formData.time_slot_id,
        custom_time: formData.custom_time || null,
        booking_status_id: formData.booking_status_id,
        booking_date: formData.booking_date,
        num_passengers: formData.num_passengers ? parseInt(formData.num_passengers) : null,
        base_price: parseFloat(formData.base_price) || 0,
        final_price: parseFloat(formData.final_price) || 0,
        deposit_amount: parseFloat(formData.deposit_amount) || 0,
        balance_amount: parseFloat(formData.balance_amount) || 0,
        security_deposit: parseFloat(formData.security_deposit) || 0,
        total_paid: 0,
        notes: formData.notes || null
      }

      if (editingBooking) {
        const response = await fetch(`/api/bookings/${editingBooking.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const error = await response.json()
          alert(error.error || 'Errore durante la modifica')
          return
        }
      } else {
        const requestPayload = {
          ...payload,
          _is_full_day: isFullDay
        }

        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload)
        })

        if (!response.ok) {
          const error = await response.json()
          alert(error.error || 'Errore durante il salvataggio')
          return
        }
      }

      setDialogOpen(false)
      resetForm()
      loadBookings()
    } catch (error) {
      console.error('Errore salvataggio:', error)
      alert('Errore durante il salvataggio')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa prenotazione?')) return

    try {
      await fetch(`/api/bookings/${id}`, {
        method: 'DELETE'
      })
      loadBookings()
    } catch (error) {
      console.error('Errore eliminazione:', error)
      alert('Errore durante l\'eliminazione')
    }
  }

  if (loading || !options) {
    return <div>Caricamento...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestione Prenotazioni</h1>
          <p className="text-gray-600 mt-1">Prenotazioni barche e servizi</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nuova Prenotazione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBooking ? 'Modifica Prenotazione' : 'Nuova Prenotazione'}
              </DialogTitle>
              <DialogDescription>
                Inserisci i dati della prenotazione
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* DATA E CLIENTE - Prima sezione */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="booking_date">Data Prenotazione *</Label>
                  <Input
                    id="booking_date"
                    type="date"
                    value={formData.booking_date}
                    onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_id">Cliente *</Label>
                  <div className="flex gap-2">
                    <select
                      id="customer_id"
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Seleziona cliente...</option>
                      {options.customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.last_name} {c.first_name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCustomerDialogOpen(true)}
                      title="Crea nuovo cliente"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sezione Servizio */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Servizio e Imbarcazione</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="service_id">Servizio *</Label>
                    <select
                      id="service_id"
                      value={formData.service_id}
                      onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Seleziona servizio...</option>
                      {options.services.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="boat_id">Barca *</Label>
                    <select
                      id="boat_id"
                      value={formData.boat_id}
                      onChange={(e) => setFormData({ ...formData, boat_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Seleziona barca...</option>
                      {options.boats.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="num_passengers">N° Passeggeri</Label>
                    <Input
                      id="num_passengers"
                      type="number"
                      value={formData.num_passengers}
                      onChange={(e) => setFormData({ ...formData, num_passengers: e.target.value })}
                      placeholder="Es. 8"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione Luogo e Orario */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Luogo e Orario
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="port_id">Porto d'Imbarco *</Label>
                    <select
                      id="port_id"
                      value={formData.port_id}
                      onChange={(e) => setFormData({ ...formData, port_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Seleziona porto...</option>
                      {options.ports.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time_slot_id">Fascia Oraria *</Label>
                    <select
                      id="time_slot_id"
                      value={formData.time_slot_id}
                      onChange={(e) => setFormData({ ...formData, time_slot_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Seleziona fascia...</option>
                      {options.timeSlots
                        .filter(t => t.name !== 'Full Day' || !options.timeSlots.some(s => s.name === 'Full Day' && s.id !== t.id))
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.start_time.substring(0, 5)} - {t.end_time.substring(0, 5)})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_time">Orario Personalizzato</Label>
                    <Input
                      id="custom_time"
                      value={formData.custom_time}
                      onChange={(e) => setFormData({ ...formData, custom_time: e.target.value })}
                      placeholder="Es. 14:30 - 18:00"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione Prezzi */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Prezzi e Pagamenti</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base_price">Listino (€)</Label>
                    <Input
                      id="base_price"
                      type="number"
                      step="0.01"
                      value={formData.base_price}
                      onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                      placeholder="500.00"
                      className="bg-blue-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="final_price">Prezzo Finale (€) *</Label>
                    <Input
                      id="final_price"
                      type="number"
                      step="0.01"
                      value={formData.final_price}
                      onChange={(e) => {
                        const finalPrice = parseFloat(e.target.value) || 0
                        const deposit = parseFloat(formData.deposit_amount) || 0
                        const balance = finalPrice - deposit
                        
                        setFormData({ 
                          ...formData, 
                          final_price: e.target.value,
                          balance_amount: balance.toFixed(2)
                        })
                      }}
                      placeholder="500.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="security_deposit">Cauzione (€)</Label>
                    <Input
                      id="security_deposit"
                      type="number"
                      step="0.01"
                      value={formData.security_deposit}
                      onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                      placeholder="200.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deposit_amount">Acconto (€)</Label>
                    <Input
                      id="deposit_amount"
                      type="number"
                      step="0.01"
                      value={formData.deposit_amount}
                      onChange={(e) => {
                        const deposit = parseFloat(e.target.value) || 0
                        const finalPrice = parseFloat(formData.final_price) || 0
                        const balance = finalPrice - deposit
                        
                        setFormData({ 
                          ...formData, 
                          deposit_amount: e.target.value,
                          balance_amount: balance.toFixed(2)
                        })
                      }}
                      placeholder="100.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="balance_amount">Saldo (€)</Label>
                    <Input
                      id="balance_amount"
                      type="number"
                      step="0.01"
                      value={formData.balance_amount}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione Stato e Fornitore */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Stato e Provenienza</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="booking_status_id">Stato Prenotazione *</Label>
                    <select
                      id="booking_status_id"
                      value={formData.booking_status_id}
                      onChange={(e) => setFormData({ ...formData, booking_status_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Seleziona stato...</option>
                      {options.statuses.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supplier_id">Fornitore (Provenienza)</Label>
                    <select
                      id="supplier_id"
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Nessuno</option>
                      {options.suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="notes">Note</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[80px]"
                  placeholder="Note aggiuntive..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !formData.customer_id ||
                  !formData.boat_id ||
                  !formData.service_id ||
                  !formData.port_id ||
                  !formData.time_slot_id ||
                  !formData.booking_date ||
                  !formData.booking_status_id ||
                  !formData.final_price
                }
              >
                {editingBooking ? 'Aggiorna' : 'Crea'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog Crea Cliente COMPLETO */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crea Nuovo Cliente</DialogTitle>
            <DialogDescription>
              Inserisci i dati anagrafici del cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Dati Anagrafici */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Dati Anagrafici
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new_first_name">Nome *</Label>
                  <Input
                    id="new_first_name"
                    value={customerFormData.first_name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, first_name: e.target.value })}
                    placeholder="Mario"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_last_name">Cognome *</Label>
                  <Input
                    id="new_last_name"
                    value={customerFormData.last_name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, last_name: e.target.value })}
                    placeholder="Rossi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new_email">Email</Label>
                  <Input
                    id="new_email"
                    type="email"
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    placeholder="mario.rossi@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_phone">Telefono</Label>
                  <Input
                    id="new_phone"
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                    placeholder="+39 333 1234567"
                  />
                </div>
              </div>
            </div>

            {/* Documento */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Documento di Identità</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new_document_type">Tipo Documento</Label>
                  <select
                    id="new_document_type"
                    value={customerFormData.document_type}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, document_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Carta Identità">Carta d'Identità</option>
                    <option value="Passaporto">Passaporto</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_document_number">Numero Documento</Label>
                  <Input
                    id="new_document_number"
                    value={customerFormData.document_number}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, document_number: e.target.value })}
                    placeholder="ES1234567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_document_expiry">Scadenza</Label>
                  <Input
                    id="new_document_expiry"
                    type="date"
                    value={customerFormData.document_expiry}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, document_expiry: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Patente Nautica */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="new_has_boat_license"
                  checked={customerFormData.has_boat_license}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, has_boat_license: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="new_has_boat_license" className="font-semibold cursor-pointer">
                  Possiede Patente Nautica
                </Label>
              </div>

              {customerFormData.has_boat_license && (
                <div className="grid grid-cols-2 gap-4 pl-7">
                  <div className="space-y-2">
                    <Label htmlFor="new_boat_license_number">Numero Patente</Label>
                    <Input
                      id="new_boat_license_number"
                      value={customerFormData.boat_license_number}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, boat_license_number: e.target.value })}
                      placeholder="PN123456"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new_boat_license_expiry">Scadenza</Label>
                    <Input
                      id="new_boat_license_expiry"
                      type="date"
                      value={customerFormData.boat_license_expiry}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, boat_license_expiry: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Note */}
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="new_notes">Note</Label>
              <textarea
                id="new_notes"
                value={customerFormData.notes}
                onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[80px]"
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={!customerFormData.first_name || !customerFormData.last_name}
            >
              Crea Cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabella Prenotazioni */}
      <Card>
        <CardHeader>
          <CardTitle>Elenco Prenotazioni ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Prenotazione</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Barca</TableHead>
                <TableHead>Servizio</TableHead>
                <TableHead>Orario</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    Nessuna prenotazione presente. Clicca "Nuova Prenotazione" per iniziare.
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.booking_number}</TableCell>
                    <TableCell>{new Date(booking.booking_date).toLocaleDateString('it-IT')}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {booking.customer.first_name} {booking.customer.last_name}
                        </div>
                        <div className="text-gray-500">{booking.customer.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>{booking.boat.name}</TableCell>
                    <TableCell>{booking.service.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {booking.custom_time || booking.time_slot.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">€ {booking.final_price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: booking.booking_status.color_code || '#gray',
                          color: 'white'
                        }}
                      >
                        {booking.booking_status.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(booking)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(booking.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}