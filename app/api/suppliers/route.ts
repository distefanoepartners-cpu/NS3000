import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista tutti i fornitori
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .order('name')

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Errore caricamento fornitori:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea nuovo fornitore
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .insert([body])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Errore creazione fornitore:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}