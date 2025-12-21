'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, Calendar, Ban } from 'lucide-react'

type Boat = {
  id: string
  name: string
  boat_type: string
}

type TimeSlot = {
  id: string
  name: string
  start_time: string
  end_time: string
}

type Booking = {
  id: string
  booking_number: string
  boat_id: string
  booking_date: string
  time_slot_id: string
  customer: { first_name: string; last_name: string }
  service: { name: string }
  booking_status: { name: string; code: string; color_code: string; blocks_availability: boolean }
}

type Unavailability = {
  id?: string
  boat_id: string
  start_date: string
  end_date: string
  reason: string | null
}

export default function PlanningPage() {
  const [boats, setBoats] = useState<Boat[]>([])
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [unavailability, setUnavailability] = useState<Unavailability[]>([])
  const [loading, setLoading] = useState(true)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()))
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  
  const [blockFormData, setBlockFormData] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  })

  function getMonday(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  function getWeekDays(startDate: Date): Date[] {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate)
      day.setDate(startDate.getDate() + i)
      days.push(day)
    }
    return days
  }

  const weekDays = getWeekDays(currentWeekStart)

  useEffect(() => {
    loadPlanning()
  }, [currentWeekStart])

  const loadPlanning = async () => {
    try {
      setLoading(true)
      const startDate = formatDate(weekDays[0])
      const endDate = formatDate(weekDays[6])

      const response = await fetch(`/api/planning?startDate=${startDate}&endDate=${endDate}`)
      const data = await response.json()

      setBoats(data.boats || [])
      
      // Rimuovi duplicati di Full Day
      const uniqueSlots = (data.slots || []).filter((slot: TimeSlot, index: number, self: TimeSlot[]) => {
        if (slot.name === 'Full Day') {
          return index === self.findIndex(s => s.name === 'Full Day')
        }
        return true
      })
      setSlots(uniqueSlots)
      
      setBookings(data.bookings || [])
      setUnavailability(data.unavailability || [])
    } catch (error) {
      console.error('Errore caricamento planning:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const formatDateDisplay = (date: Date): string => {
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    setCurrentWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    setCurrentWeekStart(newStart)
  }

  const goToToday = () => {
    setCurrentWeekStart(getMonday(new Date()))
  }

  const getBooking = (boatId: string, date: Date, slotId: string): Booking | undefined => {
    const dateStr = formatDate(date)
    return bookings.find(
      b => b.boat_id === boatId && b.booking_date === dateStr && b.time_slot_id === slotId
    )
  }

  const isBoatUnavailable = (boatId: string, date: Date): boolean => {
    const dateStr = formatDate(date)
    return unavailability.some(
      u => u.boat_id === boatId && dateStr >= u.start_date && dateStr <= u.end_date
    )
  }

  const handleCellClick = (boat: Boat, date: Date) => {
    const isUnavailable = isBoatUnavailable(boat.id, date)
    
    if (isUnavailable) {
      if (confirm('Vuoi rimuovere il blocco per questa data?')) {
        removeBlock(boat.id, date)
      }
    } else {
      // Apri dialog per bloccare
      setSelectedBoat(boat)
      setSelectedDate(date)
      setBlockFormData({
        start_date: formatDate(date),
        end_date: formatDate(date),
        reason: ''
      })
      setBlockDialogOpen(true)
    }
  }

  const handleBlockSave = async () => {
    if (!selectedBoat) return

    try {
      const response = await fetch('/api/planning/unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boat_id: selectedBoat.id,
          start_date: blockFormData.start_date,
          end_date: blockFormData.end_date,
          reason: blockFormData.reason || null
        })
      })

      if (!response.ok) {
        alert('Errore durante il blocco')
        return
      }

      setBlockDialogOpen(false)
      loadPlanning()
    } catch (error) {
      console.error('Errore blocco:', error)
      alert('Errore durante il blocco')
    }
  }

  const removeBlock = async (boatId: string, date: Date) => {
    const dateStr = formatDate(date)
    const block = unavailability.find(
      u => u.boat_id === boatId && dateStr >= u.start_date && dateStr <= u.end_date
    )

    if (!block || !block.id) return

    try {
      const response = await fetch(`/api/planning/unavailability/${block.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        alert('Errore durante la rimozione del blocco')
        return
      }

      loadPlanning()
    } catch (error) {
      console.error('Errore rimozione blocco:', error)
      alert('Errore durante la rimozione del blocco')
    }
  }

  const renderCell = (boat: Boat, date: Date, slot: TimeSlot) => {
    const booking = getBooking(boat.id, date, slot.id)
    const isUnavailable = isBoatUnavailable(boat.id, date)

    if (isUnavailable) {
      // BLU = Indisponibile
      return (
        <div 
          className="h-full min-h-[60px] bg-blue-500 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
          onClick={() => handleCellClick(boat, date)}
          title="Non disponibile - Clicca per rimuovere blocco"
        >
          <Ban className="h-4 w-4 text-white" />
        </div>
      )
    }

    if (booking) {
      // ROSSO = Prenotata
      return (
        <div
          className="h-full min-h-[60px] bg-red-500 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => alert(`Prenotazione: ${booking.booking_number}\nCliente: ${booking.customer.first_name} ${booking.customer.last_name}\nServizio: ${booking.service.name}`)}
          title={`${booking.customer.last_name} - ${booking.service.name}`}
        >
        </div>
      )
    }

    // BIANCO = Libera
    return (
      <div 
        className="h-full min-h-[60px] bg-white hover:bg-gray-50 cursor-pointer transition-colors border-r border-b"
        onClick={() => handleCellClick(boat, date)}
        title="Disponibile - Clicca per bloccare"
      >
      </div>
    )
  }

  if (loading) {
    return <div className="p-8">Caricamento planning...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header con navigazione */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Planning Settimanale</h1>
          <p className="text-gray-600 mt-1">Disponibilità barche e prenotazioni</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={goToToday}>
            <Calendar className="mr-2 h-4 w-4" />
            Oggi
          </Button>
          <Button variant="outline" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legenda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white border-2 border-gray-300"></div>
              <span>Libera (clicca per bloccare)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500"></div>
              <span>Prenotata</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500"></div>
              <span>Indisponibile (clicca per sbloccare)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Griglia Planning */}
      <Card>
        <CardHeader>
          <CardTitle>
            Settimana dal {formatDateDisplay(weekDays[0])} al {formatDateDisplay(weekDays[6])}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 bg-gray-50 z-10 border p-3 text-left font-semibold min-w-[150px]">
                    Imbarcazione
                  </th>
                  {weekDays.map((day, idx) => (
                    <th
                      key={idx}
                      colSpan={slots.length}
                      className={`border p-3 text-center font-semibold ${
                        formatDate(day) === formatDate(new Date()) ? 'bg-blue-50' : ''
                      }`}
                    >
                      {formatDateDisplay(day)}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-100">
                  <th className="sticky left-0 bg-gray-100 z-10 border"></th>
                  {weekDays.map((day, dayIdx) =>
                    slots.map((slot, slotIdx) => (
                      <th
                        key={`${dayIdx}-${slotIdx}`}
                        className="border p-2 text-xs text-center font-medium"
                      >
                        {slot.name}
                        <div className="text-xs font-normal text-gray-500">
                          {slot.start_time.substring(0, 5)}-{slot.end_time.substring(0, 5)}
                        </div>
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {boats.length === 0 ? (
                  <tr>
                    <td colSpan={1 + weekDays.length * slots.length} className="text-center py-8 text-gray-500">
                      Nessuna barca disponibile
                    </td>
                  </tr>
                ) : (
                  boats.map((boat) => (
                    <tr key={boat.id}>
                      <td className="sticky left-0 bg-white z-10 border p-3 font-medium">
                        <div>{boat.name}</div>
                        <div className="text-xs text-gray-500">{boat.boat_type}</div>
                      </td>
                      {weekDays.map((day, dayIdx) =>
                        slots.map((slot, slotIdx) => (
                          <td
                            key={`${dayIdx}-${slotIdx}`}
                            className="border p-0"
                          >
                            {renderCell(boat, day, slot)}
                          </td>
                        ))
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Blocco Date */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Blocca Disponibilità</DialogTitle>
            <DialogDescription>
              {selectedBoat?.name} - {selectedDate && formatDateDisplay(selectedDate)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data Inizio *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={blockFormData.start_date}
                  onChange={(e) => setBlockFormData({ ...blockFormData, start_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">Data Fine *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={blockFormData.end_date}
                  onChange={(e) => setBlockFormData({ ...blockFormData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Input
                id="reason"
                value={blockFormData.reason}
                onChange={(e) => setBlockFormData({ ...blockFormData, reason: e.target.value })}
                placeholder="Es. Manutenzione, Revisione motore..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleBlockSave}
              disabled={!blockFormData.start_date || !blockFormData.end_date}
            >
              Blocca
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}