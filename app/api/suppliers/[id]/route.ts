import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Ottieni singolo fornitore
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore caricamento fornitore:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Aggiorna fornitore
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .update({
        name: body.name,
        type: body.type,
        commission_percentage: body.commission_percentage,
        contact_person: body.contact_person,
        email: body.email,
        phone: body.phone,
        notes: body.notes,
        is_active: body.is_active !== undefined ? body.is_active : true
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Errore aggiornamento fornitore:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina fornitore
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { error } = await supabaseAdmin
      .from('suppliers')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Errore eliminazione fornitore:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
