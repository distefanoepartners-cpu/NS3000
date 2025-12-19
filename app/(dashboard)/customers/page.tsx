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
import { Plus, Pencil, Trash2, User } from 'lucide-react'

// ← TYPE DEFINITO QUI FUORI, NON DENTRO L'IMPORT
type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  document_type: string | null
  document_number: string | null
  document_expiry: string | null
  has_boat_license: boolean
  boat_license_number: string | null
  boat_license_expiry: string | null
  notes: string | null
  created_at: string
}
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
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
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/customers')
      const data = await response.json()
      setCustomers(data)
    } catch (error) {
      console.error('Errore caricamento clienti:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
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
    setEditingCustomer(null)
  }

  const handleNew = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email || '',
      phone: customer.phone || '',
      document_type: customer.document_type || 'Carta Identità',
      document_number: customer.document_number || '',
      document_expiry: customer.document_expiry || '',
      has_boat_license: customer.has_boat_license,
      boat_license_number: customer.boat_license_number || '',
      boat_license_expiry: customer.boat_license_expiry || '',
      notes: customer.notes || ''
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        document_expiry: formData.document_expiry || null,
        boat_license_expiry: formData.boat_license_expiry || null
      }

      if (editingCustomer) {
        await fetch(`/api/customers/${editingCustomer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      setDialogOpen(false)
      resetForm()
      loadCustomers()
    } catch (error) {
      console.error('Errore salvataggio:', error)
      alert('Errore durante il salvataggio')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo cliente?')) return

    try {
      await fetch(`/api/customers/${id}`, {
        method: 'DELETE'
      })
      loadCustomers()
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
          <h1 className="text-3xl font-bold">Gestione Clienti</h1>
          <p className="text-gray-600 mt-1">Anagrafica clienti con documenti</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? 'Modifica Cliente' : 'Nuovo Cliente'}
              </DialogTitle>
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
                    <Label htmlFor="first_name">Nome *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="Mario"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name">Cognome *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Rossi"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="mario.rossi@email.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                    <Label htmlFor="document_type">Tipo Documento</Label>
                    <select
                      id="document_type"
                      value={formData.document_type}
                      onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Carta Identità">Carta d'Identità</option>
                      <option value="Passaporto">Passaporto</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document_number">Numero Documento</Label>
                    <Input
                      id="document_number"
                      value={formData.document_number}
                      onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                      placeholder="ES1234567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document_expiry">Scadenza</Label>
                    <Input
                      id="document_expiry"
                      type="date"
                      value={formData.document_expiry}
                      onChange={(e) => setFormData({ ...formData, document_expiry: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Patente Nautica */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="has_boat_license"
                    checked={formData.has_boat_license}
                    onChange={(e) => setFormData({ ...formData, has_boat_license: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="has_boat_license" className="font-semibold cursor-pointer">
                    Possiede Patente Nautica
                  </Label>
                </div>

                {formData.has_boat_license && (
                  <div className="grid grid-cols-2 gap-4 pl-7">
                    <div className="space-y-2">
                      <Label htmlFor="boat_license_number">Numero Patente</Label>
                      <Input
                        id="boat_license_number"
                        value={formData.boat_license_number}
                        onChange={(e) => setFormData({ ...formData, boat_license_number: e.target.value })}
                        placeholder="PN123456"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="boat_license_expiry">Scadenza</Label>
                      <Input
                        id="boat_license_expiry"
                        type="date"
                        value={formData.boat_license_expiry}
                        onChange={(e) => setFormData({ ...formData, boat_license_expiry: e.target.value })}
                      />
                    </div>
                  </div>
                )}
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
              <Button onClick={handleSave} disabled={!formData.first_name || !formData.last_name}>
                {editingCustomer ? 'Aggiorna' : 'Crea'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Clienti ({customers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Completo</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Patente Nautica</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Nessun cliente presente. Clicca "Nuovo Cliente" per iniziare.
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.first_name} {customer.last_name}
                    </TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell>
                      {customer.document_number ? (
                        <div className="text-sm">
                          <div>{customer.document_type}</div>
                          <div className="text-gray-500">{customer.document_number}</div>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.has_boat_license ? 'default' : 'secondary'}>
                        {customer.has_boat_license ? 'Sì' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer.id)}
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