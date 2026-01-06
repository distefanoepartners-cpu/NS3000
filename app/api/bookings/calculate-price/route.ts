import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function POST(request: Request) {
  try {
    const { boat_id, service_id, booking_date, num_passengers } = await request.json()

    console.log('[Calculate Price] Request:', { boat_id, service_id, booking_date, num_passengers })

    if (!boat_id || !service_id || !booking_date) {
      return NextResponse.json({ 
        error: 'boat_id, service_id e booking_date sono obbligatori' 
      }, { status: 400 })
    }

    // Chiama la funzione PostgreSQL con num_passengers
    const { data, error } = await supabaseAdmin
      .rpc('get_service_price', {
        p_boat_id: boat_id,
        p_service_id: service_id,
        p_booking_date: booking_date,
        p_num_passengers: num_passengers || 1
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
      booking_date,
      num_passengers
    })
  } catch (error: any) {
    console.error('[Calculate Price] Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Errore calcolo prezzo' 
    }, { status: 500 })
  }
}