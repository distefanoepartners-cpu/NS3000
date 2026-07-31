// app/api/prezzi-speciali/route.ts
// CRUD dei prezzi speciali (Ferragosto, ecc.) per il pannello backoffice.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET — lista prezzi speciali (con nome servizio e barca per la UI)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('prezzi_speciali')
      .select('*, rental_services(name), boats(name)')
      .order('data_inizio', { ascending: false })
      .order('nome')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — crea un prezzo speciale
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.nome || !body.service_id || !body.data_inizio || !body.data_fine || body.price_per_person == null) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
    }
    if (body.data_fine < body.data_inizio) {
      return NextResponse.json({ error: 'La data fine non può precedere la data inizio' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('prezzi_speciali')
      .insert({
        nome: body.nome,
        service_id: body.service_id,
        boat_id: body.boat_id || null,
        data_inizio: body.data_inizio,
        data_fine: body.data_fine,
        price_per_person: Number(body.price_per_person),
        is_active: body.is_active ?? true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT — modifica un prezzo speciale (id nel body)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })

    const update: any = {}
    for (const f of ['nome', 'service_id', 'boat_id', 'data_inizio', 'data_fine', 'is_active']) {
      if (body[f] !== undefined) update[f] = body[f]
    }
    if (body.boat_id !== undefined) update.boat_id = body.boat_id || null
    if (body.price_per_person !== undefined) update.price_per_person = Number(body.price_per_person)

    const { data, error } = await supabaseAdmin
      .from('prezzi_speciali')
      .update(update)
      .eq('id', body.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — elimina un prezzo speciale (?id=...)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })

    const { error } = await supabaseAdmin.from('prezzi_speciali').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}