'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Mail, Phone } from 'lucide-react'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadCustomers()
  }, [])

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

  async function handleDelete(customerId: string) {
    if (!confirm('Sei sicuro di voler eliminare questo cliente?')) {
      return
    }

    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Errore eliminazione')

      toast.success('Cliente eliminato!')
      loadCustomers()
    } catch (error: any) {
      console.error('Error deleting customer:', error)
      toast.error(error.message)
    }
  }

  const filteredCustomers = customers.filter((c) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      c.first_name?.toLowerCase().includes(searchLower) ||
      c.last_name?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower) ||
      c.phone?.toLowerCase().includes(searchLower)
    )
  })

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="text-gray-600">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-4 lg:p-8">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 md:mb-2">Clienti</h1>
          <p className="text-sm md:text-base text-gray-600">Gestisci i clienti</p>
        </div>
        <a
          href="/customers/new"
          className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm md:text-base text-center flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuovo Cliente
        </a>
      </div>

      {/* Search */}
      <div className="mb-4 md:mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca per nome, email o telefono..."
          className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base"
        />
      </div>

      {/* Mobile View - Cards */}
      <div className="md:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
            Nessun cliente trovato
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              {/* Header */}
              <div className="mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {customer.first_name} {customer.last_name}
                </h3>
              </div>

              {/* Info */}
              <div className="space-y-2 mb-3">
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="break-all">{customer.email}</span>
                  </a>
                )}
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                  >
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span>{customer.phone}</span>
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <a
                  href={`/customers/${customer.id}`}
                  className="flex-1 px-3 py-2 text-center text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Modifica
                </a>
                <button
                  onClick={() => handleDelete(customer.id)}
                  className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Telefono</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Nessun cliente trovato
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">
                        {customer.first_name} {customer.last_name}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {customer.email ? (
                        <a
                          href={`mailto:${customer.email}`}
                          className="text-sm text-blue-600 hover:text-blue-700 break-all"
                        >
                          {customer.email}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone}`}
                          className="text-sm text-gray-900 hover:text-blue-600"
                        >
                          {customer.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <a
                          href={`/customers/${customer.id}`}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Modifica
                        </a>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
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
    </div>
  )
}