// app/api/partners/create-account/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import bcrypt from 'bcryptjs'

/**
 * POST /api/partners/create-account
 * Crea un account utente per un fornitore/partner esistente
 * Solo admin può chiamare questa API
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { supplier_id, email, password, full_name } = body

    if (!supplier_id || !email || !password) {
      return NextResponse.json({ 
        error: 'supplier_id, email e password sono obbligatori' 
      }, { status: 400 })
    }

    // 1. Verifica che il supplier esista
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from('suppliers')
      .select('id, name, partner_code, is_partner')
      .eq('id', supplier_id)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
    }

    // 2. Verifica che non esista già un account per questo supplier
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('supplier_id', supplier_id)
      .single()

    if (existingUser) {
      return NextResponse.json({ 
        error: `Esiste già un account per questo partner (${existingUser.email})` 
      }, { status: 409 })
    }

    // 3. Verifica che l'email non sia già in uso
    const { data: existingEmail } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingEmail) {
      return NextResponse.json({ 
        error: 'Questa email è già associata a un altro account' 
      }, { status: 409 })
    }

    // 4. Hash password
    const password_hash = await bcrypt.hash(password, 12)

    // 5. Genera codice partner se non presente
    let partnerCode = supplier.partner_code
    if (!partnerCode) {
      const { data: codeResult } = await supabaseAdmin
        .rpc('generate_partner_code')
      partnerCode = codeResult
    }

    // 6. Crea utente con ruolo partner
    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password_hash,
        full_name: full_name || supplier.name,
        role: 'partner',
        supplier_id: supplier_id,
        is_active: true
      })
      .select('id, email, full_name, role, supplier_id')
      .single()

    if (userError) throw userError

    // 7. Aggiorna supplier: flag is_partner + codice
    const { error: updateError } = await supabaseAdmin
      .from('suppliers')
      .update({ 
        is_partner: true,
        partner_code: partnerCode
      })
      .eq('id', supplier_id)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      user: newUser,
      partner_code: partnerCode,
      message: `Account partner creato per ${supplier.name}`
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating partner account:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}