import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Singola indisponibilità
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('unavailabilities')
      .select(`
        *,
        boat:boats(id, name, boat_type)
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching unavailability:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Aggiorna indisponibilità
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('unavailabilities')
      .update({
        boat_id: body.boat_id,
        date_from: body.date_from,
        date_to: body.date_to,
        reason: body.reason || null,
        notes: body.notes || null
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating unavailability:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina indisponibilità
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabaseAdmin
      .from('unavailabilities')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting unavailability:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}