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

    console.log('[Boat Services API] GET - Trovati servizi:', data?.length || 0)
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

    console.log('[Boat Services API] 🔄 POST - Updating services for boat:', params.id)
    console.log('[Boat Services API] 📥 Services ricevuti dal frontend:', services?.length || 0)
    console.log('[Boat Services API] 📥 Services to save:', JSON.stringify(services, null, 2))

    // 1. Elimina tutti i servizi esistenti
    console.log('[Boat Services API] 🗑️ Elimino servizi esistenti...')
    const { error: deleteError } = await supabaseAdmin
      .from('boat_rental_services')
      .delete()
      .eq('boat_id', params.id)
    
    if (deleteError) {
      console.error('[Boat Services API] ❌ Errore eliminazione:', deleteError)
      throw deleteError
    }
    console.log('[Boat Services API] ✅ Servizi esistenti eliminati')

    // 2. Inserisci nuovi servizi con prezzi
    if (services && services.length > 0) {
      const servicesToInsert = services.map((s: any) => ({
        boat_id: params.id,
        service_id: s.service_id,
        is_active: true,
        // ⭐ SUPPORTA SIA VECCHIO FORMATO (4 campi) CHE NUOVO (8 campi)
        // Vecchio formato (per compatibilità) - TOUR usano questi
        price_apr_may_oct: s.price_apr_may_oct || null,
        price_june: s.price_june || null,
        price_july_sept: s.price_july_sept || null,
        price_august: s.price_august || null,
        // ⭐ NUOVO: Campi full_day e half_day - LOCAZIONE usa questi
        // Se arriva solo il vecchio formato, lo copia anche in _full_day
        price_apr_may_oct_full_day: s.price_apr_may_oct_full_day || s.price_apr_may_oct || null,
        price_apr_may_oct_half_day: s.price_apr_may_oct_half_day || null,
        price_june_full_day: s.price_june_full_day || s.price_june || null,
        price_june_half_day: s.price_june_half_day || null,
        price_july_sept_full_day: s.price_july_sept_full_day || s.price_july_sept || null,
        price_july_sept_half_day: s.price_july_sept_half_day || null,
        price_august_full_day: s.price_august_full_day || s.price_august || null,
        price_august_half_day: s.price_august_half_day || null,
      }))

      console.log('[Boat Services API] 📤 Inserting nel database:', servicesToInsert.length, 'servizi')
      console.log('[Boat Services API] 📤 Dati completi:', JSON.stringify(servicesToInsert, null, 2))

      const { error: insertError, data: insertedData } = await supabaseAdmin
        .from('boat_rental_services')
        .insert(servicesToInsert)
        .select()

      if (insertError) {
        console.error('[Boat Services API] ❌ Errore insert:', insertError)
        throw insertError
      }
      
      console.log('[Boat Services API] ✅ Servizi salvati con successo! Inseriti:', insertedData?.length || 0)
      console.log('[Boat Services API] ✅ Servizi inseriti:', JSON.stringify(insertedData, null, 2))
    } else {
      console.log('[Boat Services API] ℹ️ Nessun servizio da inserire (array vuoto)')
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Boat Services API] ❌ Error updating boat services:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}