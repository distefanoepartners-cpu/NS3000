import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Carica .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Blu Alliance Source
const bluAllianceUrl = 'https://wpzxvwenhjqnwhqowxms.supabase.co'
const bluAllianceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwenh2d2VuaGpxbndocW93eG1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU1NTIzNCwiZXhwIjoyMDc5MTMxMjM0fQ.lH5HStGSviFeRobVx3oOmXUc1fXHbJMGFlusD-0dy2Y'

// NS3000 Destination (da .env.local)
const ns3000Url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ns3000Key = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!ns3000Url || !ns3000Key) {
  console.error('❌ Errore: variabili d\'ambiente mancanti in .env.local')
  console.error('Assicurati che NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY siano impostate')
  process.exit(1)
}

const sourceSB = createClient(bluAllianceUrl, bluAllianceKey)
const destSB = createClient(ns3000Url, ns3000Key)

// ID Fornitore NS3000 in Blu Alliance
const NS3000_SUPPLIER_ID = '2d78fca2-f474-4c44-8443-44c75924d5c3'

async function migrateBoats() {
  console.log('📦 Importazione barche NS3000 da Blu Alliance...\n')
  
  const { data: boats, error } = await sourceSB
    .from('imbarcazioni')
    .select('*')
    .eq('fornitore_id', NS3000_SUPPLIER_ID)
    .eq('attiva', true)
  
  if (error) {
    console.error('❌ Errore lettura barche:', error)
    return
  }

  console.log(`✅ Trovate ${boats?.length || 0} barche NS3000\n`)

  if (!boats || boats.length === 0) {
    console.log('⚠️  Nessuna barca trovata.')
    return
  }

  let imported = 0
  let errors = 0

  for (const boat of boats) {
    // Estrai lunghezza dalla descrizione se presente (es. "9.98x3.25mt")
    let length = null
    const lengthMatch = boat.descrizione?.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*mt?/i)
    if (lengthMatch) {
      length = parseFloat(lengthMatch[1])
    }

    const mapped = {
      name: boat.nome || boat.nome_it,
      registration_number: null,
      boat_type: boat.tipo,
      length_meters: length,
      max_passengers: boat.capacita_massima,
      description: boat.descrizione || boat.descrizione_it,
      technical_specs: {
        caratteristiche: boat.caratteristiche,
        categoria: boat.categoria,
        tipi_servizio: boat.tipi_servizio
      },
      images: boat.immagine_principale ? [boat.immagine_principale] : [],
      service_type: 'rental',
      is_active: boat.attiva
    }

    const { error: insertError } = await destSB
      .from('boats')
      .insert([mapped])

    if (insertError) {
      console.error(`❌ ${boat.nome}: ${insertError.message}`)
      errors++
    } else {
      console.log(`✅ ${boat.nome}`)
      imported++
    }
  }

  console.log(`\n📊 Barche: ${imported} importate, ${errors} errori\n`)
}

async function migrateServices() {
  console.log('📦 Importazione servizi da Blu Alliance...\n')
  
  const { data: services, error } = await sourceSB
    .from('servizi')
    .select('*')
    .eq('attivo', true)
  
  if (error) {
    console.error('❌ Errore lettura servizi:', error)
    return
  }

  console.log(`✅ Trovati ${services?.length || 0} servizi\n`)

  if (!services || services.length === 0) {
    console.log('⚠️  Nessun servizio trovato.')
    return
  }

  let imported = 0
  let errors = 0

  for (const service of services) {
    // Mappa tipo servizio
    let serviceType = 'tour'
    if (service.tipo === 'noleggio') serviceType = 'rental'
    else if (service.tipo === 'taxi') serviceType = 'taxi_boat'
    else if (service.tipo === 'tour') serviceType = 'tour'

    const mapped = {
      name: service.nome || service.nome_it,
      type: serviceType,
      description: service.descrizione || service.descrizione_it,
      duration_hours: service.durata_ore || null,
      max_passengers: service.capacita_massima || null,
      images: service.immagine_principale ? [service.immagine_principale] : [],
      includes: service.inclusioni || [],
      base_price: service.prezzo_base || 0,
      is_active: service.attivo
    }

    const { error: insertError } = await destSB
      .from('services')
      .insert([mapped])

    if (insertError) {
      console.error(`❌ ${service.nome}: ${insertError.message}`)
      errors++
    } else {
      console.log(`✅ ${service.nome}`)
      imported++
    }
  }

  console.log(`\n📊 Servizi: ${imported} importati, ${errors} errori\n`)
}

async function main() {
  console.log('🚀 Migrazione Blu Alliance → NS3000RENT')
  console.log('==========================================\n')
  
  await migrateBoats()
  await migrateServices()
  
  console.log('✅ Migrazione completata!')
}

main().catch((err) => {
  console.error('❌ Errore fatale:', err)
  process.exit(1)
})