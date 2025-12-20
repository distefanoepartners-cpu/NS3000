import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Opzioni per form prenotazione
export async function GET() {
  try {
    const [customers, boats, services, suppliers, ports, timeSlots, statuses] = await Promise.all([
      supabaseAdmin.from('customers').select('id, first_name, last_name').order('last_name'),
      supabaseAdmin.from('boats').select(`
        id, 
        name,
        price_low_season_half_day,
        price_low_season_full_day,
        price_low_season_week,
        price_july_half_day,
        price_july_full_day,
        price_july_week,
        price_august_half_day,
        price_august_full_day,
        price_august_week,
        price_september_half_day,
        price_september_full_day,
        price_september_week
      `).eq('is_active', true).order('name'),
      supabaseAdmin.from('services').select('id, name, type').eq('is_active', true).order('name'),
      supabaseAdmin.from('suppliers').select('id, name').eq('is_active', true).order('name'),
      supabaseAdmin.from('ports').select('id, name, code').eq('is_active', true).order('name'),
      supabaseAdmin.from('time_slots').select('id, name, start_time, end_time').eq('is_active', true).order('start_time'),
      supabaseAdmin.from('booking_statuses').select('id, name, code').order('sort_order'),
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}