import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-client'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

// Helper per verificare se l'utente è admin
async function isAdmin() {
  const cookieStore = await cookies()
  const userCookie = cookieStore.get('user')
  
  if (!userCookie?.value) {
    return false
  }
  
  const user = JSON.parse(userCookie.value)
  return user.role === 'admin'
}

// GET - Lista tutti gli utenti (solo admin)
export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, is_active, last_login, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error loading users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crea nuovo utente (solo admin)
export async function POST(request: Request) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, full_name, role, is_active } = body

    // Validazione
    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Email, password e nome sono obbligatori' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password deve essere almeno 6 caratteri' },
        { status: 400 }
      )
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10)

    // Crea utente
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([{
        email,
        password_hash,
        full_name,
        role: role || 'staff',
        is_active: is_active !== undefined ? is_active : true
      }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Email già esistente' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
