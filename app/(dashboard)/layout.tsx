'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  const handleLogout = async () => {
    // Rimuovi cookie di autenticazione
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/">
                <h1 className="text-xl font-bold text-blue-600 cursor-pointer">NS3000 RENT</h1>
              </Link>
              <nav className="flex gap-4">
                <Link href="/boats">
                  <Button variant="ghost">Barche</Button>
                </Link>
                <Link href="/services">
                  <Button variant="ghost">Servizi</Button>
                </Link>
                <Link href="/bookings">
                  <Button variant="ghost">Prenotazioni</Button>
                </Link>
                <Link href="/planning">
                  <Button variant="ghost">Planning</Button>
                </Link>
                <Link href="/customers">
                  <Button variant="ghost">Clienti</Button>
                </Link>
                <Link href="/suppliers">
                  <Button variant="ghost">Fornitori</Button>
                </Link>
                <Link href="/reports">
                  <Button variant="ghost">Reports</Button>
                </Link>
              </nav>
            </div>
            
            {/* Logout Button */}
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}