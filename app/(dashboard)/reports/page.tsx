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
import { Plus, Eye, Send, CheckCircle, Trash2, FileText } from 'lucide-react'

type Supplier = {
  id: string
  name: string
  commission_percentage: number
}

type Statement = {
  id: string
  statement_number: string
  supplier: { name: string; commission_percentage: number; email: string | null }
  period_start: string
  period_end: string
  total_bookings: number
  total_revenue: number
  total_commission: number
  status: string
  generated_at: string
  sent_at: string | null
  paid_at: string | null
}

type Booking = {
  id: string
  booking_number: string
  booking_date: string
  final_price: number
  customer: { first_name: string; last_name: string }
  service: { name: string }
  boat: { name: string }
  booking_status: { name: string; code: string }
}

export default function ReportsPage() {
  const [statements, setStatements] = useState<Statement[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedStatement, setSelectedStatement] = useState<any>(null)
  const [formData, setFormData] = useState({
    supplier_id: '',
    period_start: '',
    period_end: ''
  })

  useEffect(() => {
    loadStatements()
    loadSuppliers()
  }, [])

  const loadStatements = async () => {
    try {
      const response = await fetch('/api/reports/suppliers')
      const data = await response.json()
      setStatements(data)
    } catch (error) {
      console.error('Errore caricamento estratti conto:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      const data = await response.json()
      setSuppliers(data.filter((s: any) => s.is_active))
    } catch (error) {
      console.error('Errore caricamento fornitori:', error)
    }
  }

  const handleGenerate = async () => {
    if (!formData.supplier_id || !formData.period_start || !formData.period_end) {
      alert('Compila tutti i campi')
      return
    }

    try {
      const response = await fetch('/api/reports/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Errore durante la generazione')
        return
      }

      setDialogOpen(false)
      setFormData({ supplier_id: '', period_start: '', period_end: '' })
      loadStatements()
      alert('Estratto conto generato con successo!')
    } catch (error) {
      console.error('Errore generazione:', error)
      alert('Errore durante la generazione')
    }
  }

  const handleViewDetail = async (statementId: string) => {
    try {
      const response = await fetch(`/api/reports/suppliers/${statementId}`)
      const data = await response.json()
      setSelectedStatement(data)
      setDetailDialogOpen(true)
    } catch (error) {
      console.error('Errore caricamento dettaglio:', error)
      alert('Errore durante il caricamento')
    }
  }

  const handleUpdateStatus = async (statementId: string, status: string) => {
    if (!confirm(`Confermi di voler marcare come "${status}"?`)) return

    try {
      await fetch(`/api/reports/suppliers/${statementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      loadStatements()
      alert('Stato aggiornato!')
    } catch (error) {
      console.error('Errore aggiornamento:', error)
      alert('Errore durante l\'aggiornamento')
    }
  }

  const handleDelete = async (statementId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo estratto conto?')) return

    try {
      await fetch(`/api/reports/suppliers/${statementId}`, {
        method: 'DELETE'
      })
      loadStatements()
    } catch (error) {
      console.error('Errore eliminazione:', error)
      alert('Errore durante l\'eliminazione')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Bozza', variant: 'secondary' },
      sent: { label: 'Inviato', variant: 'default' },
      paid: { label: 'Pagato', variant: 'outline' }
    }
    const config = variants[status] || { label: status, variant: 'secondary' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (loading) {
    return <div>Caricamento...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Estratti Conto Fornitori</h1>
          <p className="text-gray-600 mt-1">Calcolo automatico provvigioni</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Genera Estratto Conto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Genera Nuovo Estratto Conto</DialogTitle>
              <DialogDescription>
                Seleziona fornitore e periodo per calcolare le provvigioni
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_id">Fornitore *</Label>
                <select
                  id="supplier_id"
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Seleziona fornitore...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.commission_percentage}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period_start">Data Inizio *</Label>
                  <Input
                    id="period_start"
                    type="date"
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period_end">Data Fine *</Label>
                  <Input
                    id="period_end"
                    type="date"
                    value={formData.period_end}
                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleGenerate}>
                Genera
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Estratti Conto ({statements.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Prenotazioni</TableHead>
                <TableHead>Fatturato</TableHead>
                <TableHead>Provvigione</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Nessun estratto conto generato. Clicca "Genera Estratto Conto" per iniziare.
                  </TableCell>
                </TableRow>
              ) : (
                statements.map((statement) => (
                  <TableRow key={statement.id}>
                    <TableCell className="font-medium">{statement.statement_number}</TableCell>
                    <TableCell>
                      <div>{statement.supplier.name}</div>
                      <div className="text-xs text-gray-500">
                        {statement.supplier.commission_percentage}% provvigione
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(statement.period_start).toLocaleDateString('it-IT')}
                        {' - '}
                        {new Date(statement.period_end).toLocaleDateString('it-IT')}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {statement.total_bookings}
                    </TableCell>
                    <TableCell className="font-semibold text-blue-600">
                      € {statement.total_revenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-bold text-green-600">
                      € {statement.total_commission.toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(statement.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(statement.id)}
                          title="Visualizza dettaglio"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {statement.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(statement.id, 'sent')}
                            title="Marca come inviato"
                          >
                            <Send className="h-4 w-4 text-blue-500" />
                          </Button>
                        )}
                        {statement.status === 'sent' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(statement.id, 'paid')}
                            title="Marca come pagato"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(statement.id)}
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

      {/* Dialog Dettaglio */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dettaglio Estratto Conto</DialogTitle>
          </DialogHeader>

          {selectedStatement && (
            <div className="space-y-6">
              {/* Header */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                <div>
                  <div className="text-sm text-gray-600">Fornitore</div>
                  <div className="font-semibold">{selectedStatement.statement.supplier.name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Periodo</div>
                  <div className="font-semibold">
                    {new Date(selectedStatement.statement.period_start).toLocaleDateString('it-IT')}
                    {' - '}
                    {new Date(selectedStatement.statement.period_end).toLocaleDateString('it-IT')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Totale Fatturato</div>
                  <div className="text-xl font-bold text-blue-600">
                    € {selectedStatement.statement.total_revenue.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">
                    Provvigione ({selectedStatement.statement.supplier.commission_percentage}%)
                  </div>
                  <div className="text-xl font-bold text-green-600">
                    € {selectedStatement.statement.total_commission.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Elenco Prenotazioni */}
              <div>
                <h3 className="font-semibold mb-3">
                  Prenotazioni ({selectedStatement.bookings.length})
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Servizio</TableHead>
                      <TableHead>Barca</TableHead>
                      <TableHead className="text-right">Importo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedStatement.bookings.map((booking: Booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.booking_number}</TableCell>
                        <TableCell>
                          {new Date(booking.booking_date).toLocaleDateString('it-IT')}
                        </TableCell>
                        <TableCell>
                          {booking.customer.first_name} {booking.customer.last_name}
                        </TableCell>
                        <TableCell>{booking.service.name}</TableCell>
                        <TableCell>{booking.boat.name}</TableCell>
                        <TableCell className="text-right font-semibold">
                          € {booking.final_price.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setDetailDialogOpen(false)}>
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}