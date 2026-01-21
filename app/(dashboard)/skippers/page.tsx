'use client'

import { useState, useEffect } from 'react'

interface Skipper {
  id: string
  first_name: string
  last_name: string
  phone: string
  license_number: string
  license_expiry_date: string
  is_active: boolean
  notes: string
}

export default function SkippersPage() {
  const [skippers, setSkippers] = useState<Skipper[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSkipper, setEditingSkipper] = useState<Skipper | null>(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    license_number: '',
    license_expiry_date: '',
    is_active: true,
    notes: ''
  })

  useEffect(() => {
    loadSkippers()
  }, [])

  async function loadSkippers() {
    try {
      const res = await fetch('/api/skippers')
      const data = await res.json()
      setSkippers(data)
    } catch (error) {
      console.error('Error loading skippers:', error)
    } finally {
      setLoading(false)
    }
  }

  function openModal(skipper?: Skipper) {
    if (skipper) {
      setEditingSkipper(skipper)
      setFormData({
        first_name: skipper.first_name,
        last_name: skipper.last_name,
        phone: skipper.phone || '',
        license_number: skipper.license_number || '',
        license_expiry_date: skipper.license_expiry_date || '',
        is_active: skipper.is_active,
        notes: skipper.notes || ''
      })
    } else {
      setEditingSkipper(null)
      setFormData({
        first_name: '',
        last_name: '',
        phone: '',
        license_number: '',
        license_expiry_date: '',
        is_active: true,
        notes: ''
      })
    }
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingSkipper(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      if (editingSkipper) {
        const res = await fetch(`/api/skippers/${editingSkipper.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        if (!res.ok) throw new Error('Update failed')
      } else {
        const res = await fetch('/api/skippers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        if (!res.ok) throw new Error('Create failed')
      }

      closeModal()
      loadSkippers()
    } catch (error) {
      console.error('Error saving skipper:', error)
      alert('Errore durante il salvataggio')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Sei sicuro di voler eliminare questo skipper?')) return

    try {
      const res = await fetch(`/api/skippers/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Delete failed')
      loadSkippers()
    } catch (error) {
      console.error('Error deleting skipper:', error)
      alert('Errore durante eliminazione')
    }
  }

  function getLicenseStatus(expiryDate: string | null) {
    if (!expiryDate) return { color: 'gray', text: 'N/A', icon: '⚪' }
    
    const expiry = new Date(expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry < 0) {
      return { color: 'red', text: 'Scaduta', icon: '🔴' }
    } else if (daysUntilExpiry < 30) {
      return { color: 'yellow', text: `Scade tra ${daysUntilExpiry} giorni`, icon: '🟡' }
    } else {
      return { color: 'green', text: 'Valida', icon: '🟢' }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">⚓ Gestione Skipper</h1>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            + Nuovo Skipper
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-600">Caricamento...</div>
        ) : skippers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            Nessuno skipper presente. Crea il primo skipper!
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contatti</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Azioni</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {skippers.map((skipper) => {
                  const licenseStatus = getLicenseStatus(skipper.license_expiry_date)
                  
                  return (
                    <tr key={skipper.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {skipper.first_name} {skipper.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{skipper.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{skipper.license_number || '-'}</div>
                        {skipper.license_expiry_date && (
                          <div className="text-xs text-gray-500 mt-1">
                            {licenseStatus.icon} {new Date(skipper.license_expiry_date).toLocaleDateString('it-IT')}
                          </div>
                        )}
                        <div className={`text-xs mt-1 font-medium ${
                          licenseStatus.color === 'red' ? 'text-red-600' :
                          licenseStatus.color === 'yellow' ? 'text-yellow-600' :
                          licenseStatus.color === 'green' ? 'text-green-600' :
                          'text-gray-500'
                        }`}>
                          {licenseStatus.text}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          skipper.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {skipper.is_active ? 'Attivo' : 'Disattivato'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => openModal(skipper)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDelete(skipper.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingSkipper ? 'Modifica Skipper' : 'Nuovo Skipper'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cellulare</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+39 340 1234567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">N° Patente</label>
                    <input
                      type="text"
                      value={formData.license_number}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                      placeholder="PN-SA-2023-001234"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza Patente</label>
                    <input
                      type="date"
                      value={formData.license_expiry_date}
                      onChange={(e) => setFormData({ ...formData, license_expiry_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                    <select
                      value={formData.is_active ? 'true' : 'false'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="true">Attivo</option>
                      <option value="false">Disattivato</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Note aggiuntive..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingSkipper ? 'Salva Modifiche' : 'Crea Skipper'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
