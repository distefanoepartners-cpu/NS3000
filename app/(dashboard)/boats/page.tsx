'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { uploadImage } from '@/lib/storage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Ship, Anchor, Settings } from 'lucide-react'
import { toast } from 'sonner'

type Boat = {
  id: string
  name: string
  boat_type: string
  category: 'simple' | 'premium' | 'luxury'
  max_passengers: number | null
  length_meters: number | null
  registration_number: string | null
  is_active: boolean
  description: string | null
  image_url: string | null
  company_name: string | null
  technical_specs: {
    engine_power: number | null
    fuel_type: string | null
    year: number | null
  } | null
  has_rental: boolean
  has_charter: boolean
  // Prezzi LOCAZIONE (Charter)
  price_charter_apr_may_oct_half_day: number | null
  price_charter_apr_may_oct_full_day: number | null
  price_charter_apr_may_oct_week: number | null
  price_charter_june_half_day: number | null
  price_charter_june_full_day: number | null
  price_charter_june_week: number | null
  price_charter_july_sept_half_day: number | null
  price_charter_july_sept_full_day: number | null
  price_charter_july_sept_week: number | null
  price_charter_august_half_day: number | null
  price_charter_august_full_day: number | null
  price_charter_august_week: number | null
}

type RentalService = {
  id: string
  name: string
  description: string | null
  service_type: string
  duration: string | null
  is_active: boolean
}

type BoatService = {
  service_id: string
  price_apr_may_oct: number | null
  price_june: number | null
  price_july_sept: number | null
  price_august: number | null
}

