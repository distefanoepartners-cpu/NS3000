import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST - Invia email estratto conto
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Verifica che la API key sia configurata
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY non configurata' },
        { status: 500 }
      )
    }

    // Invia email con Resend
    const { data, error } = await resend.emails.send({
      from: 'NS3000 RENT <noreply@ns3000.com>', // Sostituisci con il tuo dominio verificato
      to: body.to,
      subject: body.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0066cc;">NS3000 RENT</h2>
          <div style="white-space: pre-wrap; line-height: 1.6;">
            ${body.message}
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Questa è una email automatica da NS3000 RENT. Per assistenza contattaci.
          </p>
        </div>
      `,
      text: body.message
    })

    if (error) {
      console.error('Errore Resend:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Email inviata con successo:', data)
    return NextResponse.json({ 
      success: true, 
      message: 'Email inviata con successo',
      emailId: data?.id 
    })
  } catch (error: any) {
    console.error('Errore invio email:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}