import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// POST - Crea blocco indisponibilità
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('boat_unavailability')
      .insert({
        boat_id: body.boat_id,
        start_date: body.start_date,
        end_date: body.end_date,
        reason: body.reason
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore creazione blocco:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}