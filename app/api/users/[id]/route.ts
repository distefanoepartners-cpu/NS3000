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

// PUT - Aggiorna utente (solo admin)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { email, password, full_name, role, is_active } = body

    const updateData: any = {
      full_name,
      role,
      is_active
    }

    // Se c'è una nuova password, hashala
    if (password && password.length >= 6) {
      updateData.password_hash = await bcrypt.hash(password, 10)
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Elimina utente (solo admin)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { id } = await params

    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
