// lib/whatsapp-service.ts
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'

const client = twilio(accountSid, authToken)

// ═══════════════════════════════════════
// TEMPLATE CONTENT SIDs (Twilio Content API)
// ═══════════════════════════════════════
const TEMPLATES = {
  welcome_rental_it: 'HXe06d5d1248750261da081c4b28e61e5d',
  welcome_rental_en: 'HX2c5ae46f4080b0885740c4ffc4c3ec87',
  welcome_rental_es: 'HX6a63ee571e1ab4401c178df4259bb76f',

  caution_it: 'HX6b424330de1139f6e44f003c82a750b9',
  caution_en: 'HX34ece0deb5dc34c087530b69e47037f6',
  caution_es: 'HX237ecf50ec0ec986637613fd4044cb43',

  booking_notification_desk_it: 'HX39f867b054d91fcbe9bd4b3222535759',

  // ⭐ Recensione Google approvati da Meta (5 mag 2026)
  google_review_it: 'HX91f1982ed53d8ca554dd45b0e72b1c97',
  google_review_en: 'HXe8ec7fba9830e91f3744b4c11e7faaf4',
  google_review_es: 'HXac8ff2f38f39c0a66e36eb1d2d9da448',
}

// ⭐ Dizionario fasce orarie (3 lingue)
const timeSlotLabels: Record<string, Record<string, string>> = {
  it: {
    morning: 'Mattina (9:00-13:00)',
    afternoon: 'Pomeriggio (14:00-18:00)',
    evening: 'Serale',
    full_day: 'Giornata Intera (9:00-18:00)',
  },
  en: {
    morning: 'Morning (9:00-13:00)',
    afternoon: 'Afternoon (14:00-18:00)',
    evening: 'Evening',
    full_day: 'Full Day (9:00-18:00)',
  },
  es: {
    morning: 'Mañana (9:00-13:00)',
    afternoon: 'Tarde (14:00-18:00)',
    evening: 'Noche',
    full_day: 'Día completo (9:00-18:00)',
  },
}

// Mapping lingua → locale per Intl.DateTimeFormat
const LOCALE_MAP: Record<string, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
}

