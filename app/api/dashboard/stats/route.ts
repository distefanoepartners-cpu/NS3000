import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()

    // Prenotazioni oggi
    const { count: bookingsToday } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('booking_date', today)

    // Barche attive e totali
    const { data: boats } = await supabaseAdmin
      .from('boats')
      .select('is_active')
    
    const totalBoats = boats?.length || 0
    const activeBoats = boats?.filter(b => b.is_active).length || 0

    // Fatturato mese corrente
    const { data: monthlyBookings } = await supabaseAdmin
      .from('bookings')
      .select('final_price')
      .gte('booking_date', startOfMonth)
      .lte('booking_date', endOfMonth)
    
    const monthlyRevenue = monthlyBookings?.reduce((sum, b) => sum + (b.final_price || 0), 0) || 0

    // Tasso occupazione (calcolo semplificato)
    const { count: totalBookingsMonth } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('booking_date', startOfMonth)
      .lte('booking_date', endOfMonth)
    
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const maxPossibleBookings = totalBoats * daysInMonth
    const occupancyRate = maxPossibleBookings > 0 
      ? Math.round(((totalBookingsMonth || 0) / maxPossibleBookings) * 100)
      : 0

    // Contatori generali
    const { count: totalCustomers } = await supabaseAdmin
      .from('customers')
      .select('*', { count: 'exact', head: true })

    const { count: totalSuppliers } = await supabaseAdmin
      .from('suppliers')
      .select('*', { count: 'exact', head: true })

    const { count: totalServices } = await supabaseAdmin
      .from('services')
      .select('*', { count: 'exact', head: true })

    const { count: totalBookings } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      bookingsToday: bookingsToday || 0,
      activeBoats,
      totalBoats,
      monthlyRevenue,
      occupancyRate,
      totalCustomers: totalCustomers || 0,
      totalSuppliers: totalSuppliers || 0,
      totalServices: totalServices || 0,
      totalBookings: totalBookings || 0
    })
  } catch (error: any) {
    console.error('Errore dashboard stats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}