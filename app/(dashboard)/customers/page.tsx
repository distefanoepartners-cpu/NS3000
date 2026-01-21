'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Pencil, Trash2, Upload, Download } from 'lucide-react'
import { toast } from 'sonner'
import CreateCustomerModal from '@/components/CreateCustomerModal'

type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  nationality: string | null
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
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [customers, searchTerm])

  async function loadCustomers() {
    try {
      setLoading(true)
      const res = await fetch('/api/customers')
      const data = await res.json()
      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Errore caricamento clienti')
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...customers]

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.first_name?.toLowerCase().includes(term) ||
        c.last_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.nationality?.toLowerCase().includes(term)
      )
    }

    setFilteredCustomers(filtered)
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo cliente?')) return

    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      toast.success('Cliente eliminato!')
      loadCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error('Errore eliminazione')
    }
  }

  // Import CSV/Excel
  async function handleImport() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setImporting(true)
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/customers/import', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Errore importazione')
      }

      toast.success(`${data.imported} clienti importati con successo!`)
      loadCustomers()
    } catch (error: any) {
      console.error('Error importing:', error)
      toast.error(error.message || 'Errore durante l\'importazione')
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Export CSV
  async function handleExport(mode: 'full' | 'marketing', year?: string) {
    try {
      const params = new URLSearchParams({ mode })
      if (year) params.append('year', year)

      const res = await fetch(`/api/customers/export?${params}`)
      
      if (!res.ok) {
        throw new Error('Errore durante l\'esportazione')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clienti_${mode}_${year || 'tutti'}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Export completato!')
    } catch (error: any) {
      console.error('Error exporting:', error)
      toast.error(error.message || 'Errore durante l\'esportazione')
    }
  }

  const stats = {
    total: customers.length,
    withEmail: customers.filter(c => c.email).length,
    withPhone: customers.filter(c => c.phone).length,
    withLicense: customers.filter(c => c.has_boat_license).length,
  }

  if (loading) {
    return <div className="p-8">Caricamento...</div>
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Clienti</h1>
          <p className="text-gray-600 mt-1">Gestione anagrafica clienti</p>
        </div>
        <div className="flex gap-2">
          {/* Import Button */}
          <Button
            onClick={handleImport}
            variant="outline"
            disabled={importing}
            className="whitespace-nowrap"
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? 'Importazione...' : 'Importa CSV'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            onChange={handleFileSelected}
            className="hidden"
          />

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="whitespace-nowrap">
                <Download className="mr-2 h-4 w-4" />
                Esporta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleExport('full')}>
                📊 Export Completo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('marketing')}>
                📧 Solo Contatti (Marketing)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('full', '2025')}>
                📅 Solo 2025 (Completo)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('marketing', '2025')}>
                📧 Solo 2025 (Marketing)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* New Customer Button */}
          <Button onClick={() => setShowCreateModal(true)} className="whitespace-nowrap">
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Cliente
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cerca per nome, email, telefono, nazionalità..."
          className="max-w-md"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-600">Totale Clienti</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-600">Con Email</div>
          <div className="text-3xl font-bold text-blue-600">{stats.withEmail}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-600">Con Telefono</div>
          <div className="text-3xl font-bold text-green-600">{stats.withPhone}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-600">Con Patente</div>
          <div className="text-3xl font-bold text-purple-600">{stats.withLicense}</div>
        </div>
      </div>

      {/* Table - Responsive */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase whitespace-nowrap">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase whitespace-nowrap">Cognome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase whitespace-nowrap">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase whitespace-nowrap">Telefono</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase whitespace-nowrap">Nazionalità</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase whitespace-nowrap">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase whitespace-nowrap">Patente</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase whitespace-nowrap">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Nessun cliente trovato
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[120px] truncate">
                      {customer.first_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[120px] truncate">
                      {customer.last_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                      {customer.email || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px]">
                      {customer.phone || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[100px] truncate">
                      {customer.nationality || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px]">
                      {customer.document_type && customer.document_number ? (
                        <div>
                          <div className="font-medium">{customer.document_type}</div>
                          <div className="text-xs">{customer.document_number}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                      {customer.has_boat_license ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Sì
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingCustomer(customer)
                            setShowCreateModal(true)
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totale Risultati */}
      <div className="text-center text-sm text-gray-600">
        Visualizzati {filteredCustomers.length} di {customers.length} clienti
      </div>

      {/* Create/Edit Modal */}
      <CreateCustomerModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setEditingCustomer(null)
        }}
        onCustomerCreated={() => {
          loadCustomers()
        }}
        customer={editingCustomer}
      />
    </div>
  )
}