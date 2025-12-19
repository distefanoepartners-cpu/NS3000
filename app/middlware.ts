import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: req,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Se non c'è utente e non è la pagina di login, redirect a login
  if (!user && !req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Se c'è utente e sta cercando di accedere a login, redirect a dashboard
  if (user && req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/boats', req.url))
  }

  return supabaseResponse
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