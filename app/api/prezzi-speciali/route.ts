// app/api/prezzi-speciali/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - lista offerte con nome barca
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('prezzi_speciali')
      .select('id, boat_id, data_dal, data_al, prezzo, num_passeggeri, descrizione, attivo, created_at, boats(name)')
      .order('data_dal', { ascending: false })

    if (error) throw error

    const offerte = (data || []).map((o: any) => ({
      id: o.id,
      boat_id: o.boat_id,
      boat_name: o.boats?.name || '—',
      data_dal: o.data_dal,
      data_al: o.data_al,
      prezzo: o.prezzo,
      num_passeggeri: o.num_passeggeri,
      descrizione: o.descrizione,
      attivo: o.attivo,
    }))

    return NextResponse.json(offerte)
  } catch (error: any) {
    console.error('Errore GET prezzi_speciali:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - crea offerta
export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.boat_id || !body.data_dal || !body.data_al || body.prezzo == null) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti (barca, date, prezzo)' }, { status: 400 })
    }
    if (body.data_al < body.data_dal) {
      return NextResponse.json({ error: 'La data finale non può precedere quella iniziale' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('prezzi_speciali')
      .insert({
        boat_id: body.boat_id,
        data_dal: body.data_dal,
        data_al: body.data_al,
        prezzo: parseFloat(body.prezzo) || 0,
        num_passeggeri: body.num_passeggeri != null ? parseInt(body.num_passeggeri) : null,
        descrizione: body.descrizione || null,
        attivo: body.attivo !== undefined ? body.attivo : true,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Errore POST prezzi_speciali:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - attiva/disattiva o modifica offerta
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

    const update: Record<string, any> = {}
    if (body.attivo !== undefined) update.attivo = body.attivo
    if (body.boat_id !== undefined) update.boat_id = body.boat_id
    if (body.prezzo !== undefined) update.prezzo = parseFloat(body.prezzo) || 0
    if (body.data_dal !== undefined) update.data_dal = body.data_dal
    if (body.data_al !== undefined) update.data_al = body.data_al
    if (body.num_passeggeri !== undefined) update.num_passeggeri = body.num_passeggeri != null ? parseInt(body.num_passeggeri) : null
    if (body.descrizione !== undefined) update.descrizione = body.descrizione || null

    const { data, error } = await supabaseAdmin
      .from('prezzi_speciali')
      .update(update)
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore PATCH prezzi_speciali:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - elimina offerta (?id=...)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('prezzi_speciali')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Errore DELETE prezzi_speciali:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}