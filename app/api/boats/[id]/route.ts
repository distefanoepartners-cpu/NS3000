import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { data, error } = await supabaseAdmin
      .from('boats')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log('PUT boats - ID:', id)
    console.log('PUT boats - Body:', body)

    // 1. Aggiorna la tabella boats
    const { data, error } = await supabaseAdmin
      .from('boats')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    console.log('Supabase result - data:', data)
    console.log('Supabase result - error:', error)

    if (error) {
      console.error('Supabase error detail:', JSON.stringify(error, null, 2))
      throw error
    }

    // 2. ⭐ Sincronizza LOCAZIONE in boat_rental_services
    if (body.has_rental && (
      body.price_charter_apr_may_oct_half_day !== undefined ||
      body.price_charter_apr_may_oct_full_day !== undefined ||
      body.price_charter_june_half_day !== undefined ||
      body.price_charter_june_full_day !== undefined ||
      body.price_charter_july_sept_half_day !== undefined ||
      body.price_charter_july_sept_full_day !== undefined ||
      body.price_charter_august_half_day !== undefined ||
      body.price_charter_august_full_day !== undefined
    )) {
      console.log('🔄 Sincronizzazione prezzi LOCAZIONE...')
      
      // Trova il service_id per "Locazione"
      const { data: rentalService } = await supabaseAdmin
        .from('rental_services')
        .select('id')
        .eq('service_type', 'rental')
        .single()

      if (rentalService) {
        const serviceId = rentalService.id
        console.log('📋 Service ID Locazione:', serviceId)

        // Verifica se esiste già una riga in boat_rental_services
        const { data: existing } = await supabaseAdmin
          .from('boat_rental_services')
          .select('id')
          .eq('boat_id', id)
          .eq('service_id', serviceId)
          .single()

        const rentalPrices = {
          boat_id: id,
          service_id: serviceId,
          is_active: true,
          price_apr_may_oct_full_day: body.price_charter_apr_may_oct_full_day ?? null,
          price_apr_may_oct_half_day: body.price_charter_apr_may_oct_half_day ?? null,
          price_june_full_day: body.price_charter_june_full_day ?? null,
          price_june_half_day: body.price_charter_june_half_day ?? null,
          price_july_sept_full_day: body.price_charter_july_sept_full_day ?? null,
          price_july_sept_half_day: body.price_charter_july_sept_half_day ?? null,
          price_august_full_day: body.price_charter_august_full_day ?? null,
          price_august_half_day: body.price_charter_august_half_day ?? null,
        }

        if (existing) {
          // Aggiorna
          console.log('🔄 Aggiorno boat_rental_services LOCAZIONE')
          const { error: updateError } = await supabaseAdmin
            .from('boat_rental_services')
            .update(rentalPrices)
            .eq('id', existing.id)

          if (updateError) {
            console.error('❌ Errore update locazione:', updateError)
          } else {
            console.log('✅ Prezzi locazione aggiornati!')
          }
        } else {
          // Inserisci
          console.log('➕ Creo nuova riga boat_rental_services LOCAZIONE')
          const { error: insertError } = await supabaseAdmin
            .from('boat_rental_services')
            .insert([rentalPrices])

          if (insertError) {
            console.error('❌ Errore insert locazione:', insertError)
          } else {
            console.log('✅ Prezzi locazione creati!')
          }
        }
      } else {
        console.warn('⚠️ Servizio "Locazione" non trovato')
      }
    }

    // 3. ⭐ Sincronizza TOUR/CHARTER in boat_rental_services
    if ((body.has_charter || body.has_collective) && (
      body.price_charter_apr_may_oct_half_day !== undefined ||
      body.price_charter_apr_may_oct_full_day !== undefined ||
      body.price_charter_june_half_day !== undefined ||
      body.price_charter_june_full_day !== undefined ||
      body.price_charter_july_sept_half_day !== undefined ||
      body.price_charter_july_sept_full_day !== undefined ||
      body.price_charter_august_half_day !== undefined ||
      body.price_charter_august_full_day !== undefined
    )) {
      console.log('🔄 Sincronizzazione prezzi TOUR...')
      
      // Trova tutti i servizi di tipo 'tour' attivi
      const { data: tourServices } = await supabaseAdmin
        .from('rental_services')
        .select('id, name')
        .eq('service_type', 'tour')
        .eq('is_active', true)
      
      console.log('📋 Servizi tour trovati:', tourServices?.length || 0)
      
      if (tourServices && tourServices.length > 0) {
        // Per ogni servizio tour, crea/aggiorna i prezzi
        for (const tourService of tourServices) {
          const serviceId = tourService.id
          
          console.log(`🎯 Processing tour: ${tourService.name}`)
          
          // Verifica se esiste già
          const { data: existing } = await supabaseAdmin
            .from('boat_rental_services')
            .select('id')
            .eq('boat_id', id)
            .eq('service_id', serviceId)
            .single()
          
          const tourPrices = {
            boat_id: id,
            service_id: serviceId,
            is_active: true,
            price_apr_may_oct_full_day: body.price_charter_apr_may_oct_full_day ?? null,
            price_apr_may_oct_half_day: body.price_charter_apr_may_oct_half_day ?? null,
            price_june_full_day: body.price_charter_june_full_day ?? null,
            price_june_half_day: body.price_charter_june_half_day ?? null,
            price_july_sept_full_day: body.price_charter_july_sept_full_day ?? null,
            price_july_sept_half_day: body.price_charter_july_sept_half_day ?? null,
            price_august_full_day: body.price_charter_august_full_day ?? null,
            price_august_half_day: body.price_charter_august_half_day ?? null,
          }
          
          if (existing) {
            // Aggiorna
            console.log(`🔄 Aggiorno prezzi tour: ${tourService.name}`)
            const { error: updateError } = await supabaseAdmin
              .from('boat_rental_services')
              .update(tourPrices)
              .eq('id', existing.id)
            
            if (updateError) {
              console.error(`❌ Errore update tour ${tourService.name}:`, updateError)
            } else {
              console.log(`✅ Prezzi tour ${tourService.name} aggiornati!`)
            }
          } else {
            // Inserisci
            console.log(`➕ Creo prezzi tour: ${tourService.name}`)
            const { error: insertError } = await supabaseAdmin
              .from('boat_rental_services')
              .insert([tourPrices])
            
            if (insertError) {
              console.error(`❌ Errore insert tour ${tourService.name}:`, insertError)
            } else {
              console.log(`✅ Prezzi tour ${tourService.name} creati!`)
            }
          }
        }
      }
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('PUT boats error:', error)
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { error } = await supabaseAdmin
      .from('boats')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}