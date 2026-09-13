import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// PUT - Aggiorna partner
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()

    const code = body.code ? body.code.toUpperCase().replace(/[^A-Z0-9\-]/g, '') : undefined

    // Verifica unicità codice (escluso se stesso)
    if (code) {
      const { data: existing } = await supabaseAdmin
        .from('partners')
        .select('id')
        .eq('code', code)
        .neq('id', params.id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: `Il codice "${code}" è già in uso` }, { status: 409 })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('partners')
      .update({
        ...(code && { code }),
        name: body.name,
        contact_name: body.contact_name || null,
        email: body.email || null,
        phone: body.phone || null,
        website: body.website || null,
        commission_percentage: body.commission_percentage ?? 10,
        commission_fixed: body.commission_fixed ?? 0,
        commission_type: body.commission_type || 'percentage',
        is_active: body.is_active ?? true,
        notes: body.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating partner:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina partner
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    const { error } = await supabaseAdmin
      .from('partners')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting partner:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}