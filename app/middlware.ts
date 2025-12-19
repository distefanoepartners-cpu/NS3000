import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Se non c'è sessione e non è la pagina di login, redirect a login
  if (!session && !req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Se c'è sessione e sta cercando di accedere a login, redirect a dashboard
  if (session && req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/boats', req.url))
  }

  return res
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