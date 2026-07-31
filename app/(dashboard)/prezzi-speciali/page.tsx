'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Calendar, Ship, Tag, Check, X } from 'lucide-react'
import { toast } from 'sonner'

type RentalService = { id: string; name: string; service_type?: string }
type Boat = { id: string; name: string }
type PrezzoSpeciale = {
  id: string
  nome: string
  service_id: string
  boat_id: string | null
  data_inizio: string
  data_fine: string
  prezzo: number
  is_active: boolean
  rental_services?: { name: string }
  boats?: { name: string } | null
}

const EMPTY_FORM = {
  id: '' as string,
  nome: '',
  service_id: '',
  boat_id: '',
  data_inizio: '',
  data_fine: '',
  prezzo: '',
  is_active: true,
}

export default function PrezziSpecialiPage() {
  const [prezzi, setPrezzi] = useState<PrezzoSpeciale[]>([])
  const [services, setServices] = useState<RentalService[]>([])
  const [boats, setBoats] = useState<Boat[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editing, setEditing] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [pRes, sRes, bRes] = await Promise.all([
        fetch('/api/prezzi-speciali').then(r => r.json()),
        fetch('/api/rental-services').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/boats').then(r => r.ok ? r.json() : []).catch(() => []),
      ])
      setPrezzi(Array.isArray(pRes) ? pRes : [])
      setServices(Array.isArray(sRes) ? sRes : [])
      setBoats(Array.isArray(bRes) ? bRes : [])
    } catch (e) {
      console.error(e)
      toast.error('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM })
    setEditing(false)
  }

  // Dopo un salvataggio, mantiene nome e date per inserimenti rapidi multipli
  function resetKeepPeriod() {
    setForm(prev => ({
      ...EMPTY_FORM,
      nome: prev.nome,
      data_inizio: prev.data_inizio,
      data_fine: prev.data_fine,
    }))
    setEditing(false)
  }

  function startEdit(p: PrezzoSpeciale) {
    setForm({
      id: p.id,
      nome: p.nome,
      service_id: p.service_id,
      boat_id: p.boat_id || '',
      data_inizio: p.data_inizio,
      data_fine: p.data_fine,
      prezzo: String(p.prezzo),
      is_active: p.is_active,
    })
    setEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    if (!form.nome || !form.service_id || !form.data_inizio || !form.data_fine || form.prezzo === '') {
      toast.error('Compila nome, servizio, date e prezzo')
      return
    }
    if (form.data_fine < form.data_inizio) {
      toast.error('La data fine non può precedere la data inizio')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...(editing ? { id: form.id } : {}),
        nome: form.nome,
        service_id: form.service_id,
        boat_id: form.boat_id || null,
        data_inizio: form.data_inizio,
        data_fine: form.data_fine,
        prezzo: Number(form.prezzo),
        is_active: form.is_active,
      }
      const res = await fetch('/api/prezzi-speciali', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore salvataggio')

      toast.success(editing ? 'Prezzo aggiornato' : 'Prezzo aggiunto')
      await loadAll()
      if (editing) resetForm()
      else resetKeepPeriod()
    } catch (e: any) {
      toast.error(e.message || 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo prezzo speciale?')) return
    try {
      const res = await fetch(`/api/prezzi-speciali?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Errore eliminazione')
      toast.success('Prezzo eliminato')
      setPrezzi(prev => prev.filter(p => p.id !== id))
    } catch (e: any) {
      toast.error(e.message || 'Errore eliminazione')
    }
  }

  async function toggleActive(p: PrezzoSpeciale) {
    try {
      const res = await fetch('/api/prezzi-speciali', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
      })
      if (!res.ok) throw new Error('Errore')
      setPrezzi(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
    } catch {
      toast.error('Errore aggiornamento stato')
    }
  }

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) }
    catch { return d }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Tag className="w-7 h-7 text-blue-600" /> Prezzi Speciali
        </h1>
        <p className="text-gray-600 mt-1">
          Prezzi differenziati per periodi come Ferragosto, festività, ponti.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editing ? 'Modifica prezzo speciale' : 'Nuovo prezzo speciale'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <Label htmlFor="nome">Nome periodo</Label>
            <Input id="nome" placeholder="Es. Ferragosto 2026"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })} />
          </div>

          <div>
            <Label htmlFor="service">Servizio</Label>
            <select id="service"
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm"
              value={form.service_id}
              onChange={e => setForm({ ...form, service_id: e.target.value })}>
              <option value="">Seleziona servizio...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="boat">Barca</Label>
            <select id="boat"
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm"
              value={form.boat_id}
              onChange={e => setForm({ ...form, boat_id: e.target.value })}>
              <option value="">— Tutte / Collettivo —</option>
              {boats.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="di">Data inizio</Label>
            <Input id="di" type="date"
              value={form.data_inizio}
              onChange={e => setForm({ ...form, data_inizio: e.target.value })} />
          </div>

          <div>
            <Label htmlFor="df">Data fine</Label>
            <Input id="df" type="date"
              value={form.data_fine}
              onChange={e => setForm({ ...form, data_fine: e.target.value })} />
          </div>

          <div>
            <Label htmlFor="prezzo">Prezzo Ferragosto (€)</Label>
            <Input id="prezzo" type="number" min="0" step="0.01" placeholder="90.00"
              value={form.prezzo}
              onChange={e => setForm({ ...form, prezzo: e.target.value })} />
            <p className="text-[11px] text-gray-500 mt-1">
              {form.boat_id
                ? 'Privato: prezzo fisso barca (non × passeggeri)'
                : 'Collettivo: prezzo per persona (× passeggeri)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvataggio...' : (
              <><Plus className="w-4 h-4 mr-1" /> {editing ? 'Aggiorna' : 'Aggiungi'}</>
            )}
          </Button>
          {editing && (
            <Button variant="outline" onClick={resetForm} disabled={saving}>Annulla</Button>
          )}
          {!editing && (form.nome || form.data_inizio) && (
            <span className="text-xs text-gray-500">
              Dopo il salvataggio nome e date restano, per aggiungere velocemente più barche.
            </span>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Prezzi speciali configurati</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Caricamento...</div>
        ) : prezzi.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nessun prezzo speciale configurato. Aggiungine uno dal form sopra.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Periodo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Servizio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Barca</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">€/persona</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Attivo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prezzi.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${!p.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.rental_services?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {p.boats?.name ? (
                        <span className="inline-flex items-center gap-1 text-gray-700">
                          <Ship className="w-3.5 h-3.5" /> {p.boats.name}
                        </span>
                      ) : (
                        <Badge variant="secondary">Collettivo</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {fmtDate(p.data_inizio)} – {fmtDate(p.data_fine)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      €{Number(p.prezzo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(p)}
                        className={`inline-flex items-center justify-center w-8 h-6 rounded-full transition-colors ${
                          p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                        }`}
                        title={p.is_active ? 'Attivo' : 'Disattivo'}>
                        {p.is_active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(p)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Modifica">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded ml-1"
                        title="Elimina">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}