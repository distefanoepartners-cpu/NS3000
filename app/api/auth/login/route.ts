import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-client'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    
    // Cerca l'utente nel database
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // Verifica password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // Aggiorna last_login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id)

    // Crea cookie di sessione con info utente
    const cookieStore = await cookies()
    
    // Cookie con flag di autenticazione
    cookieStore.set('auth', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 giorni
    })

    // Cookie con info utente (per accesso rapido)
    cookieStore.set('user', JSON.stringify({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })
    
    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}
