// app/api/bookings/[id]/send-welcome/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import { sendRentalWelcomeWhatsApp } from '@/lib/whatsapp-service'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const bookingId = params.id

    // Carica prenotazione con dati
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(id, first_name, last_name, phone, email),
        boat:boats(id, name),
        service:rental_services(id, name, service_type)
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 })
    }

    // Solo per locazione (rental)
    if (booking.service?.service_type !== 'rental') {
      return NextResponse.json(
        { error: 'Il messaggio di benvenuto è disponibile solo per le locazioni (self-drive)' },
        { status: 400 }
      )
    }

    // Almeno email o telefono
    if (!booking.customer?.phone && !booking.customer?.email) {
      return NextResponse.json(
        { error: 'Il cliente non ha né telefono né email' },
        { status: 400 }
      )
    }

    const customerName = `${booking.customer.first_name} ${booking.customer.last_name}`
    const lang = booking.lang || 'it'
    const bookingNumber = booking.booking_number || bookingId.slice(0, 8).toUpperCase()
    const boatName = booking.boat?.name || ''
    const bookingDate = booking.booking_date
    const timeSlot = booking.time_slot || 'full_day'

    const allResults: string[] = []
    const allErrors: string[] = []

    // ─── INVIO WHATSAPP ──────────────────────────────────
    if (booking.customer?.phone) {
      try {
        const waResult = await sendRentalWelcomeWhatsApp(booking.customer.phone, {
          customer_name: customerName,
          booking_number: bookingNumber,
          boat_name: boatName,
          booking_date: bookingDate,
          time_slot: timeSlot,
          lang,
        })
        allResults.push(...waResult.results.map(r => `📱 ${r}`))
        allErrors.push(...waResult.errors.map(e => `📱 ${e}`))
      } catch (waErr: any) {
        console.error('❌ WhatsApp error:', waErr.message)
        allErrors.push(`📱 WhatsApp: ${waErr.message}`)
      }
    }

    // ─── INVIO EMAIL ─────────────────────────────────────
    if (booking.customer?.email) {
      try {
        const resend = getResend()
        const emailHtml = generateWelcomeEmail(customerName, bookingNumber, boatName, bookingDate, timeSlot, lang)

        const subjects: Record<string, string> = {
          en: `⛵ Welcome aboard! Rental info - ${bookingNumber}`,
          es: `⛵ ¡Bienvenido a bordo! Info alquiler - ${bookingNumber}`,
          it: `⛵ Benvenuto a bordo! Info locazione - ${bookingNumber}`,
        }

        await resend.emails.send({
          from: 'NS3000 Rent <booking@rentsalernoboat.it>',
          to: [booking.customer.email],
          subject: subjects[lang] || subjects.it,
          html: emailHtml,
        })

        console.log('✅ [welcome] Email sent to:', booking.customer.email)
        allResults.push(`📧 Email a ${booking.customer.email}`)
      } catch (emailErr: any) {
        console.error('❌ Email error:', emailErr.message)
        allErrors.push(`📧 Email: ${emailErr.message}`)
      }
    }

    // Log invio
    try {
      await supabaseAdmin.from('notification_logs').insert({
        booking_id: bookingId,
        type: 'welcome_rental',
        title: 'Messaggio Benvenuto Locazione',
        body: `Inviato a ${customerName} — ${allResults.join(', ')}`,
        delivery_status: allResults.length > 0 ? 'sent' : 'failed',
        metadata: { results: allResults, errors: allErrors }
      })
    } catch (logErr) {
      console.warn('⚠️ Log non salvato:', logErr)
    }

    return NextResponse.json({
      success: allResults.length > 0,
      sent: allResults,
      errors: allErrors.length > 0 ? allErrors : undefined,
      message: allResults.length > 0
        ? `Messaggio benvenuto inviato: ${allResults.join(', ')}`
        : 'Errore invio messaggio benvenuto'
    })

  } catch (error: any) {
    console.error('❌ [send-welcome] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── TRADUZIONI (it/en/es) ───────────────────────────────────────

interface WelcomeStrings {
  welcome: string
  booking: string
  boat: string
  date: string
  time: string
  dear: string
  greeting: string
  portContacts: string
  portAccessWarning: string
  returnToPort: string
  returnInstructions: string
  returnAssistance: string
  safetyRules: string
  safetyIntro: string
  safetyBeach: string
  safetyRocks: string
  meetingPointDeparture: string
  openInMaps: string
  returnMeetingPoint: string
  returnMeetingText: string
  coordinates: string
  openMapsReturn: string
  boatTutorial: string
  tutorialIntro: string
  watchTutorial: string
  contacts: string
  allRights: string
}

const welcomeStrings: Record<string, WelcomeStrings> = {
  it: {
    welcome: 'Benvenuto a Bordo!',
    booking: 'Prenotazione',
    boat: 'Barca',
    date: 'Data',
    time: 'Fascia',
    dear: 'Gentile',
    greeting: '',
    portContacts: 'Contatti Porti',
    portAccessWarning: "L'accesso ai porti e' consentito solo con assistenza e non in autonomia.",
    returnToPort: 'Rientro al Porto',
    returnInstructions: 'La invitiamo a contattarci <strong>30 minuti prima del rientro</strong> al Porto di Salerno:',
    returnAssistance: "Al Meeting Point di Rientro (vedi sotto) un nostro gommone vi fornirà assistenza per il rifornimento.",
    safetyRules: 'Regole di Sicurezza',
    safetyIntro: 'Durante la navigazione, le ricordiamo di mantenere:',
    safetyBeach: 'metri dalle spiagge popolate',
    safetyRocks: 'metri dalla costa rocciosa',
    meetingPointDeparture: "Punto d'Incontro — Andata",
    openInMaps: 'Apri su Google Maps',
    returnMeetingPoint: 'Punto di Rientro e Rifornimento',
    returnMeetingText: 'Al Meeting Point di Rientro troverai il nostro gommone che ti assisterà per il rifornimento prima del rientro al molo.',
    coordinates: 'Coordinate',
    openMapsReturn: 'Apri Maps Rientro',
    boatTutorial: 'Tutorial Imbarcazione',
    tutorialIntro: "Ti invitiamo a guardare questo breve video prima della partenza. Ti aiutera' a familiarizzare con i comandi e le dotazioni di sicurezza.",
    watchTutorial: 'Guarda il Tutorial',
    contacts: 'Per informazioni:',
    allRights: 'Tutti i diritti riservati',
  },
  en: {
    welcome: 'Welcome Aboard!',
    booking: 'Booking',
    boat: 'Boat',
    date: 'Date',
    time: 'Time',
    dear: 'Dear',
    greeting: '',
    portContacts: 'Port Contacts',
    portAccessWarning: 'Access to the ports is only allowed with assistance and not independently.',
    returnToPort: 'Return to Port',
    returnInstructions: 'Please contact us <strong>30 minutes before your return</strong> to the Port of Salerno:',
    returnAssistance: 'At the Return Meeting Point (see below) one of our dinghies will assist you with refuelling.',
    safetyRules: 'Safety Rules',
    safetyIntro: 'During your navigation, for your safety, please keep:',
    safetyBeach: 'meters (980 feet) from the beach',
    safetyRocks: 'meters (490 feet) from the rocky coast',
    meetingPointDeparture: 'Departure Meeting Point',
    openInMaps: 'Open in Google Maps',
    returnMeetingPoint: 'Return / Refuelling Point',
    returnMeetingText: 'Meet our dinghy just outside the port for assistance with refuelling before returning to the dock.',
    coordinates: 'Coordinates',
    openMapsReturn: 'Open Return Maps',
    boatTutorial: 'Boat Tutorial',
    tutorialIntro: 'Please watch this short video before your departure. It will help you get familiar with the boat controls and safety equipment.',
    watchTutorial: 'Watch Tutorial',
    contacts: 'For questions:',
    allRights: 'All rights reserved',
  },
  // ⭐ Spagnolo neutro
  es: {
    welcome: '¡Bienvenido a Bordo!',
    booking: 'Reserva',
    boat: 'Embarcación',
    date: 'Fecha',
    time: 'Horario',
    dear: 'Estimado/a',
    greeting: '',
    portContacts: 'Contactos Puertos',
    portAccessWarning: 'El acceso a los puertos solo está permitido con asistencia y no de forma independiente.',
    returnToPort: 'Regreso al Puerto',
    returnInstructions: 'Le invitamos a contactarnos <strong>30 minutos antes del regreso</strong> al Puerto de Salerno:',
    returnAssistance: 'En el Punto de Encuentro de Regreso (ver abajo) una de nuestras lanchas les asistirá para el reabastecimiento de combustible.',
    safetyRules: 'Reglas de Seguridad',
    safetyIntro: 'Durante la navegación, por su seguridad, le recordamos mantener:',
    safetyBeach: 'metros de las playas concurridas',
    safetyRocks: 'metros de la costa rocosa',
    meetingPointDeparture: 'Punto de Encuentro — Ida',
    openInMaps: 'Abrir en Google Maps',
    returnMeetingPoint: 'Punto de Regreso y Reabastecimiento',
    returnMeetingText: 'En el Punto de Encuentro de Regreso encontrará nuestra lancha que le asistirá para el reabastecimiento de combustible antes del regreso al muelle.',
    coordinates: 'Coordenadas',
    openMapsReturn: 'Abrir Maps Regreso',
    boatTutorial: 'Tutorial Embarcación',
    tutorialIntro: 'Le invitamos a ver este breve video antes de la partida. Le ayudará a familiarizarse con los controles y equipos de seguridad.',
    watchTutorial: 'Ver Tutorial',
    contacts: 'Para información:',
    allRights: 'Todos los derechos reservados',
  },
}

// ─── EMAIL TEMPLATE ──────────────────────────────────────
function generateWelcomeEmail(
  customerName: string,
  bookingNumber: string,
  boatName: string,
  bookingDate: string,
  timeSlot: string,
  lang: string
): string {
  const t = welcomeStrings[lang] || welcomeStrings.it

  const localeMap: Record<string, string> = {
    it: 'it-IT',
    en: 'en-GB',
    es: 'es-ES',
  }

  const formattedDate = (() => {
    try {
      const d = new Date(bookingDate + 'T00:00:00')
      return d.toLocaleDateString(localeMap[lang] || 'it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    } catch { return bookingDate }
  })()

  // Time slot label
  const timeSlotLabels: Record<string, Record<string, string>> = {
    it: {
      morning: 'Mattina (9:00-13:00)',
      afternoon: 'Pomeriggio (14:00-18:00)',
      full_day: 'Giornata Intera (9:00-18:00)',
    },
    en: {
      morning: 'Morning (9:00-13:00)',
      afternoon: 'Afternoon (14:00-18:00)',
      full_day: 'Full Day (9:00-18:00)',
    },
    es: {
      morning: 'Mañana (9:00-13:00)',
      afternoon: 'Tarde (14:00-18:00)',
      full_day: 'Día completo (9:00-18:00)',
    },
  }
  const timeSlotLabel = timeSlotLabels[lang]?.[timeSlot] || timeSlotLabels.it[timeSlot] || timeSlot

  const tutorialUrls: Record<string, string> = {
    en: 'https://rentsalernoboat.it/wp-content/uploads/2026/04/Tutorial-ENG.mp4',
    es: 'https://rentsalernoboat.it/wp-content/uploads/2026/04/Tutorial-ENG.mp4',
    it: 'https://rentsalernoboat.it/wp-content/uploads/2026/04/Tutorial-ITA.mp4',
  }
  const tutorialUrl = tutorialUrls[lang] || tutorialUrls.it

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:600px;">

        <!-- LOGO -->
        <tr><td style="background-color:#fff;padding:20px 30px;text-align:center;">
          <img src="https://ns-3000.vercel.app/logo-ns3000.png" alt="NS3000 Rent" style="max-width:180px;height:auto;display:inline-block;" />
        </td></tr>

        <!-- HEADER -->
        <tr><td style="background-color:#0284C7;padding:20px 30px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">
            ⛵ ${t.welcome}
          </h1>
          <p style="margin:8px 0 0 0;color:#bae6fd;font-size:15px;">
            ${t.booking}: <strong style="color:#fff;">${bookingNumber}</strong>
          </p>
        </td></tr>

        <!-- DETTAGLI PRENOTAZIONE -->
        <tr><td style="padding:25px 30px 15px;">
          <p style="margin:0 0 15px 0;color:#374151;font-size:16px;">
            ${t.dear} <strong>${customerName}</strong>,
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border-radius:8px;border-left:4px solid #0284C7;margin-bottom:20px;">
            <tr><td style="padding:15px;">
              <table width="100%" cellpadding="4" cellspacing="0">
                <tr>
                  <td style="color:#6b7280;font-size:14px;width:120px;">🚤 ${t.boat}:</td>
                  <td style="color:#1f2937;font-size:14px;font-weight:600;">${boatName}</td>
                </tr>
                <tr>
                  <td style="color:#6b7280;font-size:14px;">📅 ${t.date}:</td>
                  <td style="color:#1f2937;font-size:14px;font-weight:600;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="color:#6b7280;font-size:14px;">⏰ ${t.time}:</td>
                  <td style="color:#1f2937;font-size:14px;font-weight:600;">${timeSlotLabel}</td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- CONTATTI PORTI -->
        <tr><td style="padding:0 30px 20px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#1f2937;">📞 ${t.portContacts}</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-radius:8px;border:1px solid #fde68a;">
            <tr><td style="padding:15px;">
              <table width="100%" cellpadding="4" cellspacing="0" style="font-size:14px;">
                <tr>
                  <td style="color:#92400e;font-weight:600;">🏖️ Cetara</td>
                  <td style="color:#1f2937;">Salvatore — <a href="tel:+393519469599" style="color:#0284C7;text-decoration:none;">+39 351 946 9599</a></td>
                </tr>
                <tr>
                  <td style="color:#92400e;font-weight:600;">🏖️ Minori</td>
                  <td style="color:#1f2937;">Filippo — <a href="tel:+393397927824" style="color:#0284C7;text-decoration:none;">+39 339 792 7824</a></td>
                </tr>
                <tr>
                  <td style="color:#92400e;font-weight:600;">🏖️ Amalfi</td>
                  <td style="color:#1f2937;">Giulio Coppola — <a href="tel:+393473495280" style="color:#0284C7;text-decoration:none;">+39 347 349 5280</a></td>
                </tr>
                <tr>
                  <td style="color:#92400e;font-weight:600;">🏖️ Positano</td>
                  <td style="color:#1f2937;">Lucibello — <a href="tel:+393667529243" style="color:#0284C7;text-decoration:none;">+39 366 752 9243</a></td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:12px;color:#92400e;font-style:italic;">
                ⚠️ ${t.portAccessWarning}
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- RIENTRO AL PORTO -->
        <tr><td style="padding:0 30px 20px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#1f2937;">⚓ ${t.returnToPort}</h2>
          <div style="background:#f0fdf4;border-radius:8px;border:1px solid #86efac;padding:15px;">
            <p style="margin:0;font-size:14px;color:#166534;">
              ${t.returnInstructions}
            </p>
            <p style="margin:10px 0 0;font-size:20px;font-weight:700;color:#166534;text-align:center;">
              📞 <a href="tel:+393881140189" style="color:#166534;text-decoration:none;">+39 388 114 0189</a>
            </p>
            <p style="margin:10px 0 0;font-size:13px;color:#166534;">
              ${t.returnAssistance}
            </p>
          </div>
        </td></tr>

        <!-- REGOLE SICUREZZA -->
        <tr><td style="padding:0 30px 20px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#1f2937;">🛟 ${t.safetyRules}</h2>
          <div style="background:#fef2f2;border-radius:8px;border:1px solid #fca5a5;padding:15px;">
            <p style="margin:0;font-size:14px;color:#991b1b;">
              ${t.safetyIntro}
            </p>
            <ul style="margin:8px 0 0;padding-left:20px;color:#991b1b;font-size:14px;">
              <li style="margin-bottom:4px;"><strong>300 ${t.safetyBeach}</strong></li>
              <li><strong>150 ${t.safetyRocks}</strong></li>
            </ul>
          </div>
        </td></tr>

        <!-- MEETING POINT ANDATA -->
        <tr><td style="padding:0 30px 20px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#1f2937;">📍 ${t.meetingPointDeparture}</h2>
          <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
            <img src="https://rentsalernoboat.it/wp-content/uploads/2026/04/meeting-point.jpeg"
                 alt="Meeting Point NS3000"
                 width="540"
                 style="display:block;width:100%;max-width:540px;max-height:320px;height:auto;object-fit:cover;margin:0 auto;" />
            <div style="padding:12px;text-align:center;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1f2937;">Porto Masuccio Salernitano — Molo Manfredi</p>
              <a href="https://maps.google.com/?q=40.6718121,14.7671605" style="display:inline-block;background:#0284C7;color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;">
                📍 ${t.openInMaps}
              </a>
            </div>
          </div>
        </td></tr>

        <!-- MEETING POINT RIENTRO -->
        <tr><td style="padding:0 30px 20px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#1f2937;">⛽ ${t.returnMeetingPoint}</h2>
          <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:15px;text-align:center;">
            <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">
              ${t.returnMeetingText}
            </p>
            <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#1f2937;">
              ${t.coordinates}: 40°40′24.3″N 14°45′56.2″E
            </p>
            <a href="https://maps.google.com/?q=40.6734167,14.7656111" style="display:inline-block;background:#0284C7;color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;">
              📍 ${t.openMapsReturn}
            </a>
          </div>
        </td></tr>

        <!-- VIDEO TUTORIAL -->
        <tr><td style="padding:0 30px 25px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#1f2937;">🎬 ${t.boatTutorial}</h2>
          <div style="background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;padding:15px;text-align:center;">
            <p style="margin:0 0 12px;font-size:14px;color:#0369a1;">
              ${t.tutorialIntro}
            </p>
            <a href="${tutorialUrl}" style="display:inline-block;background:#0284C7;color:#fff;text-decoration:none;padding:10px 25px;border-radius:6px;font-size:14px;font-weight:600;">
              ▶️ ${t.watchTutorial}
            </a>
          </div>
        </td></tr>

        <!-- CONTATTI -->
        <tr><td style="padding:0 30px 20px;">
          <div style="background:#f9fafb;padding:16px;border-radius:8px;text-align:center;">
            <p style="margin:0;color:#374151;font-size:14px;">
              ${t.contacts}<br>
              📧 <a href="mailto:ns3000rent@gmail.com" style="color:#0284C7;text-decoration:none;font-weight:600;">ns3000rent@gmail.com</a> •
              📱 <a href="tel:+393881140189" style="color:#0284C7;text-decoration:none;font-weight:600;">+39 388 114 0189</a>
            </p>
          </div>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:20px 30px;background-color:#1e3a5f;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">
            NS3000 Rent Srl — Porto Masuccio Salernitano, Salerno<br>
            © ${new Date().getFullYear()} ${t.allRights}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}