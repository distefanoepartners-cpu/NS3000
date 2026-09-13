// app/api/customers/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// ⭐ 2026-05-22: Whitelist colonne REALI della tabella `customers` (Supabase).
// Qualunque campo non in questa lista viene scartato silenziosamente.
// Questo protegge da client legacy che inviano nomi colonna obsoleti
// (es. has_license/license_number/license_expiry rimossi dallo schema).
const CUSTOMERS_COLUMNS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'document_type',
  'document_number',
  'document_expiry',
  'has_boat_license',
  'boat_license_number',
  'boat_license_expiry',
  'notes',
  'nationality',
] as const

/**
 * sanitizeCustomerPayload
 * -----------------------
 * 1. Mappa campi legacy ai nomi reali dello schema:
 *    - has_license          → has_boat_license
 *    - license_number       → boat_license_number
 *    - license_expiry       → boat_license_expiry
 * 2. Mantiene SOLO le colonne presenti in CUSTOMERS_COLUMNS.
 * 3. Normalizza stringhe vuote a null per i campi DATE (Supabase rifiuta '').
 */
function sanitizeCustomerPayload(body: any): Record<string, any> {
  const clean: Record<string, any> = {}

  // Step 1: mapping legacy → schema attuale (priorità ai nomi nuovi se entrambi presenti)
  const merged = { ...body }
  if (merged.has_license !== undefined && merged.has_boat_license === undefined) {
    merged.has_boat_license = merged.has_license
  }
  if (merged.license_number !== undefined && merged.boat_license_number === undefined) {
    merged.boat_license_number = merged.license_number
  }
  if (merged.license_expiry !== undefined && merged.boat_license_expiry === undefined) {
    merged.boat_license_expiry = merged.license_expiry
  }

  // Step 2: whitelist — copia solo le colonne reali
  for (const col of CUSTOMERS_COLUMNS) {
    if (merged[col] !== undefined) {
      clean[col] = merged[col]
    }
  }

  // Step 3: date → null se vuote (Supabase non accetta '' per type date)
  const dateFields = ['document_expiry', 'boat_license_expiry'] as const
  for (const f of dateFields) {
    if (clean[f] === '' || clean[f] === undefined) {
      clean[f] = null
    }
  }

  // Step 4: stringhe vuote → null per campi opzionali (più pulito in DB)
  const nullableStrings = ['email', 'phone', 'document_type', 'document_number',
                           'boat_license_number', 'notes', 'nationality'] as const
  for (const f of nullableStrings) {
    if (clean[f] === '') clean[f] = null
  }

  // Step 5: has_boat_license deve essere boolean (non stringa)
  if (clean.has_boat_license !== undefined) {
    clean.has_boat_license = !!clean.has_boat_license
  }

  return clean
}

// GET - Lista tutti i clienti
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea nuovo cliente
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const clean = sanitizeCustomerPayload(body)

    // Validazione minima
    if (!clean.first_name || !clean.last_name) {
      return NextResponse.json(
        { error: 'first_name e last_name sono obbligatori' },
        { status: 400 }
      )
    }

    console.log('📥 POST /api/customers — payload sanitizzato:', clean)

    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert([clean])
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase error POST /api/customers:', error)
      throw error
    }

    console.log('✅ Cliente creato:', data.id, `${data.first_name} ${data.last_name}`)
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}