export default function BoatsPage() {
  const [boats, setBoats] = useState<Boat[]>([])
  const [filteredBoats, setFilteredBoats] = useState<Boat[]>([])
  const [rentalServices, setRentalServices] = useState<RentalService[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modals
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showServicesModal, setShowServicesModal] = useState(false)
  const [editingBoat, setEditingBoat] = useState<Boat | null>(null)
  const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null)
  const [boatServices, setBoatServices] = useState<{[key: string]: BoatService}>({})
  
  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    boat_type: '',
    category: 'simple' as 'simple' | 'premium' | 'luxury',
    capacity: '',
    length: '',
    engine_power: '',
    fuel_type: '',
    year: '',
    registration_number: '',
    company_name: '',
    is_active: true,
    notes: '',
    has_rental: true,
    has_charter: false,
    // Prezzi Locazione
    price_charter_apr_may_oct_half_day: '',
    price_charter_apr_may_oct_full_day: '',
    price_charter_apr_may_oct_week: '',
    price_charter_june_half_day: '',
    price_charter_june_full_day: '',
    price_charter_june_week: '',
    price_charter_july_sept_half_day: '',
    price_charter_july_sept_full_day: '',
    price_charter_july_sept_week: '',
    price_charter_august_half_day: '',
    price_charter_august_full_day: '',
    price_charter_august_week: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [boats, filterCategory, searchTerm])

  async function loadData() {
    try {
      setLoading(true)

      const boatsRes = await fetch('/api/boats')
      const boatsData = await boatsRes.json()

      const servicesRes = await fetch('/api/rental-services')
      const servicesData = await servicesRes.json()

      // Load boat services for each boat
      const boatsWithServices = await Promise.all(
        (boatsData || []).map(async (boat: Boat) => {
          try {
            const res = await fetch(`/api/boats/${boat.id}/services`)
            const services = await res.json()
            return { ...boat, rental_services: services || [] }
          } catch {
            return { ...boat, rental_services: [] }
          }
        })
      )

      setBoats(boatsWithServices)
      setRentalServices(servicesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Errore caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...boats]

    if (filterCategory !== 'all') {
      filtered = filtered.filter(b => b.category === filterCategory)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(b =>
        b.name.toLowerCase().includes(term) ||
        b.boat_type.toLowerCase().includes(term) ||
        b.description?.toLowerCase().includes(term)
      )
    }

    setFilteredBoats(filtered)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      boat_type: '',
      category: 'simple',
      capacity: '',
      length: '',
      engine_power: '',
      fuel_type: '',
      year: '',
      registration_number: '',
      company_name: '',
      is_active: true,
      notes: '',
      has_rental: true,
      has_charter: false,
      price_charter_apr_may_oct_half_day: '',
      price_charter_apr_may_oct_full_day: '',
      price_charter_apr_may_oct_week: '',
      price_charter_june_half_day: '',
      price_charter_june_full_day: '',
      price_charter_june_week: '',
      price_charter_july_sept_half_day: '',
      price_charter_july_sept_full_day: '',
      price_charter_july_sept_week: '',
      price_charter_august_half_day: '',
      price_charter_august_full_day: '',
      price_charter_august_week: ''
    })
    setImageFile(null)
    setImagePreview(null)
    setEditingBoat(null)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleNew = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (boat: Boat) => {
    setEditingBoat(boat)
    setFormData({
      name: boat.name,
      boat_type: boat.boat_type,
      category: boat.category,
      capacity: boat.max_passengers?.toString() || '',
      length: boat.length_meters?.toString() || '',
      engine_power: boat.technical_specs?.engine_power?.toString() || '',
      fuel_type: boat.technical_specs?.fuel_type || '',
      year: boat.technical_specs?.year?.toString() || '',
      registration_number: boat.registration_number || '',
      company_name: boat.company_name || '',
      is_active: boat.is_active,
      notes: boat.description || '',
      has_rental: boat.has_rental ?? true,
      has_charter: boat.has_charter ?? false,
      price_charter_apr_may_oct_half_day: boat.price_charter_apr_may_oct_half_day?.toString() || '',
      price_charter_apr_may_oct_full_day: boat.price_charter_apr_may_oct_full_day?.toString() || '',
      price_charter_apr_may_oct_week: boat.price_charter_apr_may_oct_week?.toString() || '',
      price_charter_june_half_day: boat.price_charter_june_half_day?.toString() || '',
      price_charter_june_full_day: boat.price_charter_june_full_day?.toString() || '',
      price_charter_june_week: boat.price_charter_june_week?.toString() || '',
      price_charter_july_sept_half_day: boat.price_charter_july_sept_half_day?.toString() || '',
      price_charter_july_sept_full_day: boat.price_charter_july_sept_full_day?.toString() || '',
      price_charter_july_sept_week: boat.price_charter_july_sept_week?.toString() || '',
      price_charter_august_half_day: boat.price_charter_august_half_day?.toString() || '',
      price_charter_august_full_day: boat.price_charter_august_full_day?.toString() || '',
      price_charter_august_week: boat.price_charter_august_week?.toString() || ''
    })
    setImagePreview(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      let imageUrl = editingBoat?.image_url || null

      if (imageFile) {
        const url = await uploadImage(imageFile, 'boats')
        if (url) imageUrl = url
      }

      const payload = {
        name: formData.name,
        boat_type: formData.boat_type,
        category: formData.category,
        max_passengers: formData.capacity ? parseInt(formData.capacity) : null,
        length_meters: formData.length ? parseFloat(formData.length) : null,
        registration_number: formData.registration_number || null,
        company_name: formData.company_name || null,
        is_active: formData.is_active,
        description: formData.notes || null,
        image_url: imageUrl,
        technical_specs: {
          engine_power: formData.engine_power ? parseInt(formData.engine_power) : null,
          fuel_type: formData.fuel_type || null,
          year: formData.year ? parseInt(formData.year) : null
        },
        has_rental: formData.has_rental,
        has_charter: formData.has_charter,
        // Prezzi Locazione
        price_charter_apr_may_oct_half_day: formData.price_charter_apr_may_oct_half_day ? parseFloat(formData.price_charter_apr_may_oct_half_day) : null,
        price_charter_apr_may_oct_full_day: formData.price_charter_apr_may_oct_full_day ? parseFloat(formData.price_charter_apr_may_oct_full_day) : null,
        price_charter_apr_may_oct_week: formData.price_charter_apr_may_oct_week ? parseFloat(formData.price_charter_apr_may_oct_week) : null,
        price_charter_june_half_day: formData.price_charter_june_half_day ? parseFloat(formData.price_charter_june_half_day) : null,
        price_charter_june_full_day: formData.price_charter_june_full_day ? parseFloat(formData.price_charter_june_full_day) : null,
        price_charter_june_week: formData.price_charter_june_week ? parseFloat(formData.price_charter_june_week) : null,
        price_charter_july_sept_half_day: formData.price_charter_july_sept_half_day ? parseFloat(formData.price_charter_july_sept_half_day) : null,
        price_charter_july_sept_full_day: formData.price_charter_july_sept_full_day ? parseFloat(formData.price_charter_july_sept_full_day) : null,
        price_charter_july_sept_week: formData.price_charter_july_sept_week ? parseFloat(formData.price_charter_july_sept_week) : null,
        price_charter_august_half_day: formData.price_charter_august_half_day ? parseFloat(formData.price_charter_august_half_day) : null,
        price_charter_august_full_day: formData.price_charter_august_full_day ? parseFloat(formData.price_charter_august_full_day) : null,
        price_charter_august_week: formData.price_charter_august_week ? parseFloat(formData.price_charter_august_week) : null
      }

      if (editingBoat) {
        await fetch(`/api/boats/${editingBoat.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        toast.success('Barca aggiornata!')
      } else {
        await fetch('/api/boats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        toast.success('Barca creata!')
      }

      setDialogOpen(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Errore salvataggio:', error)
      toast.error('Errore durante il salvataggio')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questa barca?')) return

    try {
      await fetch(`/api/boats/${id}`, { method: 'DELETE' })
      toast.success('Barca eliminata!')
      loadData()
    } catch (error) {
      console.error('Error deleting boat:', error)
      toast.error('Errore eliminazione')
    }
  }

  async function openServicesModal(boat: Boat) {
    setSelectedBoat(boat)

    try {
      const res = await fetch(`/api/boats/${boat.id}/services`)
      const data = await res.json()

      const servicesMap: {[key: string]: BoatService} = {}
      data.forEach((bs: any) => {
        servicesMap[bs.service_id] = {
          service_id: bs.service_id,
          price_apr_may_oct: bs.price_apr_may_oct,
          price_june: bs.price_june,
          price_july_sept: bs.price_july_sept,
          price_august: bs.price_august
        }
      })

      setBoatServices(servicesMap)
    } catch (error) {
      console.error('Error loading boat services:', error)
    }

    setShowServicesModal(true)
  }

  function toggleService(serviceId: string) {
    setBoatServices(prev => {
      const newServices = { ...prev }
      if (newServices[serviceId]) {
        delete newServices[serviceId]
      } else {
        newServices[serviceId] = {
          service_id: serviceId,
          price_apr_may_oct: null,
          price_june: null,
          price_july_sept: null,
          price_august: null
        }
      }
      return newServices
    })
  }

  function updateServicePrice(serviceId: string, season: string, value: string) {
    setBoatServices(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [season]: value ? parseFloat(value) : null
      }
    }))
  }

  async function handleSaveServices() {
    if (!selectedBoat) return

    try {
      const services = Object.values(boatServices)

      await fetch(`/api/boats/${selectedBoat.id}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services })
      })

      toast.success('Servizi aggiornati!')
      setShowServicesModal(false)
      loadData()
    } catch (error) {
      console.error('Error saving services:', error)
      toast.error('Errore salvataggio')
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'simple': return 'bg-blue-100 text-blue-800'
      case 'premium': return 'bg-purple-100 text-purple-800'
      case 'luxury': return 'bg-amber-100 text-amber-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'simple': return 'Simple'
      case 'premium': return 'Premium'
      case 'luxury': return 'Luxury'
      default: return category
    }
  }

  const categoryCounts = {
    total: boats.length,
    simple: boats.filter(b => b.category === 'simple').length,
    premium: boats.filter(b => b.category === 'premium').length,
    luxury: boats.filter(b => b.category === 'luxury').length,
  }

  if (loading) {
    return <div className="p-8">Caricamento...</div>
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Gestione Barche</h1>
          <p className="text-gray-600 mt-1">Flotta e servizi noleggio</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNew} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuova Barca
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBoat ? 'Modifica Barca' : 'Nuova Barca'}
              </DialogTitle>
              <DialogDescription>
                Inserisci i dati dell'imbarcazione e i listini prezzi
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Info Base */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Es. Gozzo Sorrentino"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="boat_type">Tipo *</Label>
                  <Input
                    id="boat_type"
                    value={formData.boat_type}
                    onChange={(e) => setFormData({ ...formData, boat_type: e.target.value })}
                    placeholder="Es. Gozzo, Gommone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria *</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="simple">Simple</option>
                    <option value="premium">Premium</option>
                    <option value="luxury">Luxury</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacità</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="Es. 8"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_name">Azienda</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Es. NS3000 RENT SRL"
                  />
                </div>
              </div>

              {/* Campo Immagine */}
              <div className="space-y-2">
                <Label htmlFor="image">Immagine</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded" />
                )}
                {editingBoat?.image_url && !imagePreview && (
                  <img src={editingBoat.image_url} alt="Current" className="w-32 h-32 object-cover rounded" />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                  placeholder="Note aggiuntive..."
                />
              </div>

              {/* FLAG SERVIZI */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">Tipologie Servizio Disponibili</h3>
                <div className="flex gap-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="has_rental"
                      checked={formData.has_rental}
                      onChange={(e) => setFormData({ ...formData, has_rental: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="has_rental" className="cursor-pointer flex items-center gap-2">
                      <Ship className="h-4 w-4" />
                      Disponibile per Noleggio
                    </Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="has_charter"
                      checked={formData.has_charter}
                      onChange={(e) => setFormData({ ...formData, has_charter: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="has_charter" className="cursor-pointer flex items-center gap-2">
                      <Anchor className="h-4 w-4" />
                      Disponibile per Locazione
                    </Label>
                  </div>
                </div>
              </div>

              {/* LISTINO LOCAZIONE */}
              {formData.has_charter && (
                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Anchor className="h-5 w-5" />
                    Listino Prezzi LOCAZIONE
                  </h3>
                  
                  {/* Apr-Mag-Ott */}
                  <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3 text-blue-900">🌸 Apr / Mag / Ott</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Mezza Giornata (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="500.00"
                          value={formData.price_charter_apr_may_oct_half_day}
                          onChange={(e) => setFormData({ ...formData, price_charter_apr_may_oct_half_day: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Giornata Intera (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="800.00"
                          value={formData.price_charter_apr_may_oct_full_day}
                          onChange={(e) => setFormData({ ...formData, price_charter_apr_may_oct_full_day: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Settimanale (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="4500.00"
                          value={formData.price_charter_apr_may_oct_week}
                          onChange={(e) => setFormData({ ...formData, price_charter_apr_may_oct_week: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Giugno */}
                  <div className="mb-6 bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3 text-yellow-900">☀️ Giugno</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Mezza Giornata (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price_charter_june_half_day}
                          onChange={(e) => setFormData({ ...formData, price_charter_june_half_day: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Giornata Intera (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price_charter_june_full_day}
                          onChange={(e) => setFormData({ ...formData, price_charter_june_full_day: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Settimanale (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price_charter_june_week}
                          onChange={(e) => setFormData({ ...formData, price_charter_june_week: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Luglio-Settembre */}
                  <div className="mb-6 bg-cyan-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3 text-cyan-900">🌊 Luglio / Settembre</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Mezza Giornata (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price_charter_july_sept_half_day}
                          onChange={(e) => setFormData({ ...formData, price_charter_july_sept_half_day: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Giornata Intera (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price_charter_july_sept_full_day}
                          onChange={(e) => setFormData({ ...formData, price_charter_july_sept_full_day: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Settimanale (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price_charter_july_sept_week}
                          onChange={(e) => setFormData({ ...formData, price_charter_july_sept_week: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Agosto */}
                  <div className="mb-6 bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3 text-orange-900">🔥 Agosto</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Mezza Giornata (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price_charter_august_half_day}
                          onChange={(e) => setFormData({ ...formData, price_charter_august_half_day: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Giornata Intera (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price_charter_august_full_day}
                          onChange={(e) => setFormData({ ...formData, price_charter_august_full_day: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Settimanale (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price_charter_august_week}
                          onChange={(e) => setFormData({ ...formData, price_charter_august_week: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Barca Attiva
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.name || !formData.boat_type}
              >
                {editingBoat ? 'Aggiorna' : 'Crea'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca per nome, tipo..."
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Tutte le categorie</option>
            <option value="simple">Simple</option>
            <option value="premium">Premium</option>
            <option value="luxury">Luxury</option>
          </select>
        </div>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilterCategory('all')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterCategory === 'all' 
              ? 'border-blue-600 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Totale</div>
          <div className="text-3xl font-bold text-gray-900">{categoryCounts.total}</div>
        </button>

        <button
          onClick={() => setFilterCategory('simple')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterCategory === 'simple' 
              ? 'border-blue-600 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Simple</div>
          <div className="text-3xl font-bold text-blue-600">{categoryCounts.simple}</div>
        </button>

        <button
          onClick={() => setFilterCategory('premium')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterCategory === 'premium' 
              ? 'border-purple-600 bg-purple-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Premium</div>
          <div className="text-3xl font-bold text-purple-600">{categoryCounts.premium}</div>
        </button>

        <button
          onClick={() => setFilterCategory('luxury')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterCategory === 'luxury' 
              ? 'border-amber-600 bg-amber-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Luxury</div>
          <div className="text-3xl font-bold text-amber-600">{categoryCounts.luxury}</div>
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBoats.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nessuna barca trovata
          </div>
        ) : (
          filteredBoats.map((boat) => (
            <div key={boat.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              {/* Image */}
              <div className="relative h-64 bg-gray-100">
                {boat.image_url ? (
                  <img 
                    src={boat.image_url} 
                    alt={boat.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Ship className="w-16 h-16" />
                  </div>
                )}
                
                {/* Badges */}
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getCategoryColor(boat.category)}`}>
                    {getCategoryLabel(boat.category)}
                  </span>
                  {boat.is_active && (
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Attiva
                    </span>
                  )}
                </div>

                {/* Settings button */}
                <button
                  onClick={() => handleEdit(boat)}
                  className="absolute top-3 right-3 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100"
                >
                  <Settings className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{boat.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <span>{boat.boat_type}</span>
                  <span>•</span>
                  <span>🏢 {boat.company_name || 'NS3000 RENT SRL'}</span>
                </div>
                {boat.max_passengers && (
                  <p className="text-sm text-gray-600 mb-4">
                    Capacità: {boat.max_passengers} persone
                  </p>
                )}

                {/* Services Info */}
                {boat.has_rental && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Ship className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">Noleggio Disponibile</span>
                    </div>
                    <p className="text-xs text-gray-600">Tour e servizi configurati</p>
                  </div>
                )}

                {boat.has_charter && (
                  <div className="bg-purple-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Anchor className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-900">Locazione Disponibile</span>
                    </div>
                    {boat.price_charter_june_full_day && (
                      <p className="text-sm font-semibold text-purple-600">
                        Da €{boat.price_charter_june_full_day}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {boat.has_rental && (
                    <button
                      onClick={() => openServicesModal(boat)}
                      className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium text-sm flex items-center justify-center gap-2"
                    >
                      <Ship className="w-4 h-4" />
                      Servizi
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(boat)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDelete(boat.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium text-sm"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Services Modal */}
      {showServicesModal && selectedBoat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Gestisci Servizi Noleggio</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedBoat.name} • <span className="font-semibold">{getCategoryLabel(selectedBoat.category)}</span>
                </p>
              </div>
              <button onClick={() => setShowServicesModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  💡 Configura i prezzi stagionali per ogni servizio. Lascia vuoto se il servizio non è disponibile in quella stagione.
                </p>
              </div>

              <div className="space-y-4">
                {rentalServices.map(service => {
                  const isSelected = !!boatServices[service.id]

                  return (
                    <div
                      key={service.id}
                      className={`border-2 rounded-lg p-4 ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleService(service.id)}
                          className="mt-1 w-4 h-4 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{service.name}</h4>
                          {service.description && (
                            <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pl-7">
                          <div>
                            <label className="text-xs text-gray-600 block mb-1">Apr-Mag-Ott</label>
                            <input
                              type="number"
                              value={boatServices[service.id]?.price_apr_may_oct || ''}
                              onChange={(e) => updateServicePrice(service.id, 'price_apr_may_oct', e.target.value)}
                              placeholder="€"
                              className="w-full px-2 py-1 text-sm border rounded"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 block mb-1">Giugno</label>
                            <input
                              type="number"
                              value={boatServices[service.id]?.price_june || ''}
                              onChange={(e) => updateServicePrice(service.id, 'price_june', e.target.value)}
                              placeholder="€"
                              className="w-full px-2 py-1 text-sm border rounded"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 block mb-1">Lug-Sett</label>
                            <input
                              type="number"
                              value={boatServices[service.id]?.price_july_sept || ''}
                              onChange={(e) => updateServicePrice(service.id, 'price_july_sept', e.target.value)}
                              placeholder="€"
                              className="w-full px-2 py-1 text-sm border rounded"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 block mb-1">Agosto</label>
                            <input
                              type="number"
                              value={boatServices[service.id]?.price_august || ''}
                              onChange={(e) => updateServicePrice(service.id, 'price_august', e.target.value)}
                              placeholder="€"
                              className="w-full px-2 py-1 text-sm border rounded"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowServicesModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveServices}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Salva Servizi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}