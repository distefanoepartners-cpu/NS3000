import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Lista partner
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('partners')
      .select('*')
      .order('name')

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching partners:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea partner
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Valida codice univoco
    if (!body.code || !body.name) {
      return NextResponse.json({ error: 'Codice e Nome sono obbligatori' }, { status: 400 })
    }

    // Normalizza codice: uppercase, no spazi
    const code = body.code.toUpperCase().replace(/[^A-Z0-9\-]/g, '')

    // Verifica unicità
    const { data: existing } = await supabaseAdmin
      .from('partners')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: `Il codice "${code}" è già in uso` }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('partners')
      .insert({
        code,
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
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error creating partner:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}