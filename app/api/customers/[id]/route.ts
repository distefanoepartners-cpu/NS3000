import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Singolo cliente
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('[Customers API] GET error:', error)
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Customers API] Error fetching customer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Aggiorna cliente
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()

    console.log('[Customers API] Updating customer:', params.id, body)

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(body)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) {
      console.error('[Customers API] Update error:', error)
      throw error
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Customers API] Error updating customer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina cliente
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    console.log('[Customers API] Deleting customer:', params.id)

    // Prima verifica che il cliente esista
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', params.id)
      .single()

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
    }

    // Elimina il cliente
    const { error } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('[Customers API] Delete error:', error)
      
      // Se è un errore di foreign key
      if (error.code === '23503') {
        return NextResponse.json({ 
          error: 'Impossibile eliminare: il cliente ha prenotazioni associate' 
        }, { status: 400 })
      }
      
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Customers API] Error deleting customer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}