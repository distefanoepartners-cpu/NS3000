'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

interface Partner {
  id: string
  code: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  commission_percentage: number
  commission_fixed: number
  commission_type: 'percentage' | 'fixed'
  is_active: boolean
  notes: string | null
  created_at: string
}

const SITE_URL = 'https://rentsalernoboat.it'

export default function PartnersPage() {
  const { isAdmin } = useAuth()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [qrPartnerId, setQrPartnerId] = useState<string | null>(null)

  const [form, setForm] = useState({
    code: '',
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    commission_percentage: 10,
    commission_fixed: 0,
    commission_type: 'percentage' as 'percentage' | 'fixed',
    is_active: true,
    notes: '',
  })

  useEffect(() => { loadPartners() }, [])

  async function loadPartners() {
    try {
      setLoading(true)
      const res = await fetch('/api/partners')
      const data = await res.json()
      setPartners(data || [])
    } catch { toast.error('Errore caricamento partner') }
    finally { setLoading(false) }
  }

  function resetForm() {
    setForm({ code: '', name: '', contact_name: '', email: '', phone: '', website: '', commission_percentage: 10, commission_fixed: 0, commission_type: 'percentage', is_active: true, notes: '' })
    setEditing(null)
  }

  function openNew() { resetForm(); setShowModal(true) }

  function openEdit(p: Partner) {
    setEditing(p)
    setForm({
      code: p.code,
      name: p.name,
      contact_name: p.contact_name || '',
      email: p.email || '',
      phone: p.phone || '',
      website: p.website || '',
      commission_percentage: p.commission_percentage,
      commission_fixed: p.commission_fixed,
      commission_type: p.commission_type,
      is_active: p.is_active,
      notes: p.notes || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.code || !form.name) { toast.error('Codice e Nome sono obbligatori'); return }
    try {
      const url = editing ? `/api/partners/${editing.id}` : '/api/partners'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore salvataggio')
      toast.success(editing ? 'Partner aggiornato!' : 'Partner creato!')
      setShowModal(false)
      resetForm()
      loadPartners()
    } catch (err: any) { toast.error(err.message) }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminare il partner "${name}"?`)) return
    try {
      const res = await fetch(`/api/partners/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Errore eliminazione')
      toast.success('Partner eliminato!')
      loadPartners()
    } catch (err: any) { toast.error(err.message) }
  }

  function copyLink(code: string, id: string) {
    const link = `${SITE_URL}/?ref=${code}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id)
      toast.success('Link copiato!')
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function generateCode(name: string) {
    const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)
    const suffix = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    return `NS-${base}${suffix}`
  }

  function downloadQR(code: string, name: string, format: 'png' | 'svg') {
    const link = `${SITE_URL}/?ref=${code}`
    const size = format === 'png' ? 600 : 800
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}&format=${format}&margin=20`

    fetch(qrUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `QR-${code}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        toast.success(`QR ${format.toUpperCase()} scaricato per ${name}!`)
      })
      .catch(() => toast.error('Errore download QR Code'))
  }

  if (!isAdmin) return <div className="p-8 text-center text-gray-500">Accesso riservato.</div>

  const activePartners = partners.filter(p => p.is_active)
  const inactivePartners = partners.filter(p => !p.is_active)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🤝 Partner & Affiliati</h1>
          <p className="text-sm text-gray-500 mt-1">Gestisci partner, link referral, QR code e commissioni</p>
        </div>
        <button onClick={openNew} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm flex items-center gap-2">
          ➕ Nuovo Partner
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium">Totale Partner</div>
          <div className="text-2xl font-bold text-gray-900">{partners.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-4">
          <div className="text-xs text-green-600 font-medium">Attivi</div>
          <div className="text-2xl font-bold text-green-700">{activePartners.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium">Inattivi</div>
          <div className="text-2xl font-bold text-gray-400">{inactivePartners.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
          <div className="text-xs text-blue-600 font-medium">Comm. Media</div>
          <div className="text-2xl font-bold text-blue-700">
            {partners.length > 0 ? (partners.reduce((s, p) => s + p.commission_percentage, 0) / partners.length).toFixed(0) : 0}%
          </div>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Caricamento...</div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">🤝</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun partner ancora</h3>
          <p className="text-gray-500 mb-4">Crea il primo partner per iniziare a tracciare le prenotazioni referral</p>
          <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">➕ Crea Partner</button>
        </div>
      ) : (
        <div className="space-y-4">
          {partners.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${p.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.is_active ? 'Attivo' : 'Inattivo'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono font-bold">
                        {p.code}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                      {p.contact_name && <span>👤 {p.contact_name}</span>}
                      {p.email && <span>📧 {p.email}</span>}
                      {p.phone && <span>📱 {p.phone}</span>}
                      {p.website && <span>🌐 {p.website}</span>}
                    </div>
                  </div>

                  {/* Commissione + Azioni */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Commissione</div>
                      <div className="text-xl font-bold text-green-700">
                        {p.commission_type === 'percentage' ? `${p.commission_percentage}%` : `€${p.commission_fixed}`}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => copyLink(p.code, p.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          copiedId === p.id
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                        }`}
                        title="Copia link referral"
                      >
                        {copiedId === p.id ? '✅' : '🔗'}
                      </button>
                      <button
                        onClick={() => setQrPartnerId(qrPartnerId === p.id ? null : p.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          qrPartnerId === p.id
                            ? 'bg-purple-200 text-purple-800 border border-purple-400'
                            : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
                        }`}
                        title="QR Code"
                      >
                        📱
                      </button>
                      <button onClick={() => openEdit(p)} className="px-3 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 text-sm">✏️</button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm">🗑️</button>
                    </div>
                  </div>
                </div>

                {/* Link preview */}
                <div className="mt-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium flex-shrink-0">Link Referral:</span>
                  <code className="text-xs text-blue-700 font-mono truncate flex-1">{SITE_URL}/?ref={p.code}</code>
                </div>

                {p.notes && (
                  <div className="mt-2 text-xs text-gray-500 italic">📝 {p.notes}</div>
                )}

                {/* QR Code Panel */}
                {qrPartnerId === p.id && (
                  <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="bg-white p-3 rounded-lg shadow-sm">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(SITE_URL + '/?ref=' + p.code)}&margin=10`}
                          alt={`QR Code ${p.code}`}
                          width={200}
                          height={200}
                          className="block"
                        />
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <h4 className="text-sm font-bold text-purple-900 mb-1">QR Code — {p.name}</h4>
                        <p className="text-xs text-purple-700 mb-3">
                          Scansionando questo codice, il cliente atterrerà su<br />
                          <code className="bg-white px-1.5 py-0.5 rounded text-purple-800">{SITE_URL}/?ref={p.code}</code>
                        </p>
                        <p className="text-xs text-purple-600 mb-4">
                          Stampa il QR su biglietti da visita, flyer o esponi nel punto vendita del partner.
                        </p>
                        <div className="flex gap-2 justify-center sm:justify-start flex-wrap">
                          <button
                            onClick={() => downloadQR(p.code, p.name, 'png')}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-1.5"
                          >
                            ⬇️ PNG (stampa)
                          </button>
                          <button
                            onClick={() => downloadQR(p.code, p.name, 'svg')}
                            className="px-4 py-2 bg-white text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 text-sm font-medium flex items-center gap-1.5"
                          >
                            ⬇️ SVG (vettoriale)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Modifica Partner' : 'Nuovo Partner'}</h2>
              <button onClick={() => { setShowModal(false); resetForm() }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Partner *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Es. Salerno Hub" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Codice *
                    {!editing && form.name && (
                      <button type="button" onClick={() => setForm({ ...form, code: generateCode(form.name) })} className="ml-2 text-xs text-blue-600 hover:underline">Auto-genera</button>
                    )}
                  </label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, '') })} placeholder="SALERNOHUB" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase" maxLength={20} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referente</label>
                  <input type="text" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sito Web</label>
                  <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-800 mb-3">💰 Commissione</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select value={form.commission_type} onChange={e => setForm({ ...form, commission_type: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="percentage">Percentuale (%)</option>
                      <option value="fixed">Fisso (€)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {form.commission_type === 'percentage' ? 'Percentuale (%)' : 'Importo Fisso (€)'}
                    </label>
                    <input
                      type="number" step="0.01" min="0"
                      value={form.commission_type === 'percentage' ? form.commission_percentage : form.commission_fixed}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0
                        if (form.commission_type === 'percentage') setForm({ ...form, commission_percentage: val })
                        else setForm({ ...form, commission_fixed: val })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Note interne..." />
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="partner-active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                <label htmlFor="partner-active" className="text-sm font-medium text-gray-700 cursor-pointer">Partner Attivo</label>
              </div>
            </div>

            <div className="p-5 border-t flex gap-3">
              <button onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm">Annulla</button>
              <button onClick={handleSave} disabled={!form.code || !form.name} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm">
                {editing ? 'Aggiorna' : 'Crea Partner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}