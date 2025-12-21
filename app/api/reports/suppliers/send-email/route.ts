import { NextResponse } from 'next/server'

// POST - Invia email estratto conto
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // TODO: Implementare l'invio email effettivo
    // Per ora simuliamo l'invio
    console.log('Invio email:', {
      to: body.to,
      subject: body.subject,
      message: body.message,
      statement_id: body.statement_id
    })

    // In produzione, qui useresti un servizio come SendGrid, AWS SES, ecc.
    // Esempio con SendGrid:
    // const sgMail = require('@sendgrid/mail')
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    // await sgMail.send({
    //   to: body.to,
    //   from: 'noreply@ns3000.com',
    //   subject: body.subject,
    //   text: body.message,
    //   html: `<pre>${body.message}</pre>`
    // })

    return NextResponse.json({ success: true, message: 'Email inviata con successo' })
  } catch (error: any) {
    console.error('Errore invio email:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}