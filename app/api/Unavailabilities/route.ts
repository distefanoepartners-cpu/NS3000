import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista indisponibilità (con filtro date opzionale)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    let query = supabaseAdmin
      .from('unavailabilities')
      .select(`
        *,
        boat:boats(id, name, boat_type)
      `)
      .order('date_from', { ascending: true })

    // Filtro per range date se fornito
    if (start && end) {
      query = query
      .or(`date_from.lte.${end},date_to.gte.${start}`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching unavailabilities:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea nuova indisponibilità
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('unavailabilities')
      .insert({
        boat_id: body.boat_id,
        date_from: body.date_from,
        date_to: body.date_to,
        reason: body.reason || null,
        notes: body.notes || null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error creating unavailability:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}