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
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icon-*.png, manifest.json, sw.js (PWA/static assets)
     * - api/auth (auth endpoints)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon-.*\\.png|manifest\\.json|sw\\.js|api/auth).*)',
  ],
}