import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const authCookie = cookieStore.get('auth')
    const userCookie = cookieStore.get('user')

    if (authCookie?.value !== 'true' || !userCookie?.value) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const user = JSON.parse(userCookie.value)
    
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}
