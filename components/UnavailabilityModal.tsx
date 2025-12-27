'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface UnavailabilityModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  unavailability?: any
  preselectedDate?: Date
}

export default function UnavailabilityModal({ 
  isOpen, 
  onClose, 
  onSave, 
  unavailability,
  preselectedDate 
}: UnavailabilityModalProps) {
  const [formData, setFormData] = useState({
    boat_id: '',
    date_from: '',
    date_to: '',
    reason: '',
    notes: ''
  })

  const [boats, setBoats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingBoats, setLoadingBoats] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadBoats()
      
      if (unavailability) {
        // Modalità modifica
        setFormData({
          boat_id: unavailability.boat_id || '',
          date_from: unavailability.date_from || '',
          date_to: unavailability.date_to || '',
          reason: unavailability.reason || '',
          notes: unavailability.notes || ''
        })
      } else if (preselectedDate) {
        // Modalità creazione con data preselezionata
        const dateStr = format(preselectedDate, 'yyyy-MM-dd')
        setFormData(prev => ({
          ...prev,
          date_from: dateStr,
          date_to: dateStr
        }))
      }
    }
  }, [isOpen, unavailability, preselectedDate])

  async function loadBoats() {
    try {
      setLoadingBoats(true)
      const res = await fetch('/api/boats')
      const data = await res.json()
      setBoats(data || [])
    } catch (error) {
      console.error('Error loading boats:', error)
      toast.error('Errore caricamento barche')
    } finally {
      setLoadingBoats(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validazioni
    if (!formData.boat_id) {
      toast.error('Seleziona una barca')
      return
    }
    if (!formData.date_from || !formData.date_to) {
      toast.error('Inserisci le date')
      return
    }
    if (formData.date_from > formData.date_to) {
      toast.error('La data finale deve essere successiva o uguale alla data iniziale')
      return
    }

    try {
      setLoading(true)

      const url = unavailability 
        ? `/api/unavailabilities/${unavailability.id}` 
        : '/api/unavailabilities'
      
      const method = unavailability ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Errore salvataggio')
      }

      toast.success(unavailability ? 'Indisponibilità aggiornata!' : 'Indisponibilità creata!')
      onSave()
      onClose()
    } catch (error: any) {
      console.error('Error saving unavailability:', error)
      toast.error(error.message || 'Errore nel salvataggio')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!unavailability) return

    if (!confirm('Sei sicuro di voler eliminare questa indisponibilità?')) return

    try {
      setLoading(true)

      const res = await fetch(`/api/unavailabilities/${unavailability.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Errore eliminazione')

      toast.success('Indisponibilità eliminata!')
      onSave()
      onClose()
    } catch (error: any) {
      console.error('Error deleting unavailability:', error)
      toast.error('Errore nell\'eliminazione')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {unavailability ? 'Modifica Indisponibilità' : 'Nuova Indisponibilità'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">Blocca date per una barca</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {loadingBoats ? (
            <div className="text-center py-8 text-gray-600">Caricamento...</div>
          ) : (
            <>
              {/* Barca */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barca *
                </label>
                <select
                  value={formData.boat_id}
                  onChange={(e) => setFormData({ ...formData, boat_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Seleziona barca...</option>
                  {boats.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.boat_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Inizio *
                  </label>
                  <input
                    type="date"
                    value={formData.date_from}
                    onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Fine *
                  </label>
                  <input
                    type="date"
                    value={formData.date_to}
                    onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Seleziona motivo...</option>
                  <option value="maintenance">🔧 Manutenzione</option>
                  <option value="repair">🛠️ Riparazione</option>
                  <option value="cleaning">🧼 Pulizia</option>
                  <option value="inspection">🔍 Ispezione</option>
                  <option value="reserved">🔒 Riservata</option>
                  <option value="other">📋 Altro</option>
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Dettagli aggiuntivi..."
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            {unavailability && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                disabled={loading}
              >
                🗑️ Elimina
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading || loadingBoats}
            >
              {loading ? 'Salvataggio...' : (unavailability ? 'Aggiorna' : 'Crea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}