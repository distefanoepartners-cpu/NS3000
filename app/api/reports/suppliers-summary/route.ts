import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// GET - Riepilogo per fornitore con breakdown mensile
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supplier_id = searchParams.get('supplier_id')
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    
    // Se c'è supplier_id, mostra solo quel fornitore
    let suppliersQuery = supabaseAdmin
      .from('suppliers')
      .select('id, name, email, commission_percentage')
      .eq('is_active', true)
    
    if (supplier_id) {
      suppliersQuery = suppliersQuery.eq('id', supplier_id)
    }
    
    const { data: suppliers, error: suppliersError } = await suppliersQuery
    
    if (suppliersError) throw suppliersError
    
    // Per ogni fornitore, calcola totali anno e breakdown mensile
    const results = await Promise.all(
      suppliers.map(async (supplier) => {
        // Prenotazioni dell'anno per questo fornitore
        const { data: bookings, error: bookingsError } = await supabaseAdmin
          .from('bookings')
          .select('id, booking_date, final_price, booking_number')
          .eq('supplier_id', supplier.id)
          .gte('booking_date', `${year}-01-01`)
          .lte('booking_date', `${year}-12-31`)
        
        if (bookingsError) throw bookingsError
        
        // Calcola totali anno
        const totalBookings = bookings?.length || 0
        const totalRevenue = bookings?.reduce((sum, b) => sum + (b.final_price || 0), 0) || 0
        const totalCommission = (totalRevenue * supplier.commission_percentage) / 100
        
        // Raggruppa per mese
        const monthlyBreakdown: any = {}
        
        bookings?.forEach((booking) => {
          const month = booking.booking_date.substring(0, 7) // YYYY-MM
          
          if (!monthlyBreakdown[month]) {
            monthlyBreakdown[month] = {
              month,
              bookings: 0,
              revenue: 0,
              commission: 0,
              booking_details: []
            }
          }
          
          monthlyBreakdown[month].bookings += 1
          monthlyBreakdown[month].revenue += booking.final_price || 0
          monthlyBreakdown[month].commission = (monthlyBreakdown[month].revenue * supplier.commission_percentage) / 100
          monthlyBreakdown[month].booking_details.push({
            id: booking.id,
            booking_number: booking.booking_number,
            booking_date: booking.booking_date,
            final_price: booking.final_price
          })
        })
        
        // Converti in array e ordina per mese
        const monthly = Object.values(monthlyBreakdown).sort((a: any, b: any) => 
          b.month.localeCompare(a.month)
        )
        
        return {
          supplier: {
            id: supplier.id,
            name: supplier.name,
            email: supplier.email,
            commission_percentage: supplier.commission_percentage
          },
          year,
          total_bookings: totalBookings,
          total_revenue: totalRevenue,
          total_commission: totalCommission,
          monthly
        }
      })
    )
    
    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Error getting supplier summary:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
