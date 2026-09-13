// lib/sms-service.ts
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const fromNumber = process.env.TWILIO_PHONE_NUMBER! // es: +1234567890

const client = twilio(accountSid, authToken)

interface BookingSmsData {
  booking_number: string
  customer_name: string
  boat_name: string
  service_name: string
  booking_date: string  // formato YYYY-MM-DD
  time_slot: string
  num_passengers: number
  final_price: number
  deposit_amount: number
  notes?: string
  lang?: string
}

// ⭐ Dizionario fasce orarie
const timeSlotLabels: Record<string, Record<string, string>> = {
  it: {
    morning: 'Mattina',
    afternoon: 'Pomeriggio',
    evening: 'Serale',
    full_day: 'Giornata Intera',
  },
  en: {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    full_day: 'Full Day',
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getTimeSlot(slot: string, lang: string = 'it'): string {
  return timeSlotLabels[lang]?.[slot] || timeSlotLabels['it']?.[slot] || slot
}

/**
 * Invia SMS di notifica prenotazione al fornitore
 */
export async function sendBookingSmsToSupplier(
  supplierPhone: string, 
  supplierName: string, 
  data: BookingSmsData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Formatta numero telefono italiano se necessario
    let phone = supplierPhone.replace(/\s+/g, '').replace(/-/g, '')
    if (phone.startsWith('3') && phone.length === 10) {
      phone = '+39' + phone
    } else if (!phone.startsWith('+')) {
      phone = '+39' + phone
    }

    const saldo = data.final_price - data.deposit_amount
    
    const message = [
      `🚤 NS3000 - Nuova Prenotazione`,
      ``,
      `📋 ${data.booking_number}`,
      `👤 ${data.customer_name}`,
      `🚤 ${data.boat_name}`,
      `⚓ ${data.service_name}`,
      `📅 ${formatDate(data.booking_date)}`,
      `⏰ ${getTimeSlot(data.time_slot)}`,
      `👥 ${data.num_passengers} pax`,
      `💰 €${data.final_price.toFixed(0)} (acc. €${data.deposit_amount.toFixed(0)}${saldo > 0 ? ` | saldo €${saldo.toFixed(0)}` : ''})`,
      data.notes ? `📝 ${data.notes}` : '',
    ].filter(Boolean).join('\n')

    console.log(`📱 SMS a ${supplierName} (${phone}): ${message.substring(0, 80)}...`)

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: phone,
    })

    console.log(`✅ SMS inviato: ${result.sid}`)
    return { success: true, messageId: result.sid }

  } catch (error: any) {
    console.error('❌ Errore invio SMS:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Invia SMS personalizzato
 */
export async function sendSms(
  to: string, 
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    let phone = to.replace(/\s+/g, '').replace(/-/g, '')
    if (phone.startsWith('3') && phone.length === 10) {
      phone = '+39' + phone
    } else if (!phone.startsWith('+')) {
      phone = '+39' + phone
    }

    const result = await client.messages.create({
      body,
      from: fromNumber,
      to: phone,
    })

    return { success: true, messageId: result.sid }
  } catch (error: any) {
    console.error('❌ Errore invio SMS:', error.message)
    return { success: false, error: error.message }
  }
}