import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

export async function GET(request: Request) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Carica tutte le prenotazioni
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('*')

    if (error) throw error

    // Calcola statistiche
    const stats = {
      // Ricavi oggi
      ricavi_oggi: bookings
        ?.filter(b => b.booking_date === today)
        .reduce((sum, b) => sum + (b.deposit_amount || 0) + (b.balance_amount || 0), 0) || 0,

      // Ricavi ultima settimana
      ricavi_settimana: bookings
        ?.filter(b => b.booking_date >= weekAgo)
        .reduce((sum, b) => sum + (b.deposit_amount || 0) + (b.balance_amount || 0), 0) || 0,

      // Ricavi ultimo mese
      ricavi_mese: bookings
        ?.filter(b => b.booking_date >= monthAgo)
        .reduce((sum, b) => sum + (b.deposit_amount || 0) + (b.balance_amount || 0), 0) || 0,

      // Totale incassato (tutto lo storico)
      totale_incassato: bookings
        ?.reduce((sum, b) => sum + (b.deposit_amount || 0) + (b.balance_amount || 0), 0) || 0,

      // Totale da incassare
      totale_da_incassare: bookings
        ?.reduce((sum, b) => {
          const totale = b.final_price || 0
          const ricevuto = (b.deposit_amount || 0) + (b.balance_amount || 0)
          const daRicevere = Math.max(0, totale - ricevuto)
          return sum + daRicevere
        }, 0) || 0,

      // Conteggi
      totale_prenotazioni: bookings?.length || 0,

      prenotazioni_confermate: bookings
        ?.filter(b => {
          // Cerca booking_status tramite JOIN o carica separatamente
          // Per ora usiamo un conteggio semplice
          return true // TODO: filtrare per stato confermato
        }).length || 0,

      prenotazioni_pagate: bookings
        ?.filter(b => {
          const totale = b.final_price || 0
          const ricevuto = (b.deposit_amount || 0) + (b.balance_amount || 0)
          return ricevuto >= totale
        }).length || 0
    }

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Error calculating stats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}