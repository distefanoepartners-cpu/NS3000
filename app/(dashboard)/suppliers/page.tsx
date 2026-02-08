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
import { Plus, Pencil, Trash2, Building2, KeyRound, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

type Supplier = {
  id: string
  name: string
  type: string | null
  commission_percentage: number
  contact_person: string | null
  email: string | null
  phone: string | null
  notes: string | null
  is_active: boolean
  is_partner: boolean
  partner_code: string | null
  // Dati fiscali
  business_name: string | null
  vat_number: string | null
  fiscal_code: string | null
  sdi_code: string | null
  pec_email: string | null
  // Indirizzo
  address: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country: string | null
  iban: string | null
  created_at: string
  updated_at: string
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [selectedSupplierForPartner, setSelectedSupplierForPartner] = useState<Supplier | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'Hotel',
    commission_percentage: '15',
    contact_person: '',
    email: '',
    phone: '',
    notes: '',
    // Dati fiscali
    business_name: '',
    vat_number: '',
    fiscal_code: '',
    sdi_code: '',
    pec_email: '',
    // Indirizzo
    address: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'Italia',
    iban: '',
  })

  const [partnerFormData, setPartnerFormData] = useState({
    email: '',
    password: '',
    full_name: '',
  })

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      const data = await response.json()
      setSuppliers(data)
    } catch (error) {
      console.error('Errore caricamento fornitori:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'Hotel',
      commission_percentage: '15',
      contact_person: '',
      email: '',
      phone: '',
      notes: '',
      business_name: '',
      vat_number: '',
      fiscal_code: '',
      sdi_code: '',
      pec_email: '',
      address: '',
      city: '',
      province: '',
      postal_code: '',
      country: 'Italia',
      iban: '',
    })
    setEditingSupplier(null)
  }

  const handleNew = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      type: supplier.type || 'Hotel',
      commission_percentage: supplier.commission_percentage?.toString() || '15',
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      notes: supplier.notes || '',
      business_name: supplier.business_name || '',
      vat_number: supplier.vat_number || '',
      fiscal_code: supplier.fiscal_code || '',
      sdi_code: supplier.sdi_code || '',
      pec_email: supplier.pec_email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      province: supplier.province || '',
      postal_code: supplier.postal_code || '',
      country: supplier.country || 'Italia',
      iban: supplier.iban || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        commission_percentage: parseFloat(formData.commission_percentage) || 0,
        is_active: true
      }

      if (editingSupplier) {
        await fetch(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        toast.success('Fornitore aggiornato!')
      } else {
        await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        toast.success('Fornitore creato!')
      }

      setDialogOpen(false)
      resetForm()
      loadSuppliers()
    } catch (error) {
      console.error('Errore salvataggio:', error)
      toast.error('Errore durante il salvataggio')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo fornitore?')) return

    try {
      await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
      toast.success('Fornitore eliminato')
      loadSuppliers()
    } catch (error) {
      console.error('Errore eliminazione:', error)
      toast.error('Errore durante l\'eliminazione')
    }
  }

  // ⭐ Crea account partner
  const handleCreatePartnerAccount = async () => {
    if (!selectedSupplierForPartner) return

    try {
      const res = await fetch('/api/partners/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplierForPartner.id,
          email: partnerFormData.email,
          password: partnerFormData.password,
          full_name: partnerFormData.full_name || selectedSupplierForPartner.name,
        })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Errore creazione account')
        return
      }

      toast.success(`Account partner creato! Codice: ${data.partner_code}`)
      setPartnerDialogOpen(false)
      setPartnerFormData({ email: '', password: '', full_name: '' })
      loadSuppliers()
    } catch (error: any) {
      toast.error('Errore: ' + error.message)
    }
  }

  const openPartnerDialog = (supplier: Supplier) => {
    setSelectedSupplierForPartner(supplier)
    setPartnerFormData({
      email: supplier.email || '',
      password: '',
      full_name: supplier.contact_person || supplier.name,
    })
    setPartnerDialogOpen(true)
  }

  if (loading) {
    return <div className="p-8">Caricamento...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestione Fornitori & Partner</h1>
          <p className="text-gray-600 mt-1">Canali di provenienza prenotazioni e strutture affiliate</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Fornitore
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Totale Fornitori</div>
            <div className="text-2xl font-bold">{suppliers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Partner Attivi</div>
            <div className="text-2xl font-bold text-emerald-600">
              {suppliers.filter(s => s.is_partner && s.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Hotel</div>
            <div className="text-2xl font-bold text-blue-600">
              {suppliers.filter(s => s.type === 'Hotel').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Commissione media</div>
            <div className="text-2xl font-bold text-purple-600">
              {suppliers.length > 0
                ? (suppliers.reduce((s, x) => s + (x.commission_percentage || 0), 0) / suppliers.length).toFixed(0)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabella */}
      <Card>
        <CardHeader>
          <CardTitle>Elenco Fornitori ({suppliers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Nome / Ragione Sociale</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Provvigione</TableHead>
                <TableHead>P.IVA</TableHead>
                <TableHead>Contatti</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Nessun fornitore presente.
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      {supplier.partner_code ? (
                        <span className="font-mono text-sm font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {supplier.partner_code}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{supplier.name}</div>
                      {supplier.business_name && supplier.business_name !== supplier.name && (
                        <div className="text-xs text-gray-500">{supplier.business_name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{supplier.type || '-'}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-blue-600">
                      {supplier.commission_percentage}%
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">{supplier.vat_number || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {supplier.contact_person && <div className="font-medium">{supplier.contact_person}</div>}
                        {supplier.email && <div className="text-gray-500">{supplier.email}</div>}
                        {supplier.phone && <div className="text-gray-500">{supplier.phone}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                          {supplier.is_active ? 'Attivo' : 'Non attivo'}
                        </Badge>
                        {supplier.is_partner && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">
                            🔑 Partner
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Crea Account Partner */}
                        {!supplier.is_partner && supplier.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPartnerDialog(supplier)}
                            title="Crea account partner"
                          >
                            <UserPlus className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(supplier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(supplier.id)}>
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

      {/* ====== DIALOG MODIFICA/CREA FORNITORE ====== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
            </DialogTitle>
            <DialogDescription>
              Anagrafica completa del fornitore/partner
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sezione 1: Dati principali */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Dati Principali</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Struttura *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Es. Hotel Vittoria"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo Canale</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="Hotel">Hotel</option>
                    <option value="B&B">B&B</option>
                    <option value="Resort">Resort</option>
                    <option value="Agenzia">Agenzia Viaggi</option>
                    <option value="Tour Operator">Tour Operator</option>
                    <option value="Box Porto Masuccio">Box Porto Masuccio</option>
                    <option value="Online">Online</option>
                    <option value="Piattaforma">Piattaforma</option>
                    <option value="Altro">Altro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Referente</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Nome referente"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contatto@hotel.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+39 089 123456"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="commission_percentage">Percentuale Provvigione (%)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="commission_percentage"
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.commission_percentage}
                    onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                    className="w-32"
                  />
                  <span className="text-sm text-gray-500">
                    Percentuale riconosciuta al partner sulle prenotazioni
                  </span>
                </div>
              </div>
            </div>

            {/* Sezione 2: Dati Fiscali */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Dati Fiscali</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business_name">Ragione Sociale</Label>
                  <Input
                    id="business_name"
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder="Ragione sociale completa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_number">Partita IVA</Label>
                  <Input
                    id="vat_number"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                    placeholder="IT12345678901"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="fiscal_code">Codice Fiscale</Label>
                  <Input
                    id="fiscal_code"
                    value={formData.fiscal_code}
                    onChange={(e) => setFormData({ ...formData, fiscal_code: e.target.value })}
                    placeholder="RSSMRA85..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sdi_code">Codice SDI</Label>
                  <Input
                    id="sdi_code"
                    value={formData.sdi_code}
                    onChange={(e) => setFormData({ ...formData, sdi_code: e.target.value })}
                    placeholder="0000000"
                    maxLength={7}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pec_email">PEC</Label>
                  <Input
                    id="pec_email"
                    type="email"
                    value={formData.pec_email}
                    onChange={(e) => setFormData({ ...formData, pec_email: e.target.value })}
                    placeholder="hotel@pec.it"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  placeholder="IT60X0542811101000000123456"
                  maxLength={34}
                />
              </div>
            </div>

            {/* Sezione 3: Indirizzo */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Indirizzo</h3>
              <div className="space-y-2 mb-4">
                <Label htmlFor="address">Indirizzo</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Via Roma 1"
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="city">Città</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Salerno"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Prov.</Label>
                  <Input
                    id="province"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    placeholder="SA"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">CAP</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="84100"
                    maxLength={5}
                  />
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="border-t pt-4">
              <Label htmlFor="notes">Note</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[80px] mt-2"
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={!formData.name}>
              {editingSupplier ? 'Aggiorna' : 'Crea'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== DIALOG CREA ACCOUNT PARTNER ====== */}
      <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              Crea Account Partner
            </DialogTitle>
            <DialogDescription>
              Crea le credenziali di accesso al backoffice per <strong>{selectedSupplierForPartner?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              <strong>ℹ️ Info:</strong> Il partner potrà accedere al gestionale per creare prenotazioni per i propri clienti.
              Vedrà solo le sue prenotazioni e la commissione del <strong>{selectedSupplierForPartner?.commission_percentage}%</strong> non sarà modificabile.
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-name">Nome visualizzato</Label>
              <Input
                id="partner-name"
                value={partnerFormData.full_name}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, full_name: e.target.value })}
                placeholder={selectedSupplierForPartner?.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-email">Email di accesso *</Label>
              <Input
                id="partner-email"
                type="email"
                value={partnerFormData.email}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, email: e.target.value })}
                placeholder="partner@hotel.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-password">Password *</Label>
              <Input
                id="partner-password"
                type="text"
                value={partnerFormData.password}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, password: e.target.value })}
                placeholder="Minimo 8 caratteri"
              />
              <p className="text-xs text-gray-500">
                La password sarà visibile solo ora. Comunicala al partner in modo sicuro.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPartnerDialogOpen(false)}>Annulla</Button>
            <Button
              onClick={handleCreatePartnerAccount}
              disabled={!partnerFormData.email || !partnerFormData.password || partnerFormData.password.length < 8}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Crea Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}