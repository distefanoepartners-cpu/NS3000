'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface CreateCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onCustomerCreated: (customerId: string) => void
}

export default function CreateCustomerModal({ 
  isOpen, 
  onClose, 
  onCustomerCreated 
}: CreateCustomerModalProps) {
  const [formData, setFormData] = useState({
    // Dati Anagrafici
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    nationality: '',
    
    // Documento di Identità
    document_type: 'Carta Identità',
    document_number: '',
    document_expiry: '',
    
    // Patente Nautica
    has_boat_license: false,
    boat_license_number: '',
    boat_license_expiry: '',
    
    // Note
    notes: ''
  })

  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.first_name || !formData.last_name) {
      toast.error('Nome e Cognome sono obbligatori')
      return
    }

    try {
      setLoading(true)

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        nationality: formData.nationality || null,
        document_type: formData.document_type || null,
        document_number: formData.document_number || null,
        document_expiry: formData.document_expiry || null,
        has_boat_license: formData.has_boat_license,
        boat_license_number: formData.has_boat_license ? formData.boat_license_number || null : null,
        boat_license_expiry: formData.has_boat_license ? formData.boat_license_expiry || null : null,
        notes: formData.notes || null
      }

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Errore creazione cliente')
      }

      const newCustomer = await res.json()
      toast.success('Cliente creato con successo!')
      onCustomerCreated(newCustomer.id)
      onClose()
      
      // Reset form
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        nationality: '',
        document_type: 'Carta Identità',
        document_number: '',
        document_expiry: '',
        has_boat_license: false,
        boat_license_number: '',
        boat_license_expiry: '',
        notes: ''
      })
    } catch (error: any) {
      console.error('Error creating customer:', error)
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-white rounded-t-xl flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nuovo Cliente</h2>
            <p className="text-sm text-gray-600">Inserisci i dati anagrafici del cliente</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form - Scrollable */}
        <div className="overflow-y-auto flex-1 p-6">
          <form id="customer-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* 👤 Dati Anagrafici */}
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-4">
                👤 Dati Anagrafici
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nazionalità</label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Es. Italiana, Francese, Tedesca..."
                  />
                </div>
              </div>
            </div>

            {/* 📄 Documento di Identità */}
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-4">
                📄 Documento di Identità
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Documento</label>
                  <select
                    value={formData.document_type}
                    onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="Carta Identità">Carta d'Identità</option>
                    <option value="Passaporto">Passaporto</option>
                    <option value="Patente">Patente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numero Documento</label>
                  <input
                    type="text"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                  <input
                    type="date"
                    value={formData.document_expiry}
                    onChange={(e) => setFormData({ ...formData, document_expiry: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ⚓ Patente Nautica */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="has_boat_license"
                  checked={formData.has_boat_license}
                  onChange={(e) => setFormData({ ...formData, has_boat_license: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="has_boat_license" className="text-base font-semibold text-gray-900">
                  ⚓ Possiede Patente Nautica
                </label>
              </div>

              {formData.has_boat_license && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numero Patente</label>
                    <input
                      type="text"
                      value={formData.boat_license_number}
                      onChange={(e) => setFormData({ ...formData, boat_license_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                    <input
                      type="date"
                      value={formData.boat_license_expiry}
                      onChange={(e) => setFormData({ ...formData, boat_license_expiry: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 📝 Note */}
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-4">
                📝 Note
              </h3>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Note aggiuntive..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

          </form>
        </div>

        {/* Footer - Fixed */}
        <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
            disabled={loading}
          >
            Annulla
          </button>
          <button
            type="submit"
            form="customer-form"
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            disabled={loading}
          >
            {loading ? 'Salvataggio...' : 'Crea Cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}