'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Tag, Power, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'

type Boat = { id: string; name: string }
type Offerta = {
  id: string
  boat_id: string
  boat_name: string
  data_dal: string
  data_al: string
  prezzo: number
  num_passeggeri: number | null
  descrizione: string | null
  attivo: boolean
}

const EMPTY_FORM = { boat_id: '', data_dal: '', data_al: '', prezzo: '', num_passeggeri: '', descrizione: '' }

export default function PrezziSpecialiPage() {
  const [offerte, setOfferte] = useState<Offerta[]>([])
  const [boats, setBoats] = useState<Boat[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filtroBarca, setFiltroBarca] = useState('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  async function loadData() {
    setLoading(true)
    try {
      const [offRes, boatsRes] = await Promise.all([
        fetch('/api/prezzi-speciali'),
        fetch('/api/boats'),
      ])
      const off = await offRes.json()
      const bt = await boatsRes.json()
      setOfferte(Array.isArray(off) ? off : [])
      setBoats((Array.isArray(bt) ? bt : []).map((b: any) => ({ id: b.id, name: b.name })))
    } catch {
      toast.error('Errore caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function handleAdd() {
    if (!form.boat_id || !form.data_dal || !form.data_al || form.prezzo === '') {
      toast.error('Compila barca, periodo e prezzo')
      return
    }
    if (form.data_al < form.data_dal) {
      toast.error('La data finale non può precedere quella iniziale')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/prezzi-speciali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Errore') }
      toast.success('Offerta aggiunta')
      setForm(EMPTY_FORM)
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa offerta?')) return
    try {
      const res = await fetch(`/api/prezzi-speciali?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Offerta eliminata')
      setOfferte(prev => prev.filter(o => o.id !== id))
    } catch {
      toast.error('Errore eliminazione')
    }
  }

  async function toggleAttivo(o: Offerta) {
    try {
      const res = await fetch('/api/prezzi-speciali', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: o.id, attivo: !o.attivo }),
      })
      if (!res.ok) throw new Error()
      setOfferte(prev => prev.map(x => x.id === o.id ? { ...x, attivo: !x.attivo } : x))
    } catch {
      toast.error('Errore aggiornamento')
    }
  }

  function startEdit(o: Offerta) {
    setEditId(o.id)
    setEditForm({
      boat_id: o.boat_id,
      data_dal: o.data_dal,
      data_al: o.data_al,
      prezzo: String(o.prezzo),
      num_passeggeri: o.num_passeggeri != null ? String(o.num_passeggeri) : '',
      descrizione: o.descrizione || '',
    })
  }

  function cancelEdit() {
    setEditId(null)
    setEditForm(EMPTY_FORM)
  }

  async function saveEdit(id: string) {
    if (!editForm.boat_id || !editForm.data_dal || !editForm.data_al || editForm.prezzo === '') {
      toast.error('Compila barca, periodo e prezzo')
      return
    }
    if (editForm.data_al < editForm.data_dal) {
      toast.error('La data finale non può precedere quella iniziale')
      return
    }
    try {
      const res = await fetch('/api/prezzi-speciali', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Errore') }
      toast.success('Offerta aggiornata')
      cancelEdit()
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Errore aggiornamento')
    }
  }

  const fmtData = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT') : '—'
  const offerteFiltrate = filtroBarca === 'all' ? offerte : offerte.filter(o => o.boat_id === filtroBarca)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Tag className="h-6 w-6 text-sky-600" />
        <h1 className="text-2xl font-bold">Prezzi Speciali</h1>
      </div>
      <p className="text-gray-500 mb-6">Offerte a prezzo speciale per periodo definito, per singola barca.</p>

      {/* Form aggiunta */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Plus className="h-4 w-4" /> Nuova offerta</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <Label className="text-xs">Barca *</Label>
            <select
              value={form.boat_id}
              onChange={e => setForm({ ...form, boat_id: e.target.value })}
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Seleziona barca...</option>
              {boats.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Dal *</Label>
            <Input type="date" value={form.data_dal} onChange={e => setForm({ ...form, data_dal: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Al *</Label>
            <Input type="date" value={form.data_al} onChange={e => setForm({ ...form, data_al: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Prezzo € *</Label>
            <Input type="number" step="0.01" value={form.prezzo} onChange={e => setForm({ ...form, prezzo: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <Label className="text-xs">N° pax</Label>
            <Input type="number" value={form.num_passeggeri} onChange={e => setForm({ ...form, num_passeggeri: e.target.value })} placeholder="—" />
          </div>
          <div className="md:col-span-5">
            <Label className="text-xs">Descrizione</Label>
            <Input value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} placeholder="Es. Offerta settembre, weekend..." />
          </div>
          <div>
            <Button onClick={handleAdd} disabled={saving} className="w-full bg-sky-600 hover:bg-sky-700">
              {saving ? 'Salvo...' : 'Aggiungi'}
            </Button>
          </div>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3 mb-3">
        <Label className="text-xs text-gray-500">Filtra per barca:</Label>
        <select value={filtroBarca} onChange={e => setFiltroBarca(e.target.value)} className="h-9 px-3 border border-gray-300 rounded-md text-sm">
          <option value="all">Tutte le barche</option>
          {boats.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className="text-sm text-gray-400 ml-auto">{offerteFiltrate.length} offerte</span>
      </div>

      {/* Tabella offerte */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Barca</th>
              <th className="px-4 py-2 text-left">Periodo</th>
              <th className="px-4 py-2 text-right">Prezzo</th>
              <th className="px-4 py-2 text-center">N° Pax</th>
              <th className="px-4 py-2 text-left">Descrizione</th>
              <th className="px-4 py-2 text-center">Stato</th>
              <th className="px-4 py-2 text-center">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Caricamento…</td></tr>
            ) : offerteFiltrate.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nessuna offerta{filtroBarca !== 'all' ? ' per questa barca' : ''}</td></tr>
            ) : offerteFiltrate.map(o => editId === o.id ? (
              <tr key={o.id} className="border-t bg-amber-50">
                <td className="px-4 py-2">
                  <select value={editForm.boat_id} onChange={e => setEditForm({ ...editForm, boat_id: e.target.value })} className="w-full h-9 px-2 border border-gray-300 rounded text-sm">
                    {boats.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <Input type="date" value={editForm.data_dal} onChange={e => setEditForm({ ...editForm, data_dal: e.target.value })} className="h-9 text-xs" />
                    <Input type="date" value={editForm.data_al} onChange={e => setEditForm({ ...editForm, data_al: e.target.value })} className="h-9 text-xs" />
                  </div>
                </td>
                <td className="px-4 py-2">
                  <Input type="number" step="0.01" value={editForm.prezzo} onChange={e => setEditForm({ ...editForm, prezzo: e.target.value })} className="h-9 text-sm text-right" />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" value={editForm.num_passeggeri} onChange={e => setEditForm({ ...editForm, num_passeggeri: e.target.value })} className="h-9 text-sm text-center" placeholder="—" />
                </td>
                <td className="px-4 py-2">
                  <Input value={editForm.descrizione} onChange={e => setEditForm({ ...editForm, descrizione: e.target.value })} className="h-9 text-sm" placeholder="Descrizione" />
                </td>
                <td className="px-4 py-2 text-center text-xs text-gray-400">in modifica</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => saveEdit(o.id)} title="Salva">
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} title="Annulla">
                      <X className="h-4 w-4 text-gray-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={o.id} className={`border-t ${!o.attivo ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2.5 font-semibold">{o.boat_name}</td>
                <td className="px-4 py-2.5">{fmtData(o.data_dal)} → {fmtData(o.data_al)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-sky-700">€ {Number(o.prezzo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-2.5 text-center">{o.num_passeggeri ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-600">{o.descrizione || '—'}</td>
                <td className="px-4 py-2.5 text-center">
                  {o.attivo
                    ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Attiva</Badge>
                    : <Badge variant="secondary">Disattiva</Badge>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(o)} title="Modifica">
                      <Pencil className="h-4 w-4 text-sky-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleAttivo(o)} title={o.attivo ? 'Disattiva' : 'Attiva'}>
                      <Power className={`h-4 w-4 ${o.attivo ? 'text-green-600' : 'text-gray-400'}`} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(o.id)} title="Elimina">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}