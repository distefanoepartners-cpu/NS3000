import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { bookingId } = await request.json()

    // Carica dati prenotazione
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customers(first_name, last_name, email),
        boat:boats(name),
        service:services(name),
        time_slot:time_slots(start_time, end_time)
      `)
      .eq('id', bookingId)
      .single()

    if (error) throw error

    if (!booking.customer?.email) {
      throw new Error('Email cliente non trovata')
    }

    // Template email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .info-label { font-weight: bold; color: #6b7280; }
            .info-value { color: #111827; }
            .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚤 Conferma Prenotazione</h1>
              <p>NS3000 RENT</p>
            </div>
            <div class="content">
              <p>Gentile ${booking.customer.first_name} ${booking.customer.last_name},</p>
              <p>La tua prenotazione è stata confermata con successo!</p>
              
              <div class="info-box">
                <h3>📋 Dettagli Prenotazione</h3>
                <div class="info-row">
                  <span class="info-label">Numero Prenotazione:</span>
                  <span class="info-value">${booking.booking_number}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Data:</span>
                  <span class="info-value">${new Date(booking.booking_date).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                ${booking.time_slot ? `
                <div class="info-row">
                  <span class="info-label">Orario:</span>
                  <span class="info-value">${booking.time_slot.start_time} - ${booking.time_slot.end_time}</span>
                </div>
                ` : ''}
                <div class="info-row">
                  <span class="info-label">Servizio:</span>
                  <span class="info-value">${booking.service?.name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Imbarcazione:</span>
                  <span class="info-value">${booking.boat?.name}</span>
                </div>
                ${booking.num_passengers ? `
                <div class="info-row">
                  <span class="info-label">Passeggeri:</span>
                  <span class="info-value">${booking.num_passengers}</span>
                </div>
                ` : ''}
              </div>

              <div class="info-box">
                <h3>💰 Dettagli Pagamento</h3>
                <div class="info-row">
                  <span class="info-label">Importo Totale:</span>
                  <span class="info-value"><strong>€${(booking.final_price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></span>
                </div>
                ${booking.deposit_amount ? `
                <div class="info-row">
                  <span class="info-label">Acconto Pagato:</span>
                  <span class="info-value">€${booking.deposit_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                </div>
                ` : ''}
                <div class="info-row">
                  <span class="info-label">Saldo da Pagare:</span>
                  <span class="info-value">€${((booking.final_price || 0) - (booking.deposit_amount || 0) - (booking.balance_amount || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              ${booking.notes ? `
              <div class="info-box">
                <h3>📝 Note</h3>
                <p>${booking.notes}</p>
              </div>
              ` : ''}

              <p>Per qualsiasi informazione, non esitare a contattarci.</p>
              
              <div class="footer">
                <p><strong>NS3000 RENT</strong></p>
                <p>info@ns3000rent.com</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    // Invia email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'NS3000 RENT <noreply@ns3000rent.com>',
      to: [booking.customer.email],
      subject: `Conferma Prenotazione ${booking.booking_number}`,
      html: emailHtml
    })

    if (emailError) throw emailError

    // Aggiorna flag email inviata
    await supabaseAdmin
      .from('bookings')
      .update({ email_sent: true })
      .eq('id', bookingId)

    return NextResponse.json({ success: true, emailId: emailData?.id })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}