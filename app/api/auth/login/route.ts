import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()
    
    // Controlla password
    if (password === process.env.APP_PASSWORD) {
      // Crea cookie di sessione
      const cookieStore = await cookies()
      cookieStore.set('auth', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 giorni
      })
      
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Password errata' }, { status: 401 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}