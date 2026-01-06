import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function POST(request: Request) {
  try {
    const { boat_id, service_id, booking_date } = await request.json()

    console.log('[Calculate Price] Request:', { boat_id, service_id, booking_date })

    if (!boat_id || !service_id || !booking_date) {
      return NextResponse.json({ 
        error: 'boat_id, service_id e booking_date sono obbligatori' 
      }, { status: 400 })
    }

    // Chiama la funzione PostgreSQL
    const { data, error } = await supabaseAdmin
      .rpc('get_service_price', {
        p_boat_id: boat_id,
        p_service_id: service_id,
        p_booking_date: booking_date
      })

    if (error) {
      console.error('[Calculate Price] Error:', error)
      throw error
    }

    console.log('[Calculate Price] Result:', data)

    return NextResponse.json({ 
      price: data,
      boat_id,
      service_id,
      booking_date
    })
  } catch (error: any) {
    console.error('[Calculate Price] Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Errore calcolo prezzo' 
    }, { status: 500 })
  }
}