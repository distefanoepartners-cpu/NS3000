import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function GET(request: Request) {
  try {
    // Carica tutte le opzioni in parallelo
    const [
      customersRes,
      boatsRes,
      servicesRes,
      timeSlotsRes,
      paymentMethodsRes,
      bookingStatusesRes
    ] = await Promise.all([
      supabaseAdmin.from('customers').select('*').order('last_name'),
      supabaseAdmin.from('boats').select('*').order('name'),
      supabaseAdmin.from('rental_services').select('*').order('name'), // 🆕 CAMBIATO
      supabaseAdmin.from('time_slots').select('*').order('start_time'),
      supabaseAdmin.from('payment_methods').select('*').order('name'),
      supabaseAdmin.from('booking_statuses').select('*').order('name')
    ])

    const options = {
      customers: customersRes.data || [],
      boats: boatsRes.data || [],
      services: servicesRes.data || [],
      timeSlots: timeSlotsRes.data || [],
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
      timeSlots: [],
      paymentMethods: [],
      bookingStatuses: []
    })
  }
} 