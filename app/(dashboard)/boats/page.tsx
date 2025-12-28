'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function BoatsPage() {
  const [boats, setBoats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBoats()
  }, [])

  async function loadBoats() {
    try {
      setLoading(true)
      const res = await fetch('/api/boats')
      const data = await res.json()
      setBoats(data || [])
    } catch (error) {
      console.error('Error loading boats:', error)
      toast.error('Errore caricamento barche')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(boatId: string) {
    if (!confirm('Sei sicuro di voler eliminare questa barca?')) {
      return
    }

    try {
      const res = await fetch(`/api/boats/${boatId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Errore eliminazione')

      toast.success('Barca eliminata!')
      loadBoats()
    } catch (error: any) {
      console.error('Error deleting boat:', error)
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
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 md:mb-2">Barche</h1>
          <p className="text-sm md:text-base text-gray-600">Gestisci la flotta</p>
        </div>
        <a
          href="/boats/new"
          className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm md:text-base text-center flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuova Barca
        </a>
      </div>

      {/* Mobile View - Cards */}
      <div className="md:hidden space-y-3">
        {boats.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
            Nessuna barca trovata
          </div>
        ) : (
          boats.map((boat) => (
            <div key={boat.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Image */}
              {boat.image_url && (
                <div className="relative h-40 bg-gray-100">
                  <img
                    src={boat.image_url}
                    alt={boat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-4">
                {/* Header */}
                <div className="mb-3">
                  <h3 className="text-lg font-bold text-gray-900">{boat.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">{boat.boat_type}</span>
                    {boat.is_active && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                        Attiva
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-2 mb-3 text-sm">
                  {boat.max_passengers && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Passeggeri:</span>
                      <span className="font-medium text-gray-900">{boat.max_passengers}</span>
                    </div>
                  )}
                  {boat.length_meters && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Lunghezza:</span>
                      <span className="font-medium text-gray-900">{boat.length_meters}m</span>
                    </div>
                  )}
                  {boat.rental_price_high_season && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Noleggio:</span>
                      <span className="font-semibold text-blue-600">€{boat.rental_price_high_season}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <a
                    href={`/boats/${boat.id}`}
                    className="flex-1 px-3 py-2 text-center text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Modifica
                  </a>
                  <button
                    onClick={() => handleDelete(boat.id)}
                    className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Barca</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Passeggeri</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Lunghezza</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Prezzo Noleggio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Stato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {boats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nessuna barca trovata
                  </td>
                </tr>
              ) : (
                boats.map((boat) => (
                  <tr key={boat.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {boat.image_url && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <img
                              src={boat.image_url}
                              alt={boat.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="font-medium text-gray-900">{boat.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">{boat.boat_type}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{boat.max_passengers || '-'}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {boat.length_meters ? `${boat.length_meters}m` : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-blue-600">
                      {boat.rental_price_high_season ? `€${boat.rental_price_high_season}` : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        boat.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {boat.is_active ? 'Attiva' : 'Inattiva'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <a
                          href={`/boats/${boat.id}`}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Modifica
                        </a>
                        <button
                          onClick={() => handleDelete(boat.id)}
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