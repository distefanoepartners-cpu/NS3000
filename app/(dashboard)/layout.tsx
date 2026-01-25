'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, Menu, X, Ship, Anchor, Calendar, MapPin, Users, Building2, BarChart3, UserCircle, Settings } from 'lucide-react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import NotificationManager from '@/components/NotificationManager'
import BriefingModal from '@/components/BriefingModal'
import InAppNotificationHandler from '@/components/InAppNotificationHandler';

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, loading, isAdmin, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  // Loading screen durante caricamento auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  // Menu items dinamici basati sul ruolo
  const allMenuItems = [
    { href: '/', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'staff'] },
    { href: '/bookings', label: 'Prenotazioni', icon: Calendar, roles: ['admin', 'staff'] },
    { href: '/boats', label: 'Flotta', icon: Ship, roles: ['admin'] },
    { href: '/services', label: 'Servizi', icon: Anchor, roles: ['admin'] },
    { href: '/skippers', label: 'Skipper', icon: UserCircle, roles: ['admin'] },
    { href: '/customers', label: 'Clienti', icon: Users, roles: ['admin'] },
    { href: '/suppliers', label: 'Fornitori', icon: Building2, roles: ['admin'] },
    { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin'] },
    { href: '/users', label: 'Gestione Utenti', icon: Settings, roles: ['admin'] },
    { href: '/briefings', label: 'Promemoria', icon: Calendar, roles: ['admin'] },
  ]

  // Filtra menu basato sul ruolo
  const menuItems = allMenuItems.filter(item => 
    item.roles.includes(user?.role || 'staff')
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer">
                <img src="/icon-192.png" alt="NS3000" className="h-10 w-10" />
                <div>
                  <h1 className="text-xl font-bold text-blue-600">NS3000Rent srl</h1>
                  {user && (
                    <p className="text-xs text-gray-500">
                      {user.full_name} 
                      {!isAdmin && <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Solo Lettura</span>}
                    </p>
                  )}
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-2">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" size="sm">{item.label}</Button>
                </Link>
              ))}
            </nav>

            {/* Desktop Actions: Notifications + Logout */}
            <div className="hidden md:flex items-center gap-3">
              {user && <NotificationManager userId={user.id} />}
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
              {/* Mobile Notifications */}
              {user && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <NotificationManager userId={user.id} />
                </div>
              )}
              
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
      {/* Handler notifiche in-app quando app è visibile */}
      <InAppNotificationHandler />
      
      {/* Briefing Modal - DEVE essere letto */}
      {user && <BriefingModal userId={user.id} />}
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  )
}