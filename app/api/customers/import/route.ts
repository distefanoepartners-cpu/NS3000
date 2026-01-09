import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import * as XLSX from 'xlsx'

// Helper: Converti data italiana GG/MM/AAAA a YYYY-MM-DD
function parseItalianDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '' || dateStr === 'nan') return null
  
  // Pulisci la stringa
  const cleaned = dateStr.trim()
  
  // Match GG/MM/AAAA o GG-MM-AAAA
  const match = cleaned.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/)
  if (!match) return null
  
  let [, day, month, year] = match
  
  // Converti anno a 4 cifre se necessario
  if (year.length === 2) {
    const yy = parseInt(year)
    year = yy > 50 ? `19${year}` : `20${year}`
  }
  
  // Pad con zero
  day = day.padStart(2, '0')
  month = month.padStart(2, '0')
  
  const result = `${year}-${month}-${day}`
  
  // Valida la data
  const date = new Date(result)
  if (isNaN(date.getTime())) return null
  
  // Verifica che giorno/mese siano validi
  const [y, m, d] = result.split('-').map(Number)
  if (date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) {
    return null // Data invalida (es. 33 settembre)
  }
  
  return result
}

// Helper: Mappa tipo documento
function mapDocumentType(code: string): string {
  const cleaned = code?.trim()
  switch (cleaned) {
    case '1': return 'Carta Identità'
    case '2': return 'Passaporto'
    case '3': return 'Altro'
    default: return cleaned || 'Carta Identità'
  }
}

// Helper: Parse CSV (supporta tab, comma, semicolon)
function parseCSV(text: string): any[] {
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []
  
  // Detect separator
  const firstLine = lines[0]
  let separator = ','
  if (firstLine.includes('\t')) separator = '\t'
  else if (firstLine.includes(';')) separator = ';'
  
  // Parse header
  const headers = lines[0].split(separator).map(h => h.trim())
  
  // Parse rows
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator)
    const row: any = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || ''
    })
    rows.push(row)
  }
  
  return rows
}

// Helper: Parse Excel
function parseExcel(buffer: ArrayBuffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(firstSheet, { raw: false })
  
  // Normalize column names (trim spaces)
  return rows.map(row => {
    const normalized: any = {}
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim()] = value
    }
    return normalized
  })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'File non fornito' }, { status: 400 })
    }
    
    let rows: any[] = []
    
    // Parse based on file type
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // Excel file
      const buffer = await file.arrayBuffer()
      rows = parseExcel(buffer)
    } else {
      // CSV/TSV file
      const text = await file.text()
      rows = parseCSV(text)
    }
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'File vuoto o formato non valido' }, { status: 400 })
    }
    
    console.log('Parsed rows:', rows.length)
    console.log('First row keys:', Object.keys(rows[0]))
    console.log('First row:', rows[0])
    
    // Helper: Get column value with flexible matching
    function getColumnValue(row: any, ...possibleNames: string[]): string {
      for (const name of possibleNames) {
        // Try exact match
        if (row[name]) return row[name]
        
        // Try case-insensitive match
        const lowerName = name.toLowerCase()
        for (const key of Object.keys(row)) {
          if (key.toLowerCase() === lowerName) {
            return row[key]
          }
        }
      }
      return ''
    }
    
    // Map rows to customer objects
    const customers = rows
      .filter(row => {
        const firstName = getColumnValue(row, 'nome', 'Nome', 'NOME', 'first_name')
        const lastName = getColumnValue(row, 'cognome', 'Cognome', 'COGNOME', 'last_name')
        return firstName && lastName
      })
      .map(row => {
        const firstName = getColumnValue(row, 'nome', 'Nome', 'NOME', 'first_name')
        const lastName = getColumnValue(row, 'cognome', 'Cognome', 'COGNOME', 'last_name')
        const email = getColumnValue(row, 'email', 'Email', 'EMAIL', 'e-mail')
        const phone = getColumnValue(row, 'telefono', 'Telefono', 'TELEFONO', 'phone', 'tel')
        const nationality = getColumnValue(row, 'nazione', 'Nazione', 'NAZIONE', 'nazionalità', 'nationality')
        const docType = getColumnValue(row, 'documento', 'Documento', 'DOCUMENTO', 'tipo documento')
        const docNumber = getColumnValue(row, 'n° documento', 'N° documento', 'numero documento', 'doc number')
        const docExpiry = getColumnValue(row, 'scadenza', 'Scadenza', 'SCADENZA', 'scadenza documento')
        const licenseNumber = getColumnValue(row, 'N° patente', 'n° patente', 'numero patente', 'patente')
        const licenseExpiry = getColumnValue(row, 'scadenza ', 'scadenza patente', 'Scadenza patente')
        
        const hasLicense = !!(licenseNumber || licenseExpiry)
        
        return {
          first_name: firstName?.trim(),
          last_name: lastName?.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          nationality: nationality?.trim() || null,
          document_type: mapDocumentType(docType),
          document_number: docNumber?.trim() || null,
          document_expiry: parseItalianDate(docExpiry),
          has_boat_license: hasLicense,
          boat_license_number: licenseNumber?.trim() || null,
          boat_license_expiry: parseItalianDate(licenseExpiry),
        }
      })
    
    console.log('Valid customers:', customers.length)
    
    if (customers.length === 0) {
      return NextResponse.json({ 
        error: 'Nessun cliente valido trovato nel file. Verifica che ci siano colonne "nome" e "cognome".',
        columns: Object.keys(rows[0])
      }, { status: 400 })
    }
    
    // Insert in batches of 1000 (Supabase limit)
    const BATCH_SIZE = 1000
    const batches = []
    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
      batches.push(customers.slice(i, i + BATCH_SIZE))
    }
    
    console.log(`Inserting ${customers.length} customers in ${batches.length} batches`)
    
    let totalInserted = 0
    const allData = []
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.log(`Inserting batch ${i + 1}/${batches.length} (${batch.length} customers)`)
      
      const { data, error } = await supabaseAdmin
        .from('customers')
        .insert(batch)
        .select()
      
      if (error) {
        // Se errore di duplicato, prova a inserire uno per uno
        if (error.code === '23505') { // Unique constraint violation
          console.log(`Batch ${i + 1} has duplicates, inserting individually...`)
          for (const customer of batch) {
            try {
              const { data: single, error: singleError } = await supabaseAdmin
                .from('customers')
                .insert([customer])
                .select()
              
              if (!singleError && single) {
                totalInserted++
                allData.push(...single)
              }
            } catch (err) {
              // Skip duplicates silently
            }
          }
        } else {
          console.error(`Supabase error in batch ${i + 1}:`, error)
          throw new Error(`Errore nel batch ${i + 1}: ${error.message}`)
        }
      } else {
        totalInserted += data?.length || 0
        allData.push(...(data || []))
      }
    }
    
    console.log(`Successfully inserted ${totalInserted} customers`)
    
    return NextResponse.json({
      success: true,
      imported: totalInserted,
      total: customers.length,
      batches: batches.length,
      customers: allData
    })
    
  } catch (error: any) {
    console.error('Error importing customers:', error)
    return NextResponse.json({ 
      error: error.message || 'Errore durante l\'importazione' 
    }, { status: 500 })
  }
}