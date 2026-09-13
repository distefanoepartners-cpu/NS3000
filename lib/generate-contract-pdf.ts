/**
 * NS3000 - Generatore Contratto di Noleggio PDF
 * Genera il contratto "CONTRATTO DI NOLEGGIO CON EQUIPAGGIO"
 * basato sul template ufficiale NS3000 Rent
 * 
 * Usa: jsPDF (da installare: npm install jspdf)
 * 
 * File: lib/generate-contract-pdf.ts
 */

import jsPDF from 'jspdf'

interface ContractData {
  // Cliente
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  customer_email: string
  customer_fiscal_code?: string
  
  // Documento
  document_type?: string
  document_number?: string
  document_expiry?: string
  
  // Prenotazione
  boat_name: string
  booking_date: string
  time_slot: string
  time_slot_custom?: string
  num_passengers: number
  
  // ⭐ Porti (testo libero dal form prenotazione)
  boarding_port?: string
  disembark_port?: string
  
  // Prezzi
  final_price: number
  deposit_amount: number
  balance_amount: number
  
  // Extra
  booking_number?: string
  has_license?: boolean
  license_number?: string
  notes?: string
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatTimeSlot(slot: string, custom?: string): string {
  if (custom) return custom
  switch (slot) {
    case 'full_day': return '09:00 - 18:00'
    case 'morning': return '09:00 - 13:00'
    case 'afternoon': return '14:00 - 18:00'
    case 'evening': return '18:00 - 23:00'
    default: return slot || ''
  }
}

function formatDocumentType(type: string): string {
  switch (type) {
    case 'carta_identita': return "Carta d'Identità"
    case 'passaporto': return 'Passaporto'
    case 'patente': return 'Patente'
    default: return type || ''
  }
}

export function generateContractPDF(data: ContractData): void {
  const doc = new jsPDF('portrait', 'mm', 'a4')
  const pageWidth = 210
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = 15

  // ============================================================
  // HEADER
  // ============================================================
  
  // Logo area (testo al posto del logo)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('NS3000', margin, y + 5)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('Rent', margin + 22, y + 5)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Molo Masuccio Salernitano', margin, y + 10)
  doc.text('c/o Yachting Club Salerno', margin, y + 13)
  doc.text('P.iva 06087840655', margin, y + 16)
  
  // Numeri utili
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('Numeri utili - Useful numbers', margin + 55, y + 2)
  doc.setFont('helvetica', 'normal')
  doc.text('+39 388 11 40 189', margin + 55, y + 6)
  doc.text('+39 327 09 51 879', margin + 55, y + 10)
  
  // Titolo contratto
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  const title1 = 'CONTRATTO DI NOLEGGIO CON EQUIPAGGIO'
  const title2 = 'RENTAL AGREEMENT WITH CREW'
  doc.text(title1, pageWidth - margin, y + 3, { align: 'right' })
  doc.setFontSize(8)
  doc.text(title2, pageWidth - margin, y + 8, { align: 'right' })
  
  // Numero prenotazione
  if (data.booking_number) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`Rif: ${data.booking_number}`, pageWidth - margin, y + 14, { align: 'right' })
  }
  
  y += 22
  
  // Linea separatrice
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 3
  
  // ============================================================
  // SEZIONE: NOLEGGIATORE/CHARTERER
  // ============================================================
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('NOLEGGIATORE / CHARTERER', margin, y + 4)
  y += 8
  
  // Tabella dati cliente
  const cellHeight = 12
  const col1 = margin
  const col2 = margin + 45
  const col3 = margin + 100
  const col4 = margin + 145
  
  // Riga 1: Nome | Cognome | Telefono | Cod.Fiscale
  doc.setLineWidth(0.3)
  
  // Bordi
  doc.rect(col1, y, 45, cellHeight)
  doc.rect(col2, y, 55, cellHeight)
  doc.rect(col3, y, 45, cellHeight)
  doc.rect(col4, y, pageWidth - margin - col4, cellHeight)
  
  // Label
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('NOME - NAME', col1 + 2, y + 3)
  doc.text('COGNOME - SURNAME', col2 + 2, y + 3)
  doc.text('TELEFONO - MOBILE PHONE', col3 + 2, y + 3)
  doc.text('COD. FISCALE / P. IVA', col4 + 2, y + 3)
  
  // Valori
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(data.customer_first_name || '', col1 + 2, y + 9)
  doc.text(data.customer_last_name || '', col2 + 2, y + 9)
  doc.text(data.customer_phone || '', col3 + 2, y + 9)
  doc.text(data.customer_fiscal_code || '', col4 + 2, y + 9)
  
  y += cellHeight
  
  // Riga 2: N. Documento | Scadenza | (vuoto) | Natante N.
  doc.rect(col1, y, 55, cellHeight)
  doc.rect(col1 + 55, y, 45, cellHeight)
  doc.rect(col3, y, pageWidth - margin - col3, cellHeight)
  
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('N. DOCUMENTO - DOCUMENT N.', col1 + 2, y + 3)
  doc.text('SCADENZA IL - EXPIRATION ON', col1 + 57, y + 3)
  doc.text('NATANTE N. - BOAT N.', col3 + 2, y + 3)
  
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const docInfo = data.document_number ? `${formatDocumentType(data.document_type || '')} ${data.document_number}` : ''
  doc.text(docInfo, col1 + 2, y + 9)
  doc.text(data.document_expiry ? formatDate(data.document_expiry) : '', col1 + 57, y + 9)
  doc.text(data.boat_name || '', col3 + 2, y + 9)
  
  y += cellHeight
  
  // Riga 3: Periodo Dal | Ore | Periodo Al | Ore
  const col3b = margin + 90
  const col4b = margin + 135
  doc.rect(col1, y, 45, cellHeight)
  doc.rect(col2, y, 45, cellHeight)
  doc.rect(col3b, y, 45, cellHeight)
  doc.rect(col4b, y, pageWidth - margin - col4b, cellHeight)
  
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('PERIODO DAL - PERIOD FROM', col1 + 2, y + 3)
  doc.text('ORE - TIME', col2 + 2, y + 3)
  doc.text('PERIODO AL - PERIOD TO', col3b + 2, y + 3)
  doc.text('ORE - TIME', col4b + 2, y + 3)
  
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const timeSlotFormatted = formatTimeSlot(data.time_slot, data.time_slot_custom)
  const [timeStart, timeEnd] = timeSlotFormatted.includes('-') ? timeSlotFormatted.split('-').map(t => t.trim()) : [timeSlotFormatted, '']
  
  doc.text(formatDate(data.booking_date), col1 + 2, y + 9)
  doc.text(timeStart, col2 + 2, y + 9)
  doc.text(formatDate(data.booking_date), col3b + 2, y + 9) // Stesso giorno
  doc.text(timeEnd, col4b + 2, y + 9)
  
  y += cellHeight
  
  // Riga 4: Persone Max | Importo Totale | Acconto | Saldo
  doc.rect(col1, y, 35, cellHeight)
  doc.rect(col1 + 35, y, 45, cellHeight)
  doc.rect(col1 + 80, y, 45, cellHeight)
  doc.rect(col1 + 125, y, pageWidth - margin - (col1 + 125), cellHeight)
  
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('PERSONE MAX - MAX PEOPLE', col1 + 2, y + 3)
  doc.text('IMPORTO TOTALE - AMOUNT', col1 + 37, y + 3)
  doc.text('ACCONTO - DEPOSIT', col1 + 82, y + 3)
  doc.text('SALDO - BALANCE', col1 + 127, y + 3)
  
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(String(data.num_passengers || ''), col1 + 2, y + 9)
  doc.text(`€ ${(data.final_price || 0).toFixed(2)}`, col1 + 37, y + 9)
  doc.text(`€ ${(data.deposit_amount || 0).toFixed(2)}`, col1 + 82, y + 9)
  doc.text(`€ ${(data.balance_amount || 0).toFixed(2)}`, col1 + 127, y + 9)
  
  y += cellHeight
  
  // ─── Riga imbarco/sbarco + Carburante ───────────────────────────
  // ⭐ Ora usa i valori dinamici da data.boarding_port e data.disembark_port.
  //    Fallback al testo storico "Porto di Salerno" se non compilati.
  doc.rect(col1, y, contentWidth / 2, cellHeight)
  doc.rect(col1 + contentWidth / 2, y, contentWidth / 2, cellHeight)
  
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('IMBARCO DA - EMBARK AT', col1 + 2, y + 3)
  doc.text('SBARCO A - DISEMBARK AT', col1 + contentWidth / 2 + 2, y + 3)
  
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const boardingLabel = (data.boarding_port && data.boarding_port.trim()) || 'Porto di Salerno'
  const disembarkLabel = (data.disembark_port && data.disembark_port.trim()) || 'Porto di Salerno'
  doc.text(boardingLabel, col1 + 2, y + 9)
  doc.text(disembarkLabel, col1 + contentWidth / 2 + 2, y + 9)
  
  // Carburante incluso
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bolditalic')
  doc.text('CARBURANTE INCLUSO - FUEL INCLUDED', pageWidth - margin, y + 9, { align: 'right' })
  
  y += cellHeight + 6
  
  // ============================================================
  // DISPOSIZIONI DI NOLEGGIO (Italiano)
  // ============================================================
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('SI PREGA DI LEGGERE ATTENTAMENTE LE DISPOSIZIONI DI NOLEGGIO.', margin, y)
  y += 5
  
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  
  const articlesIT = [
    "Art. 1 CONSEGNA - L'armatore renderà disponibile l'Unità da Diporto al noleggiatore in buono stato di navigabilità, completa di tutte le pertinenze, con assicurazione RC, atta a svolgere la navigazione oggetto del presente contratto e pronta per prendere il mare. Dichiara inoltre, sotto la propria responsabilità, di essere in possesso di tutti i requisiti, permessi e autorizzazioni per svolgere l'attività, nonché di aver iscritto il natante al noleggio presso la capitaneria di porto di Salerno.",
    "Art. 2 RESPONSABILITÀ - Il noleggiatore è tenuto ad assumere un comportamento consono a bordo e assicurarsi che gli altri passeggeri facciano lo stesso. Tutti i danni causati sono a suo carico e verranno addebitati alle tariffe e costi in vigore.",
    "Art. 3 MODO E LIMITI DELL'UTILIZZO DELL'UNITA' - DIVIETI - Il numero di persone a bordo non potrà in alcun caso eccedere il massimo consentito dall'autorità marittima. L'unità, per sua natura e struttura, potrebbe essere non appropriata per persone portatrici di handicap, che siano sotto cure mediche o soggette a crisi epilettiche, cardiache, a gravi allergie ecc. Il noleggiatore dovrà portare a conoscenza dell'armatore simili situazioni, il quale potrà a sua discrezione autorizzarne l'imbarco.",
    "Art. 4 MALTEMPO - L'armatore non si assume nessuna responsabilità circa le perdite di tempo e le interruzioni della crociera che dovessero aver luogo a causa di avverse condizioni meteorologiche, per disposizioni emanate dalle autorità marittime o per malessere dei passeggeri. È a insindacabile giudizio del conduttore la decisione di uscire dal porto con condizioni meteorologiche avverse che potrebbero mettere a repentaglio la sicurezza dell'Unità da Diporto e delle persone imbarcate.",
    "Art. 5 - FORO COMPETENTE E RINVIO ALLE NORME DI LEGGE - Per qualsiasi controversia, il foro competente è Salerno. Per quanto non espressamente stabilito dal presente contratto, si fa riferimento alle norme legislative italiane."
  ]
  
  for (const art of articlesIT) {
    const lines = doc.splitTextToSize(art, contentWidth)
    doc.text(lines, margin, y)
    y += lines.length * 3 + 1.5
  }
  
  y += 3
  
  // ============================================================
  // DISPOSIZIONI (Inglese)
  // ============================================================
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('PLEASE READ THE RENTAL PROVISIONS CAREFULLY.', margin, y)
  y += 5
  
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  
  const articlesEN = [
    "Art. 1 DELIVERY - The Owner will make the vessel available to the Charterer in good seaworthy condition, complete with all appurtenances, with liability insurance, suitable to carry out the navigation object of this contract and ready to take to the sea. It also declares, under his own responsibility, to be in possession of all the requirements, permits and authorizations to carry out the activity, as well as to have registered the vessel for hire with the Salerno harbor master's office.",
    "Art. 2 RESPONSIBILITY - The hirer is required to behave properly on board and ensure that the other passengers do the same. All damages caused are his responsibility and will be charged at the rates and costs in effect.",
    "Art. 3 MODE AND LIMITS OF THE USE OF THE UNIT - PROHIBITIONS - The number of persons on board shall in no case exceed the maximum permitted by the maritime authority. The unit, due to its nature and structure, may not be appropriate for persons who are handicapped, under medical treatment or subject to epileptic seizures, heart disease, severe allergies, etc. The charterer shall bring such situations to the attention of the shipowner, who may at his discretion authorize boarding.",
    "Art. 4 WEATHER - The owner assumes no responsibility for loss of time and interruptions of the cruise that may take place due to adverse weather conditions, due to provisions issued by the maritime authorities or due to ill health of passengers. It is at the sole discretion of the conductor to decide to leave port in adverse weather conditions that could jeopardize the safety of the Recreational Unit and the persons embarked.",
    "Art. 5 - COMPETENT COURT OF JURISDICTION AND REFERENCE TO THE LAW - For any dispute, the competent court is Salerno. For anything not expressly established in this contract, reference is made to Italian legislative norms."
  ]
  
  for (const art of articlesEN) {
    const lines = doc.splitTextToSize(art, contentWidth)
    doc.text(lines, margin, y)
    y += lines.length * 3 + 1.5
  }
  
  y += 6
  
  // ============================================================
  // DICHIARAZIONE / DECLARATION
  // ============================================================
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('DICHIARAZIONE / DECLARATION', pageWidth / 2, y, { align: 'center' })
  y += 5
  
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  const declaration = "Il sottoscritto dichiara sotto la propria piena responsabilità di aver preso visione delle disposizioni suddette e si impegna a rispettarle.\nThe undersigned declares that he/she has read the above regulation and accepts full responsibility for any infringement."
  const declLines = doc.splitTextToSize(declaration, contentWidth)
  doc.text(declLines, margin, y)
  
  y += declLines.length * 3.5 + 10
  
  // ============================================================
  // FIRME
  // ============================================================
  
  // Linea firme
  const signY = Math.max(y, 265) // Assicura che le firme siano in basso
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  
  // Salerno il
  doc.text(`SALERNO il ${formatDate(new Date().toISOString())}`, margin, signY)
  
  // Linea firma armatore
  doc.line(margin + 60, signY, margin + 105, signY)
  doc.setFontSize(7)
  doc.text('ARMATORE', margin + 70, signY + 4)
  
  // Linea firma noleggiatore
  doc.line(margin + 120, signY, margin + 170, signY)
  doc.text('NOLEGGIATORE', margin + 127, signY + 4)
  
  // ============================================================
  // GENERA E SCARICA
  // ============================================================
  
  const fileName = `Contratto_${data.customer_last_name || 'Noleggio'}_${data.booking_date || 'NS3000'}.pdf`
  doc.save(fileName)
}