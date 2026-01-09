import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'

// Helper: Converti data YYYY-MM-DD a GG/MM/AAAA
function formatItalianDate(dateStr: string | null): string {
  if (!dateStr) return ''
  
  try {
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  } catch {
    return ''
  }
}

// Helper: Generate CSV from data
function generateCSV(customers: any[], mode: 'full' | 'marketing'): string {
  if (mode === 'marketing') {
    // Solo contatti per marketing
    const header = 'Nome,Cognome,Email,Telefono,Nazionalità'
    const rows = customers.map(c => 
      [
        c.first_name || '',
        c.last_name || '',
        c.email || '',
        c.phone || '',
        c.nationality || ''
      ].map(field => `"${field}"`).join(',')
    )
    return [header, ...rows].join('\n')
  }
  
  // Export completo
  const header = 'Nome,Cognome,Email,Telefono,Nazionalità,Tipo Documento,N° Documento,Scadenza Documento,Patente Nautica,N° Patente,Scadenza Patente,Note,Data Creazione'
  const rows = customers.map(c => 
    [
      c.first_name || '',
      c.last_name || '',
      c.email || '',
      c.phone || '',
      c.nationality || '',
      c.document_type || '',
      c.document_number || '',
      formatItalianDate(c.document_expiry),
      c.has_boat_license ? 'Sì' : 'No',
      c.boat_license_number || '',
      formatItalianDate(c.boat_license_expiry),
      c.notes || '',
      formatItalianDate(c.created_at?.split('T')[0])
    ].map(field => `"${field}"`).join(',')
  )
  return [header, ...rows].join('\n')
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'full' // 'full' | 'marketing'
    const year = searchParams.get('year') // Filter by year
    
    // Build query
    let query = supabaseAdmin
      .from('customers')
      .select('*')
      .order('last_name', { ascending: true })
    
    // Filter by year if provided
    if (year) {
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`
      query = query
        .gte('created_at', startDate)
        .lte('created_at', endDate)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Nessun cliente trovato' }, { status: 404 })
    }
    
    // Generate CSV
    const csv = generateCSV(data, mode as 'full' | 'marketing')
    
    // Return as downloadable file
    const filename = mode === 'marketing' 
      ? `clienti_marketing_${year || 'tutti'}.csv`
      : `clienti_completo_${year || 'tutti'}.csv`
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
    
  } catch (error: any) {
    console.error('Error exporting customers:', error)
    return NextResponse.json({ 
      error: error.message || 'Errore durante l\'esportazione' 
    }, { status: 500 })
  }
}