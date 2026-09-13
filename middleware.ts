import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  // ⭐ Bypass middleware per cron jobs Vercel
  // (le route handlers sono già protette da CRON_SECRET)
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next()
  }
  // ⭐ 2026-05-22: rimosso bypass per /api/notifications/send-push
  // (feature push notifications dismessa, endpoint cancellato).
  // ⭐ FIX 27/04/2026: Rotte pubbliche per il flusso cauzione cliente
  // Queste rotte vengono cliccate da clienti che non hanno credenziali backoffice:
  //   - /c/[id]               → endpoint redirect short link WhatsApp
  //   - /caution/success      → pagina ritorno dopo pagamento Stripe
  //   - /caution/cancel       → pagina ritorno se cliente annulla
  //   - /api/webhooks/*       → webhook Stripe (chiamati da Stripe, non da utente)
  if (
    pathname.startsWith('/c/') ||
    pathname.startsWith('/caution/') ||
    pathname.startsWith('/api/webhooks/')
  ) {
    return NextResponse.next()
  }
  const authCookie = req.cookies.get('auth')
  const isLoginPage = pathname.startsWith('/login')
  const isApiAuth = pathname.startsWith('/api/auth')
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
// ⭐ 2026-05-19: api/bookings/.+/send- escluso per chiamate dal plugin WP del sito.
// ⭐ 2026-05-22: rimosso api/notifications/send-push dal matcher (feature dismessa).
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon-.*\\.png|manifest\\.json|sw\\.js|api/auth|api/external|api/cron|api/bookings/.+/send-).*)',
  ],
}