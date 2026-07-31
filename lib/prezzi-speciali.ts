// lib/prezzi-speciali.ts
// Logica centralizzata per il calcolo del prezzo con date speciali (Ferragosto, ecc.)
// Usata dalla route API e (concettualmente replicata) dal plugin WordPress.

import { supabaseAdmin } from '@/lib/supabase-client'

export interface PrezzoSpeciale {
  id: string
  nome: string
  service_id: string
  boat_id: string | null
  data_inizio: string
  data_fine: string
  price_per_person: number
  is_active: boolean
}

/**
 * Restituisce il prezzo per persona speciale se la data ricade in un periodo
 * speciale attivo per il servizio (ed eventualmente la barca), altrimenti null.
 *
 * @param serviceId  uuid del servizio
 * @param boatId     uuid della barca (null per tour collettivi)
 * @param date       data del servizio in formato 'YYYY-MM-DD'
 * @returns          prezzo speciale per persona, oppure null se non applicabile
 */
export async function getPrezzoSpeciale(
  serviceId: string,
  boatId: string | null,
  date: string
): Promise<number | null> {
  if (!serviceId || !date) return null

  let query = supabaseAdmin
    .from('prezzi_speciali')
    .select('price_per_person, boat_id')
    .eq('service_id', serviceId)
    .eq('is_active', true)
    .lte('data_inizio', date)
    .gte('data_fine', date)

  const { data, error } = await query
  if (error || !data || data.length === 0) return null

  // Match sulla barca: per tour privati cerca la riga con boat_id uguale;
  // per collettivi (boatId null) cerca la riga con boat_id null.
  const match = data.find((r: any) =>
    boatId ? r.boat_id === boatId : r.boat_id === null
  )

  // Fallback: se non c'è un match specifico per barca ma esiste una riga
  // "generica" (boat_id null) per quel servizio, la usa comunque.
  const generic = data.find((r: any) => r.boat_id === null)

  const chosen = match || generic
  return chosen ? Number(chosen.price_per_person) : null
}