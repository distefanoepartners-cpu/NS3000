import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista tutti i servizi
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('rental_services')
      .select('*')
      .order('name')

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching services:', error)
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

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error creating service:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}