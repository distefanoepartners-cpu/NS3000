import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function GET() {
  try {
    const [customers, boats, services, suppliers, ports, timeSlots, statuses] = await Promise.all([
      supabaseAdmin.from('customers').select('id, first_name, last_name').order('last_name'),
      supabaseAdmin.from('boats').select(`
        id, 
        name,
        has_rental,
        has_charter,
        price_rental_apr_may_oct_half_day,
        price_rental_apr_may_oct_full_day,
        price_rental_apr_may_oct_week,
        price_rental_june_half_day,
        price_rental_june_full_day,
        price_rental_june_week,
        price_rental_july_sept_half_day,
        price_rental_july_sept_full_day,
        price_rental_july_sept_week,
        price_rental_august_half_day,
        price_rental_august_full_day,
        price_rental_august_week,
        price_charter_apr_may_oct_half_day,
        price_charter_apr_may_oct_full_day,
        price_charter_apr_may_oct_week,
        price_charter_june_half_day,
        price_charter_june_full_day,
        price_charter_june_week,
        price_charter_july_sept_half_day,
        price_charter_july_sept_full_day,
        price_charter_july_sept_week,
        price_charter_august_half_day,
        price_charter_august_full_day,
        price_charter_august_week
      `).eq('is_active', true).order('name'),
      supabaseAdmin.from('services').select('id, name, type, price_per_person, is_collective_tour').order('name'),
      supabaseAdmin.from('suppliers').select('id, name').order('name'),
      supabaseAdmin.from('ports').select('id, name, code').order('name'),
      supabaseAdmin.from('time_slots').select('id, name, start_time, end_time').order('start_time'),
      supabaseAdmin.from('booking_statuses').select('id, name, code').order('name')
    ])

    return NextResponse.json({
      customers: customers.data || [],
      boats: boats.data || [],
      services: services.data || [],
      suppliers: suppliers.data || [],
      ports: ports.data || [],
      timeSlots: timeSlots.data || [],
      statuses: statuses.data || []
    })
  } catch (error: any) {
    console.error('Errore caricamento opzioni:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}