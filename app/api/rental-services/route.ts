import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista tutti i servizi noleggio
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('rental_services')
      .select('*')
      .order('name')

    if (error) {
      console.error('[Rental Services API] GET error:', error)
      throw error
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[Rental Services API] Error fetching services:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea nuovo servizio
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('rental_services')
      .insert([body])
      .select('*')
      .single()

    if (error) {
      console.error('[Rental Services API] POST error:', error)
      throw error
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Rental Services API] Error creating service:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}