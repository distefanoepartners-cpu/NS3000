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

type Boat = {
  id: string
  name: string
  boat_type: string
  capacity: number | null
  length: number | null
  engine_power: number | null
  fuel_type: string | null
  year: number | null
  registration_number: string | null
  is_active: boolean
  notes: string | null
  image_url: string | null
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
}

export default function BoatsPage() {
  const [boats, setBoats] = useState<Boat[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBoat, setEditingBoat] = useState<Boat | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    boat_type: '',
    capacity: '',
    length: '',
    engine_power: '',
    fuel_type: '',
    year: '',
    registration_number: '',
    is_active: true,
    notes: '',
    // Prezzi stagionali
    price_low_season_half_day: '',
    price_low_season_full_day: '',
    price_low_season_week: '',
    price_july_half_day: '',
    price_july_full_day: '',
    price_july_week: '',
    price_august_half_day: '',
    price_august_full_day: '',
    price_august_week: '',
    price_september_half_day: '',
    price_september_full_day: '',
    price_september_week: ''
  })

  useEffect(() => {
    loadBoats()
  }, [])

  const loadBoats = async () => {
    try {
      const response = await fetch('/api/boats')
      const data = await response.json()
      setBoats(data)
    } catch (error) {
      console.error('Errore caricamento barche:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      boat_type: '',
      capacity: '',
      length: '',
      engine_power: '',
      fuel_type: '',
      year: '',
      registration_number: '',
      is_active: true,
      notes: '',
      price_low_season_half_day: '',
      price_low_season_full_day: '',
      price_low_season_week: '',
      price_july_half_day: '',
      price_july_full_day: '',
      price_july_week: '',
      price_august_half_day: '',
      price_august_full_day: '',
      price_august_week: '',
      price_september_half_day: '',
      price_september_full_day: '',
      price_september_week: ''
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
      capacity: boat.capacity?.toString() || '',
      length: boat.length?.toString() || '',
      engine_power: boat.engine_power?.toString() || '',
      fuel_type: boat.fuel_type || '',
      year: boat.year?.toString() || '',
      registration_number: boat.registration_number || '',
      is_active: boat.is_active,
      notes: boat.notes || '',
      price_low_season_half_day: boat.price_low_season_half_day?.toString() || '',
      price_low_season_full_day: boat.price_low_season_full_day?.toString() || '',
      price_low_season_week: boat.price_low_season_week?.toString() || '',
      price_july_half_day: boat.price_july_half_day?.toString() || '',
      price_july_full_day: boat.price_july_full_day?.toString() || '',
      price_july_week: boat.price_july_week?.toString() || '',
      price_august_half_day: boat.price_august_half_day?.toString() || '',
      price_august_full_day: boat.price_august_full_day?.toString() || '',
      price_august_week: boat.price_august_week?.toString() || '',
      price_september_half_day: boat.price_september_half_day?.toString() || '',
      price_september_full_day: boat.price_september_full_day?.toString() || '',
      price_september_week: boat.price_september_week?.toString() || ''
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
        max_passengers: formData.capacity ? parseInt(formData.capacity) : null,
        length_meters: formData.length ? parseFloat(formData.length) : null,
        registration_number: formData.registration_number || null,
        is_active: formData.is_active,
        description: formData.notes || null,
        image_url: imageUrl,
        technical_specs: {
          engine_power: formData.engine_power ? parseInt(formData.engine_power) : null,
          fuel_type: formData.fuel_type || null,
          year: formData.year ? parseInt(formData.year) : null
        },
        // Prezzi stagionali
        price_low_season_half_day: formData.price_low_season_half_day ? parseFloat(formData.price_low_season_half_day) : null,
        price_low_season_full_day: formData.price_low_season_full_day ? parseFloat(formData.price_low_season_full_day) : null,
        price_low_season_week: formData.price_low_season_week ? parseFloat(formData.price_low_season_week) : null,
        price_july_half_day: formData.price_july_half_day ? parseFloat(formData.price_july_half_day) : null,
        price_july_full_day: formData.price_july_full_day ? parseFloat(formData.price_july_full_day) : null,
        price_july_week: formData.price_july_week ? parseFloat(formData.price_july_week) : null,
        price_august_half_day: formData.price_august_half_day ? parseFloat(formData.price_august_half_day) : null,
        price_august_full_day: formData.price_august_full_day ? parseFloat(formData.price_august_full_day) : null,
        price_august_week: formData.price_august_week ? parseFloat(formData.price_august_week) : null,
        price_september_half_day: formData.price_september_half_day ? parseFloat(formData.price_september_half_day) : null,
        price_september_full_day: formData.price_september_full_day ? parseFloat(formData.price_september_full_day) : null,
        price_september_week: formData.price_september_week ? parseFloat(formData.price_september_week) : null
      }

      if (editingBoat) {
        await fetch(`/api/boats/${editingBoat.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        await fetch('/api/boats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      setDialogOpen(false)
      resetForm()
      loadBoats()
    } catch (error) {
      console.error('Errore salvataggio:', error)
      alert('Errore durante il salvataggio')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa barca?')) return

    try {
      await fetch(`/api/boats/${id}`, {
        method: 'DELETE'
      })
      loadBoats()
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
          <h1 className="text-3xl font-bold">Gestione Barche</h1>
          <p className="text-gray-600 mt-1">Flotta e imbarcazioni disponibili</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nuova Barca
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBoat ? 'Modifica Barca' : 'Nuova Barca'}
              </DialogTitle>
              <DialogDescription>
                Inserisci i dati dell'imbarcazione
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
                {editingBoat?.image_url && !imagePreview && (
                  <div className="mt-2">
                    <img 
                      src={editingBoat.image_url} 
                      alt="Immagine corrente" 
                      className="w-32 h-32 object-cover rounded border"
                    />
                    <p className="text-sm text-gray-500 mt-1">Immagine corrente</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                  <Label htmlFor="length">Lunghezza (m)</Label>
                  <Input
                    id="length"
                    type="number"
                    step="0.1"
                    value={formData.length}
                    onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                    placeholder="Es. 7.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="engine_power">Potenza (HP)</Label>
                  <Input
                    id="engine_power"
                    type="number"
                    value={formData.engine_power}
                    onChange={(e) => setFormData({ ...formData, engine_power: e.target.value })}
                    placeholder="Es. 150"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fuel_type">Carburante</Label>
                  <Input
                    id="fuel_type"
                    value={formData.fuel_type}
                    onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    placeholder="Es. Benzina"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Anno</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="Es. 2020"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration_number">Matricola</Label>
                  <Input
                    id="registration_number"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    placeholder="Es. SA-1234"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[80px]"
                  placeholder="Note aggiuntive..."
                />
              </div>

              {/* LISTINO PREZZI STAGIONALI */}
              <div className="col-span-2 border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>💰</span> Listino Prezzi Stagionali
                </h3>
                
                {/* Bassa Stagione */}
                <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 text-blue-900">🌸 Bassa Stagione (Apr-Mag-Giu)</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Mezza Giornata (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="500.00"
                        value={formData.price_low_season_half_day}
                        onChange={(e) => setFormData({ ...formData, price_low_season_half_day: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Giornata Intera (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="800.00"
                        value={formData.price_low_season_full_day}
                        onChange={(e) => setFormData({ ...formData, price_low_season_full_day: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Settimanale (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="4500.00"
                        value={formData.price_low_season_week}
                        onChange={(e) => setFormData({ ...formData, price_low_season_week: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Luglio */}
                <div className="mb-6 bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 text-yellow-900">☀️ Luglio</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Mezza Giornata (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="700.00"
                        value={formData.price_july_half_day}
                        onChange={(e) => setFormData({ ...formData, price_july_half_day: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Giornata Intera (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1200.00"
                        value={formData.price_july_full_day}
                        onChange={(e) => setFormData({ ...formData, price_july_full_day: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Settimanale (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="7000.00"
                        value={formData.price_july_week}
                        onChange={(e) => setFormData({ ...formData, price_july_week: e.target.value })}
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
                        placeholder="800.00"
                        value={formData.price_august_half_day}
                        onChange={(e) => setFormData({ ...formData, price_august_half_day: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Giornata Intera (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1400.00"
                        value={formData.price_august_full_day}
                        onChange={(e) => setFormData({ ...formData, price_august_full_day: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Settimanale (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="8000.00"
                        value={formData.price_august_week}
                        onChange={(e) => setFormData({ ...formData, price_august_week: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Settembre */}
                <div className="mb-6 bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 text-green-900">🍂 Settembre</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Mezza Giornata (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="600.00"
                        value={formData.price_september_half_day}
                        onChange={(e) => setFormData({ ...formData, price_september_half_day: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Giornata Intera (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1000.00"
                        value={formData.price_september_full_day}
                        onChange={(e) => setFormData({ ...formData, price_september_full_day: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Settimanale (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="5500.00"
                        value={formData.price_september_week}
                        onChange={(e) => setFormData({ ...formData, price_september_week: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
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

      <Card>
        <CardHeader>
          <CardTitle>Flotta ({boats.length} imbarcazioni)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Immagine</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Capacità</TableHead>
                <TableHead>Lunghezza</TableHead>
                <TableHead>Potenza</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Nessuna barca presente. Clicca "Nuova Barca" per iniziare.
                  </TableCell>
                </TableRow>
              ) : (
                boats.map((boat) => (
                  <TableRow key={boat.id}>
                    <TableCell>
                      {boat.image_url ? (
                        <img 
                          src={boat.image_url} 
                          alt={boat.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                          No img
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{boat.name}</TableCell>
                    <TableCell>{boat.boat_type}</TableCell>
                    <TableCell>{boat.capacity ? `${boat.capacity} pax` : '-'}</TableCell>
                    <TableCell>{boat.length ? `${boat.length}m` : '-'}</TableCell>
                    <TableCell>{boat.engine_power ? `${boat.engine_power} HP` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={boat.is_active ? 'default' : 'secondary'}>
                        {boat.is_active ? 'Attiva' : 'Inattiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(boat)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(boat.id)}
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