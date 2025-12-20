import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('auth')
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isApiAuth = request.nextUrl.pathname.startsWith('/api/auth')

  // Se è già autenticato e va su login, redirect a boats
  if (authCookie?.value === 'true' && isLoginPage) {
    return NextResponse.redirect(new URL('/boats', request.url))
  }

  // Se non è autenticato e NON è su login o api/auth, redirect a login
  if (authCookie?.value !== 'true' && !isLoginPage && !isApiAuth) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/boats/:path*',
    '/services/:path*',
    '/bookings/:path*',
    '/customers/:path*',
    '/suppliers/:path*',
    '/planning/:path*',
    '/reports/:path*',
  ],
}