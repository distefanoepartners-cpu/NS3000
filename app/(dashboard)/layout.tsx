'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, Menu, X, Ship, Anchor, Calendar, MapPin, Users, Building2, BarChart3 } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const menuItems = [
    { href: '/boats', label: 'Barche', icon: Ship },
    { href: '/services', label: 'Servizi', icon: Anchor },
    { href: '/bookings', label: 'Prenotazioni', icon: Calendar },
    { href: '/planning', label: 'Planning', icon: MapPin },
    { href: '/customers', label: 'Clienti', icon: Users },
    { href: '/suppliers', label: 'Fornitori', icon: Building2 },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/">
              <h1 className="text-xl font-bold text-blue-600 cursor-pointer">NS3000 RENT</h1>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-2">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" size="sm">{item.label}</Button>
                </Link>
              ))}
            </nav>

            {/* Desktop Logout */}
            <div className="hidden md:block">
              <Button variant="outline" onClick={handleLogout} size="sm" className="gap-2">
                <LogOut className="h-4 w-4" />
                Esci
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md hover:bg-gray-100"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-gray-600" />
              ) : (
                <Menu className="h-6 w-6 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-2 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-gray-100 text-gray-700"
                  >
                    <Icon className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )
              })}
              
              {/* Mobile Logout */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-md hover:bg-gray-100 text-red-600"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Esci</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}