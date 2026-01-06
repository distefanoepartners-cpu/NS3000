'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { Plus, Pencil, Trash2, Ship, Users, Clock } from 'lucide-react'
import { toast } from 'sonner'

type RentalService = {
  id: string
  name: string
  description: string | null
  service_type: 'tour' | 'collective' | 'charter' | 'transfer'
  duration: 'half_day' | 'full_day' | 'week' | 'custom' | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function ServicesPage() {
  const [services, setServices] = useState<RentalService[]>([])
  const [filteredServices, setFilteredServices] = useState<RentalService[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<RentalService | null>(null)
  
  const [filterType, setFilterType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    service_type: 'tour' as 'tour' | 'collective' | 'charter' | 'transfer',
    duration: 'full_day' as 'half_day' | 'full_day' | 'week' | 'custom',
    price_per_person: '',
    image_url: '',
    is_active: true
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    loadServices()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [services, filterType, searchTerm])

  async function loadServices() {
    try {
      setLoading(true)
      const res = await fetch('/api/rental-services')
      const data = await res.json()
      setServices(data || [])
    } catch (error) {
      console.error('Error loading services:', error)
      toast.error('Errore caricamento servizi')
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...services]

    if (filterType !== 'all') {
      filtered = filtered.filter(s => s.service_type === filterType)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.description?.toLowerCase().includes(term)
      )
    }

    setFilteredServices(filtered)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      service_type: 'tour',
      duration: 'full_day',
      price_per_person: '',
      image_url: '',
      is_active: true
    })
    setImageFile(null)
    setImagePreview(null)
    setEditingService(null)
  }

  const handleNew = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (service: RentalService) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || '',
      service_type: service.service_type,
      duration: service.duration || 'full_day',
      price_per_person: (service as any).price_per_person?.toString() || '',
      image_url: (service as any).image_url || '',
      is_active: service.is_active
    })
    setImageFile(null)
    setImagePreview((service as any).image_url || null)
    setDialogOpen(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Il file deve essere un\'immagine')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Immagine troppo grande (max 5MB)')
        return
      }
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    try {
      let imageUrl = formData.image_url

      // Upload immagine se presente
      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)
        formData.append('bucket', 'services')

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          imageUrl = uploadData.url
        }
      }

      const payload = {
        name: formData.name,
        description: formData.description || null,
        service_type: formData.service_type,
        duration: formData.duration,
        price_per_person: formData.price_per_person ? parseFloat(formData.price_per_person) : null,
        image_url: imageUrl || null,
        is_active: formData.is_active
      }

      if (editingService) {
        await fetch(`/api/rental-services/${editingService.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        toast.success('Servizio aggiornato!')
      } else {
        await fetch('/api/rental-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        toast.success('Servizio creato!')
      }

      setDialogOpen(false)
      resetForm()
      loadServices()
    } catch (error) {
      console.error('Errore salvataggio:', error)
      toast.error('Errore durante il salvataggio')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo servizio?')) return

    try {
      await fetch(`/api/rental-services/${id}`, { method: 'DELETE' })
      toast.success('Servizio eliminato!')
      loadServices()
    } catch (error) {
      console.error('Error deleting service:', error)
      toast.error('Errore eliminazione')
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'tour': return 'bg-blue-100 text-blue-800'
      case 'collective': return 'bg-purple-100 text-purple-800'
      case 'charter': return 'bg-green-100 text-green-800'
      case 'transfer': return 'bg-amber-100 text-amber-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'tour': return 'Tour'
      case 'collective': return 'Collettivo'
      case 'charter': return 'Locazione'
      case 'transfer': return 'Transfer'
      default: return type
    }
  }

  const getDurationLabel = (duration: string | null) => {
    switch (duration) {
      case 'half_day': return '½ Giornata'
      case 'full_day': return 'Giornata Intera'
      case 'week': return 'Settimanale'
      case 'custom': return 'Personalizzato'
      default: return 'Non specificato'
    }
  }

  const typeCounts = {
    total: services.length,
    tour: services.filter(s => s.service_type === 'tour').length,
    collective: services.filter(s => s.service_type === 'collective').length,
    charter: services.filter(s => s.service_type === 'charter').length,
    transfer: services.filter(s => s.service_type === 'transfer').length,
  }

  if (loading) {
    return <div className="p-8">Caricamento...</div>
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Gestione Servizi</h1>
          <p className="text-gray-600 mt-1">Tour, locazioni e trasferimenti</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNew} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Servizio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingService ? 'Modifica Servizio' : 'Nuovo Servizio'}
              </DialogTitle>
              <DialogDescription>
                Inserisci i dati del servizio
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Immagine */}
              <div className="space-y-2">
                <Label htmlFor="image">Immagine Servizio</Label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null)
                        setImagePreview(null)
                        setFormData({ ...formData, image_url: '' })
                      }}
                      className="absolute top-2 right-2 px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                    >
                      Rimuovi
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <div className="text-gray-600">
                        <span className="text-4xl mb-2 block">📷</span>
                        <span className="text-sm">Click per caricare immagine</span>
                        <span className="text-xs text-gray-500 block mt-1">
                          JPG, PNG, WebP (max 5MB)
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome Servizio *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es. Tour Capri"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                  placeholder="Descrizione del servizio..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service_type">Tipo *</Label>
                  <select
                    id="service_type"
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="tour">Tour</option>
                    <option value="collective">Collettivo</option>
                    <option value="charter">Locazione</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Durata</Label>
                  <select
                    id="duration"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="half_day">Mezza Giornata</option>
                    <option value="full_day">Giornata Intera</option>
                    <option value="week">Settimanale</option>
                    <option value="custom">Personalizzato</option>
                  </select>
                </div>
              </div>

              {/* Prezzo per persona (solo per collettivi) */}
              {formData.service_type === 'collective' && (
                <div className="space-y-2 bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <Label htmlFor="price_per_person">Prezzo per Persona (€) *</Label>
                  <Input
                    id="price_per_person"
                    type="number"
                    step="0.01"
                    value={formData.price_per_person}
                    onChange={(e) => setFormData({ ...formData, price_per_person: e.target.value })}
                    placeholder="150.00"
                  />
                  <p className="text-xs text-purple-700">
                    💡 Il prezzo totale sarà calcolato: prezzo × numero passeggeri
                  </p>
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
                  Servizio Attivo
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.name}
              >
                {editingService ? 'Aggiorna' : 'Crea'}
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
            placeholder="Cerca per nome o descrizione..."
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Tutti i tipi</option>
            <option value="tour">Tour</option>
            <option value="collective">Collettivo</option>
            <option value="charter">Locazione</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      {/* Type Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setFilterType('all')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterType === 'all' 
              ? 'border-blue-600 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Totale</div>
          <div className="text-3xl font-bold text-gray-900">{typeCounts.total}</div>
        </button>

        <button
          onClick={() => setFilterType('tour')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterType === 'tour' 
              ? 'border-blue-600 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Tour</div>
          <div className="text-3xl font-bold text-blue-600">{typeCounts.tour}</div>
        </button>

        <button
          onClick={() => setFilterType('collective')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterType === 'collective' 
              ? 'border-purple-600 bg-purple-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Collettivo</div>
          <div className="text-3xl font-bold text-purple-600">{typeCounts.collective}</div>
        </button>

        <button
          onClick={() => setFilterType('charter')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterType === 'charter' 
              ? 'border-green-600 bg-green-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Locazione</div>
          <div className="text-3xl font-bold text-green-600">{typeCounts.charter}</div>
        </button>

        <button
          onClick={() => setFilterType('transfer')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filterType === 'transfer' 
              ? 'border-amber-600 bg-amber-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600">Transfer</div>
          <div className="text-3xl font-bold text-amber-600">{typeCounts.transfer}</div>
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nessun servizio trovato
          </div>
        ) : (
          filteredServices.map((service) => (
            <div key={service.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              {/* Image or Icon Header */}
              {(service as any).image_url ? (
                <div className="relative h-48">
                  <img 
                    src={(service as any).image_url} 
                    alt={service.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`h-32 ${getTypeColor(service.service_type)} bg-opacity-20 flex items-center justify-center`}>
                  {service.service_type === 'tour' && <Ship className="w-16 h-16 text-blue-600" />}
                  {service.service_type === 'collective' && <Users className="w-16 h-16 text-purple-600" />}
                  {service.service_type === 'charter' && <Ship className="w-16 h-16 text-green-600" />}
                  {service.service_type === 'transfer' && <Clock className="w-16 h-16 text-amber-600" />}
                </div>
              )}

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{service.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={`${getTypeColor(service.service_type)} font-semibold`}>
                        {getTypeLabel(service.service_type)}
                      </Badge>
                      {service.is_active ? (
                        <Badge className="bg-green-100 text-green-800 font-semibold">
                          Attivo
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 font-semibold">
                          Inattivo
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price per person (for collective) */}
                {service.service_type === 'collective' && (service as any).price_per_person && (
                  <div className="bg-purple-50 rounded-lg p-3 mb-3 border border-purple-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-purple-900 font-medium">Prezzo per Persona:</span>
                      <span className="text-lg font-bold text-purple-600">
                        €{(service as any).price_per_person}
                      </span>
                    </div>
                  </div>
                )}

                {service.duration && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <Clock className="w-4 h-4" />
                    <span>{getDurationLabel(service.duration)}</span>
                  </div>
                )}

                {service.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {service.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t">
                  <button
                    onClick={() => handleEdit(service)}
                    className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}