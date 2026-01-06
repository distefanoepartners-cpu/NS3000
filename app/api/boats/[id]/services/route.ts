import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Servizi di una barca specifica
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    // Prendi servizi con prezzi associati alla barca
    const { data, error } = await supabaseAdmin
      .from('boat_rental_services')
      .select(`
        *,
        rental_services (*)
      `)
      .eq('boat_id', params.id)
      .eq('is_active', true)

    if (error) {
      console.error('[Boat Services API] GET error:', error)
      throw error
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[Boat Services API] Error fetching boat services:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Aggiorna servizi di una barca
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const { services } = body // Array di { service_id, prices }

    console.log('[Boat Services API] Updating services for boat:', params.id)

    // 1. Elimina tutti i servizi esistenti
    await supabaseAdmin
      .from('boat_rental_services')
      .delete()
      .eq('boat_id', params.id)

    // 2. Inserisci nuovi servizi con prezzi
    if (services && services.length > 0) {
      const servicesToInsert = services.map((s: any) => ({
        boat_id: params.id,
        service_id: s.service_id,
        is_active: true,
        price_apr_may_oct: s.price_apr_may_oct || null,
        price_june: s.price_june || null,
        price_july_sept: s.price_july_sept || null,
        price_august: s.price_august || null
      }))

      const { error } = await supabaseAdmin
        .from('boat_rental_services')
        .insert(servicesToInsert)

      if (error) {
        console.error('[Boat Services API] Insert error:', error)
        throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Boat Services API] Error updating boat services:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}