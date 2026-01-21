import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function GET(request: Request) {
  try {
    // Carica tutte le opzioni in parallelo (SENZA time_slots)
    const [
      customersRes,
      boatsRes,
      servicesRes,
      paymentMethodsRes,
      bookingStatusesRes
    ] = await Promise.all([
      supabaseAdmin.from('customers').select('*').order('last_name'),
      supabaseAdmin.from('boats').select('*').order('name'),
      supabaseAdmin.from('rental_services').select('*').order('name'),
      supabaseAdmin.from('payment_methods').select('*').order('name'),
      supabaseAdmin.from('booking_statuses').select('*').order('name')
    ])

    const options = {
      customers: customersRes.data || [],
      boats: boatsRes.data || [],
      services: servicesRes.data || [],
      paymentMethods: paymentMethodsRes.data || [],
      bookingStatuses: bookingStatusesRes.data || []
    }

    return NextResponse.json(options)
  } catch (error: any) {
    console.error('Error loading options:', error)
    return NextResponse.json({
      customers: [],
      boats: [],
      services: [],
      paymentMethods: [],
      bookingStatuses: []
    }, { status: 500 })
  }
}