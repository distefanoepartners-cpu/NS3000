// app/api/collective-tour-boats/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('collective_tour_boats')
      .select('*')
      .eq('is_active', true)

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching collective_tour_boats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}