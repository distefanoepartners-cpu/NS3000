import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('skippers')
      .select('*')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching skippers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('skippers')
      .insert([body])
      .select()

    if (error) throw error

    return NextResponse.json(data[0])
  } catch (error: any) {
    console.error('Error creating skipper:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
