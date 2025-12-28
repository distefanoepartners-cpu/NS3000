'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2 } from 'lucide-react'

type Service = {
  id: string
  name: string
  type: string
  description: string | null
  base_price: number | null
  duration_hours: number | null
  is_active: boolean
  image_url: string | null
  price_per_person: number | null
  is_collective_tour: boolean
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
    base_price: '',
    duration_hours: '',
    is_active: true,
    is_collective_tour: false,
    price_per_person: ''
  })

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      const response = await fetch('/api/services')
      const data = await response.json()
      setServices(data)
    } catch (error) {
      console.error('Errore caricamento servizi:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      description: '',
      base_price: '',
      duration_hours: '',
      is_active: true,
      is_collective_tour: false,
      price_per_person: ''
    })
    setImageFile(null)
    setImagePreview(null)
    setEditingService(null)
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

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      type: service.type,
      description: service.description || '',
      base_price: service.base_price?.toString() || '',
      duration_hours: service.duration_hours?.toString() || '',
      is_active: service.is_active,
      is_collective_tour: service.is_collective_tour || false,
      price_per_person: service.price_per_person?.toString() || ''
    })
    setImagePreview(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      let imageUrl = editingService?.image_url || null

      if (imageFile) {
        const url = await uploadImage(imageFile, 'services')
        if (url) imageUrl = url
      }

      const payload = {
        name: formData.name,
        type: formData.type,
        description: formData.description || null,
        base_price: formData.base_price ? parseFloat(formData.base_price) : null,
        duration_hours: formData.duration_hours ? parseFloat(formData.duration_hours) : null,
        is_active: formData.is_active,
        is_collective_tour: formData.is_collective_tour,
        price_per_person: formData.price_per_person ? parseFloat(formData.price_per_person) : null,
        image_url: imageUrl
      }

      if (editingService) {
        await fetch(`/api/services/${editingService.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      setDialogOpen(false)
      resetForm()
      loadServices()
    } catch (error) {
      console.error('Errore salvataggio:', error)
      alert('Errore durante il salvataggio')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo servizio?')) return

    try {
      await fetch(`/api/services/${id}`, {
        method: 'DELETE'
      })
      loadServices()
    } catch (error) {
      console.error('Errore eliminazione:', error)
      alert('Errore durante l\'eliminazione')
    }
  }

  if (loading) {
    return <div>Caricamento...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestione Servizi</h1>
          <p className="text-gray-600 mt-1">Servizi e attività disponibili</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Servizio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingService ? 'Modifica Servizio' : 'Nuovo Servizio'}
              </DialogTitle>
              <DialogDescription>
                Inserisci i dati del servizio
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Es. Tour Capri"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo *</Label>
                  <Input
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="Es. Tour, Transfer"
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
                  <div className="mt-2">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-32 h-32 object-cover rounded border"
                    />
                  </div>
                )}
                {editingService?.image_url && !imagePreview && (
                  <div className="mt-2">
                    <img 
                      src={editingService.image_url} 
                      alt="Immagine corrente" 
                      className="w-32 h-32 object-cover rounded border"
                    />
                    <p className="text-sm text-gray-500 mt-1">Immagine corrente</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[100px]"
                  placeholder="Descrizione del servizio..."
                />
              </div>

              {/* Checkbox Tour Collettivo */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  id="is_collective_tour"
                  checked={formData.is_collective_tour}
                  onChange={(e) => setFormData({ ...formData, is_collective_tour: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_collective_tour" className="cursor-pointer font-medium">
                  👥 Tour Collettivo (prezzo a persona)
                </Label>
              </div>

              {/* Prezzi - Condizionali */}
              {formData.is_collective_tour ? (
                // Tour collettivo - Prezzo per persona
                <div className="space-y-2">
                  <Label htmlFor="price_per_person">Prezzo per Persona (€) *</Label>
                  <Input
                    id="price_per_person"
                    type="number"
                    step="0.01"
                    value={formData.price_per_person}
                    onChange={(e) => setFormData({ ...formData, price_per_person: e.target.value })}
                    placeholder="Es. 85.00"
                    className="bg-green-50"
                  />
                  <p className="text-sm text-gray-500">
                    Il prezzo finale sarà calcolato: prezzo × n° passeggeri
                  </p>
                </div>
              ) : (
                // Noleggio barca - Prezzo base e durata
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base_price">Prezzo Base (€)</Label>
                    <Input
                      id="base_price"
                      type="number"
                      step="0.01"
                      value={formData.base_price}
                      onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                      placeholder="Es. 450.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration_hours">Durata (ore)</Label>
                    <Input
                      id="duration_hours"
                      type="number"
                      step="0.5"
                      value={formData.duration_hours}
                      onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                      placeholder="Es. 4"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
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
                disabled={!formData.name || !formData.type}
              >
                {editingService ? 'Aggiorna' : 'Crea'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Servizi ({services.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Immagine</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Durata</TableHead>
                <TableHead>Modalità</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Nessun servizio presente. Clicca "Nuovo Servizio" per iniziare.
                  </TableCell>
                </TableRow>
              ) : (
                services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      {service.image_url ? (
                        <img 
                          src={service.image_url} 
                          alt={service.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                          No img
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>{service.type}</TableCell>
                    <TableCell>
                      {service.is_collective_tour && service.price_per_person
                        ? `€ ${service.price_per_person.toFixed(2)}/pax`
                        : service.base_price
                        ? `€ ${service.base_price.toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {service.duration_hours ? `${service.duration_hours}h` : '-'}
                    </TableCell>
                    <TableCell>
                      {service.is_collective_tour ? (
                        <Badge variant="outline" className="bg-green-50">
                          👥 Tour Collettivo
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          🚤 Noleggio
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={service.is_active ? 'default' : 'secondary'}>
                        {service.is_active ? 'Attivo' : 'Inattivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(service)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(service.id)}
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