'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadServices()
  }, [])

  async function loadServices() {
    try {
      setLoading(true)
      const res = await fetch('/api/services')
      const data = await res.json()
      setServices(data || [])
    } catch (error) {
      console.error('Error loading services:', error)
      toast.error('Errore caricamento servizi')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(serviceId: string) {
    if (!confirm('Sei sicuro di voler eliminare questo servizio?')) {
      return
    }

    try {
      const res = await fetch(`/api/services/${serviceId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Errore eliminazione')

      toast.success('Servizio eliminato!')
      loadServices()
    } catch (error: any) {
      console.error('Error deleting service:', error)
      toast.error(error.message)
    }
  }

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
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 md:mb-2">Servizi</h1>
          <p className="text-sm md:text-base text-gray-600">Gestisci i servizi offerti</p>
        </div>
        <a
          href="/services/new"
          className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm md:text-base text-center flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuovo Servizio
        </a>
      </div>

      {/* Mobile View - Cards */}
      <div className="md:hidden space-y-3">
        {services.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
            Nessun servizio trovato
          </div>
        ) : (
          services.map((service) => (
            <div key={service.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              {/* Header */}
              <div className="mb-3">
                <h3 className="text-lg font-bold text-gray-900">{service.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    service.type === 'rental' ? 'bg-blue-100 text-blue-800' :
                    service.type === 'charter' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {service.type === 'rental' ? 'Noleggio' :
                     service.type === 'charter' ? 'Locazione' :
                     service.type}
                  </span>
                  {service.is_active && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                      Attivo
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {service.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {service.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <a
                  href={`/services/${service.id}`}
                  className="flex-1 px-3 py-2 text-center text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Modifica
                </a>
                <button
                  onClick={() => handleDelete(service.id)}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Descrizione</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Stato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Nessun servizio trovato
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{service.name}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        service.type === 'rental' ? 'bg-blue-100 text-blue-800' :
                        service.type === 'charter' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {service.type === 'rental' ? 'Noleggio' :
                         service.type === 'charter' ? 'Locazione' :
                         service.type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-600 max-w-md truncate">
                        {service.description || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        service.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {service.is_active ? 'Attivo' : 'Inattivo'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <a
                          href={`/services/${service.id}`}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Modifica
                        </a>
                        <button
                          onClick={() => handleDelete(service.id)}
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