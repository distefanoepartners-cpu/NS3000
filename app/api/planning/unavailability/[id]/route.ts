import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// DELETE - Rimuovi blocco indisponibilità
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabaseAdmin
      .from('boat_unavailability')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Errore rimozione blocco:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}