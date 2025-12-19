import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Singola barca
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }  // ← Promise qui
) {
  try {
    const { id } = await params  // ← await qui
    
    const { data, error } = await supabaseAdmin
      .from('boats')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Aggiorna barca
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }  // ← Promise qui
) {
  try {
    const { id } = await params  // ← await qui
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('boats')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina barca
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }  // ← Promise qui
) {
  try {
    const { id } = await params  // ← await qui
    
    const { error } = await supabaseAdmin
      .from('boats')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}