function formatDate(dateStr: string, lang: string = 'it'): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(LOCALE_MAP[lang] || 'it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

function getTimeSlot(slot: string, lang: string = 'it'): string {
  return timeSlotLabels[lang]?.[slot] || timeSlotLabels['it']?.[slot] || slot
}

function formatPhone(phone: string): string {
  if (!phone) return ''

  // ⭐ Rimuovi caratteri Unicode invisibili/direzionali (LRE, RLE, zero-width, BOM, ecc.)
  let p = String(phone).replace(/[\u00A0\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')

  // Pulizia base: spazi, trattini, parentesi, punti
  p = p.trim().replace(/[\s\-()\.]/g, '')

  // Normalizzazione paranoica dei '+' multipli
  if (p.startsWith('+')) {
    p = '+' + p.replace(/\+/g, '')
  } else {
    p = p.replace(/\+/g, '')
  }

  const INTL_PREFIXES = [
    '1', '33', '34', '44', '49', '54', '55', '61',
    '212', '351', '353', '41', '43', '420', '48',
    '7', '86', '81', '91', '27', '52', '356',
    '30', '31', '32', '45', '46', '47',
  ]

  if (p.startsWith('+')) return p
  if (p.startsWith('00')) return '+' + p.substring(2)

  if (p.startsWith('3') && p.length === 10 && /^\d+$/.test(p)) {
    return '+39' + p
  }

  if (p.startsWith('39') && p.length >= 12 && p.length <= 13 && /^\d+$/.test(p)) {
    return '+' + p
  }

  if (/^\d{8,15}$/.test(p)) {
    const sortedPrefixes = [...INTL_PREFIXES].sort((a, b) => b.length - a.length)
    for (const prefix of sortedPrefixes) {
      if (p.startsWith(prefix)) {
        return '+' + p
      }
    }
  }

  console.warn('⚠️ [formatPhone] Formato ambiguo, aggiungo solo "+":', phone, '→', '+' + p)
  return '+' + p
}

// ⭐ Estrae il session ID Stripe da un URL completo o session id
function extractStripeSessionId(paymentLinkOrSessionId: string): string {
  if (!paymentLinkOrSessionId) return ''
  if (paymentLinkOrSessionId.startsWith('cs_')) return paymentLinkOrSessionId
  const match = paymentLinkOrSessionId.match(/\/c\/pay\/(cs_[a-zA-Z0-9_]+)/)
  if (match) return match[1]
  console.warn('⚠️ payment_link non riconosciuto come session_id Stripe:', paymentLinkOrSessionId.substring(0, 60))
  return paymentLinkOrSessionId
}

// ⭐ Sanitizza il valore di una variabile template Twilio
function sanitizeTemplateVar(value: string): string {
  if (value == null) return ''
  return String(value)
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
}

// ═══════════════════════════════════════
// INVIO WHATSAPP FREE-FORM
// ═══════════════════════════════════════
export async function sendWhatsApp(
  to: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const phone = formatPhone(to)

    console.log(`📱 WhatsApp free-form a ${phone}: ${body.substring(0, 80)}...`)

    const result = await client.messages.create({
      body,
      from: `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${phone}`,
    })

    console.log(`✅ WhatsApp inviato: ${result.sid}`)
    return { success: true, messageId: result.sid }
  } catch (error: any) {
    console.error('❌ Errore invio WhatsApp free-form:', error.message)
    return { success: false, error: error.message }
  }
}

// ═══════════════════════════════════════
// INVIO WHATSAPP CON TEMPLATE APPROVATO
// ═══════════════════════════════════════
export async function sendWhatsAppTemplate(
  to: string,
  contentSid: string,
  contentVariables: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const phone = formatPhone(to)

    const sanitized: Record<string, string> = {}
    for (const [key, val] of Object.entries(contentVariables)) {
      sanitized[key] = sanitizeTemplateVar(val)
    }

    const contentVariablesJson = JSON.stringify(sanitized)

    console.log(`📱 WhatsApp TEMPLATE ${contentSid} a ${phone}`)
    console.log(`   Variabili (oggetto):`, sanitized)
    console.log(`   Variabili (JSON inviato a Twilio):`, contentVariablesJson)
    console.log(`   Keys presenti:`, Object.keys(sanitized).join(','))
    console.log(`   From: whatsapp:${whatsappFrom}`)
    console.log(`   To:   whatsapp:${phone}`)

    const result = await client.messages.create({
      contentSid,
      contentVariables: contentVariablesJson,
      from: `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${phone}`,
    })

    console.log(`✅ WhatsApp template inviato: ${result.sid}`)
    return { success: true, messageId: result.sid }
  } catch (error: any) {
    console.error('❌ Errore invio WhatsApp template:', error.message)
    console.error('   Codice errore Twilio:', error.code)
    console.error('   Dettagli:', error.moreInfo || error.details)
    return { success: false, error: error.message }
  }
}

// ═══════════════════════════════════════
// HELPER: seleziona template SID in base a lingua con fallback a IT
// ═══════════════════════════════════════
function getWelcomeTemplateSid(lang: string): string {
  if (lang === 'en' && TEMPLATES.welcome_rental_en) return TEMPLATES.welcome_rental_en
  if (lang === 'es' && TEMPLATES.welcome_rental_es) return TEMPLATES.welcome_rental_es

  if (lang === 'en' && !TEMPLATES.welcome_rental_en) {
    console.warn('⚠️ Template welcome EN non configurato, fallback su IT')
  }
  if (lang === 'es' && !TEMPLATES.welcome_rental_es) {
    console.warn('⚠️ Template welcome ES non configurato, fallback su IT')
  }
  return TEMPLATES.welcome_rental_it
}

function getCautionTemplateSid(lang: string): string {
  if (lang === 'en' && TEMPLATES.caution_en) return TEMPLATES.caution_en
  if (lang === 'es' && TEMPLATES.caution_es) return TEMPLATES.caution_es

  if (lang === 'en' && !TEMPLATES.caution_en) {
    console.warn('⚠️ Template caution EN non configurato, fallback su IT')
  }
  if (lang === 'es' && !TEMPLATES.caution_es) {
    console.warn('⚠️ Template caution ES non configurato, fallback su IT')
  }
  return TEMPLATES.caution_it
}
function getGoogleReviewTemplateSid(lang: string): string {
  if (lang === 'en' && TEMPLATES.google_review_en) return TEMPLATES.google_review_en
  if (lang === 'es' && TEMPLATES.google_review_es) return TEMPLATES.google_review_es

  if (lang === 'en' && !TEMPLATES.google_review_en) {
    console.warn('⚠️ Template google_review EN non configurato, fallback su IT')
  }
  if (lang === 'es' && !TEMPLATES.google_review_es) {
    console.warn('⚠️ Template google_review ES non configurato, fallback su IT')
  }
  return TEMPLATES.google_review_it
}
// ═══════════════════════════════════════
// TRADUZIONI per messaggi free-form (3 lingue)
// ═══════════════════════════════════════
interface FreeFormStrings {
  bookingConfirmed: string
  hello: string
  bookingConfirmedText: string
  passengersLabel: string
  totalLabel: string
  depositPaid: string
  balanceDue: string
  meetingPoint: string
  forQuestions: string
  thanks: string
  reminderTitle: string
  reminderText: string
  seeYouTomorrow: string
}

const freeFormStrings: Record<string, FreeFormStrings> = {
  it: {
    bookingConfirmed: '✅ *Prenotazione Confermata!*',
    hello: 'Ciao',
    bookingConfirmedText: "la tua prenotazione con *NS3000 Rent* e' confermata!",
    passengersLabel: 'passeggeri',
    totalLabel: 'Totale',
    depositPaid: '✅ Acconto versato',
    balanceDue: '💳 Saldo al check-in',
    meetingPoint: "📍 Punto d'incontro: Porto Turistico Masuccio Salernitano",
    forQuestions: 'Per qualsiasi esigenza contattaci:',
    thanks: 'Grazie e buon viaggio! ⛵',
    reminderTitle: '⏰ *Promemoria Prenotazione*',
    reminderText: 'ti ricordiamo la tua prenotazione di domani!',
    seeYouTomorrow: 'A domani! ⛵',
  },
  en: {
    bookingConfirmed: '✅ *Booking Confirmed!*',
    hello: 'Hello',
    bookingConfirmedText: 'your booking with *NS3000 Rent* has been confirmed!',
    passengersLabel: 'passengers',
    totalLabel: 'Total',
    depositPaid: '✅ Deposit paid',
    balanceDue: '💳 Balance due at check-in',
    meetingPoint: '📍 Meeting point: Porto Turistico Masuccio Salernitano',
    forQuestions: 'For any questions, contact us:',
    thanks: 'Thank you! ⛵',
    reminderTitle: '⏰ *Booking Reminder*',
    reminderText: 'this is a reminder for your booking tomorrow!',
    seeYouTomorrow: 'See you tomorrow! ⛵',
  },
  // ⭐ Spagnolo neutro
  es: {
    bookingConfirmed: '✅ *¡Reserva Confirmada!*',
    hello: 'Hola',
    bookingConfirmedText: '¡su reserva con *NS3000 Rent* ha sido confirmada!',
    passengersLabel: 'pasajeros',
    totalLabel: 'Total',
    depositPaid: '✅ Anticipo pagado',
    balanceDue: '💳 Saldo al check-in',
    meetingPoint: '📍 Punto de encuentro: Porto Turistico Masuccio Salernitano',
    forQuestions: 'Para cualquier consulta, contáctenos:',
    thanks: '¡Gracias y buen viaje! ⛵',
    reminderTitle: '⏰ *Recordatorio de Reserva*',
    reminderText: '¡le recordamos su reserva de mañana!',
    seeYouTomorrow: '¡Hasta mañana! ⛵',
  },
}

function getFreeFormStrings(lang: string): FreeFormStrings {
  return freeFormStrings[lang] || freeFormStrings.it
}

// ═══════════════════════════════════════
// CONFERMA PRENOTAZIONE AL CLIENTE (free-form)
// ═══════════════════════════════════════
interface BookingData {
  booking_number: string
  customer_name: string
  boat_name: string
  service_name: string
  booking_date: string
  time_slot: string
  num_passengers: number
  final_price: number
  deposit_amount: number
  notes?: string
  lang?: string
}

export async function sendBookingConfirmationWhatsApp(
  customerPhone: string,
  data: BookingData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const lang = data.lang || 'it'
  const t = getFreeFormStrings(lang)
  const saldo = data.final_price - data.deposit_amount

  const message = [
    t.bookingConfirmed,
    ``,
    `${t.hello} ${data.customer_name},`,
    t.bookingConfirmedText,
    ``,
    `📋 *${data.booking_number}*`,
    `🚤 ${data.boat_name}`,
    `⚓ ${data.service_name}`,
    `📅 ${formatDate(data.booking_date, lang)}`,
    `⏰ ${getTimeSlot(data.time_slot, lang)}`,
    `👥 ${data.num_passengers} ${t.passengersLabel}`,
    ``,
    `💰 ${t.totalLabel}: €${data.final_price.toFixed(2)}`,
    data.deposit_amount > 0 ? `${t.depositPaid}: €${data.deposit_amount.toFixed(2)}` : '',
    saldo > 0 ? `${t.balanceDue}: €${saldo.toFixed(2)}` : '',
    ``,
    t.meetingPoint,
    ``,
    t.forQuestions,
    `📞 +39 089 123456`,
    `📧 booking@rentsalernoboat.it`,
    ``,
    t.thanks,
    `_NS3000 Rent Srl_`,
  ].filter(Boolean).join('\n')

  return sendWhatsApp(customerPhone, message)
}

// ═══════════════════════════════════════
// LINK CAUZIONE (STRIPE) — template approvato
// ═══════════════════════════════════════
export async function sendCautionWhatsApp(
   customerPhone: string,
   data: {
     customer_name: string
     booking_id: string
     booking_number: string
     boat_name: string
     caution_amount: number
     payment_link: string
     lang?: string
   }
 ): Promise<{ success: boolean; messageId?: string; error?: string }> {
   const lang = data.lang || 'it'
   const contentSid = getCautionTemplateSid(lang)

   const contentVariables: Record<string, string> = {
     '1': data.customer_name,
     '2': data.booking_number,
     '3': data.boat_name,
     '4': data.caution_amount.toFixed(2),
     '5': data.booking_id,
   }

   return sendWhatsAppTemplate(customerPhone, contentSid, contentVariables)
 }
// ═══════════════════════════════════════
// NOTIFICA PRENOTAZIONE AL FORNITORE (free-form, IT only — notifica interna)
// ═══════════════════════════════════════
export async function sendBookingNotificationToSupplier(
  supplierPhone: string,
  supplierName: string,
  data: BookingData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const saldo = data.final_price - data.deposit_amount

  const message = [
    `🚤 *NS3000 - Nuova Prenotazione*`,
    ``,
    `📋 *${data.booking_number}*`,
    `👤 ${data.customer_name}`,
    `🚤 ${data.boat_name}`,
    `⚓ ${data.service_name}`,
    `📅 ${formatDate(data.booking_date)}`,
    `⏰ ${getTimeSlot(data.time_slot)}`,
    `👥 ${data.num_passengers} pax`,
    `💰 €${data.final_price.toFixed(0)} (acc. €${data.deposit_amount.toFixed(0)}${saldo > 0 ? ` | saldo €${saldo.toFixed(0)}` : ''})`,
    data.notes ? `📝 ${data.notes}` : '',
  ].filter(Boolean).join('\n')

  return sendWhatsApp(supplierPhone, message)
}

// ═══════════════════════════════════════
// PROMEMORIA PRENOTAZIONE (free-form)
// ═══════════════════════════════════════
export async function sendReminderWhatsApp(
  customerPhone: string,
  data: {
    customer_name: string
    booking_number: string
    boat_name: string
    service_name: string
    booking_date: string
    time_slot: string
    lang?: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const lang = data.lang || 'it'
  const t = getFreeFormStrings(lang)

  const message = [
    t.reminderTitle,
    ``,
    `${t.hello} ${data.customer_name},`,
    t.reminderText,
    ``,
    `📋 *${data.booking_number}*`,
    `🚤 ${data.boat_name}`,
    `⚓ ${data.service_name}`,
    `📅 ${formatDate(data.booking_date, lang)}`,
    `⏰ ${getTimeSlot(data.time_slot, lang)}`,
    ``,
    t.meetingPoint,
    ``,
    t.seeYouTomorrow,
    `_NS3000 Rent Srl_`,
  ].join('\n')

  return sendWhatsApp(customerPhone, message)
}

// ═══════════════════════════════════════
// MESSAGGIO BENVENUTO LOCAZIONE (RENTAL)
// Template approvato (IT/EN/ES con fallback IT) + foto meeting point free-form
// ═══════════════════════════════════════
export async function sendRentalWelcomeWhatsApp(
  customerPhone: string,
  data: {
    customer_name: string
    booking_number: string
    boat_name: string
    booking_date: string
    time_slot: string
    lang?: string
  }
): Promise<{ success: boolean; results: string[]; errors: string[] }> {
  const lang = data.lang || 'it'
  const results: string[] = []
  const errors: string[] = []

  // ─── MESSAGGIO 1: Template approvato con 4 variabili ─────────
  const contentSid = getWelcomeTemplateSid(lang)

  const contentVariables: Record<string, string> = {
    '1': data.customer_name,
    '2': data.booking_number,
    '3': data.boat_name,
    '4': formatDate(data.booking_date, lang),
  }

  const templateResult = await sendWhatsAppTemplate(customerPhone, contentSid, contentVariables)
  if (templateResult.success) {
    results.push('Welcome template')
  } else {
    errors.push(`Template: ${templateResult.error}`)
    return { success: false, results, errors }
  }

  return { success: results.length > 0, results, errors }
}
// ═══════════════════════════════════════
// NOTIFICA NUOVA PRENOTAZIONE AL DESK NS3000 (template approvato — 29 apr 2026)
// 8 variabili: booking_number, customer_name, boat_name, date_formatted, 
//              time_slot, num_passengers, price_summary, notes
// ═══════════════════════════════════════
export async function sendBookingNotificationToDesk(
  deskPhone: string,
  data: BookingData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const lang = data.lang || 'it'
  const saldo = data.final_price - data.deposit_amount

  // Costruisci riepilogo prezzo
  const priceSummary = `€${data.final_price.toFixed(0)} (acc. €${data.deposit_amount.toFixed(0)}${
    saldo > 0 ? ` | saldo €${saldo.toFixed(0)}` : ''
  })`

  // Note: se vuote, manda placeholder (Twilio non accetta variabili vuote)
  const notesValue = data.notes && data.notes.trim() ? data.notes.trim() : '—'

  const contentVariables: Record<string, string> = {
    '1': data.booking_number,
    '2': data.customer_name,
    '3': data.boat_name,
    '4': formatDate(data.booking_date, lang),
    '5': getTimeSlot(data.time_slot, lang),
    '6': String(data.num_passengers),
    '7': priceSummary,
    '8': notesValue,
  }

  return sendWhatsAppTemplate(
    deskPhone,
    TEMPLATES.booking_notification_desk_it,
    contentVariables
  )
}/**
 * Invia richiesta recensione Google al cliente via WhatsApp.
 * Usa il template Twilio Content `google_review_<lang>` con CTA approvato da Meta.
 * Il link Google review è statico nel template (non parametrizzato).
 */
export async function sendGoogleReviewWhatsApp(
  customerPhone: string,
  data: {
    customer_name: string
    booking_date: string
    lang?: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const lang = data.lang || 'it'
  const contentSid = getGoogleReviewTemplateSid(lang)

  const contentVariables: Record<string, string> = {
    '1': data.customer_name,
    '2': formatDate(data.booking_date, lang),
  }

  return sendWhatsAppTemplate(customerPhone, contentSid, contentVariables)
}
