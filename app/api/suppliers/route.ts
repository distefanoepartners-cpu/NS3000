import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista tutti i fornitori
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  
  let query = supabaseAdmin
    .from('supplier_statements')
    .select('*')
    .order('generated_at', { ascending: false })
  
  if (month) {
    const [year, monthNum] = month.split('-')
    const start = `${year}-${monthNum}-01`
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate()
    const end = `${year}-${monthNum}-${lastDay}`
    
    query = query.gte('period_start', start).lte('period_end', end)
  }
  
  const { data, error } = await query
  // ... resto del codice
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  
  const { data, error } = await supabaseAdmin
    .from('supplier_statements')
    .update({ status: body.status })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return NextResponse.json(data)
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}