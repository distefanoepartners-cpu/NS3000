import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const authCookie = req.cookies.get('auth')
  const isLoginPage = req.nextUrl.pathname.startsWith('/login')
  const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth')

  // Se è già autenticato e va su login, redirect a root (dashboard)
  if (authCookie?.value === 'true' && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Se non è autenticato e NON è su login o api/auth, redirect a login
  if (authCookie?.value !== 'true' && !isLoginPage && !isApiAuth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/boats/:path*',
    '/services/:path*',
    '/bookings/:path*',
    '/customers/:path*',
    '/suppliers/:path*',
    '/planning/:path*',
    '/reports/:path*',
    '/login',
  ],
}