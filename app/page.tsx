'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Ship, Anchor, Calendar, Users, Building2, MapPin, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const modules = [
    {
      title: 'Barche',
      description: 'Flotta disponibile',
      icon: Ship,
      href: '/boats',
      count: '10',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Servizi',
      description: 'Tour e noleggi',
      icon: Anchor,
      href: '/services',
      count: '8',
      color: 'from-cyan-500 to-cyan-600',
      bgColor: 'bg-cyan-50',
      iconColor: 'text-cyan-600'
    },
    {
      title: 'Prenotazioni',
      description: 'Gestione booking',
      icon: Calendar,
      href: '/bookings',
      count: '24',
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Planning',
      description: 'Calendario disponibilità',
      icon: MapPin,
      href: '/planning',
      count: '-',
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600'
    },
    {
      title: 'Clienti',
      description: 'Anagrafica clienti',
      icon: Users,
      href: '/customers',
      count: '156',
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      title: 'Fornitori',
      description: 'Partner e fornitori',
      icon: Building2,
      href: '/suppliers',
      count: '12',
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600'
    },
    {
      title: 'Reports',
      description: 'Statistiche e analisi',
      icon: BarChart3,
      href: '/reports',
      count: '-',
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-50',
      iconColor: 'text-pink-600'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Dashboard NS3000 RENT
        </h1>
        <p className="text-gray-600 text-lg">
          Sistema di gestione prenotazioni barche e servizi marittimi
        </p>
      </div>

      {/* Stats Cards - Compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Prenotazioni Oggi</p>
                <p className="text-3xl font-bold text-gray-900">3</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Barche Operative</p>
                <p className="text-3xl font-bold text-gray-900">8/10</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Ship className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Fatturato Mese</p>
                <p className="text-3xl font-bold text-gray-900">€ 12.4k</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasso Occupazione</p>
                <p className="text-3xl font-bold text-gray-900">76%</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <MapPin className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Modules Grid - Colorful & Compact */}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Gestione Principale</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <Link key={module.href} href={module.href}>
                <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 overflow-hidden h-full">
                  <div className={`h-2 bg-gradient-to-r ${module.color}`} />
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      <div className={`${module.bgColor} w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <Icon className={`h-7 w-7 ${module.iconColor}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                          {module.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {module.description}
                        </p>
                      </div>
                      {module.count !== '-' && (
                        <div className="pt-2 border-t border-gray-100">
                          <span className="text-2xl font-bold text-gray-700">
                            {module.count}
                          </span>
                          <span className="text-sm text-gray-500 ml-1">elementi</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Statistiche Rapide</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prossime Partenze</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Tour Capri</p>
                    <p className="text-sm text-gray-600">Oggi ore 10:00</p>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    8 PAX
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Noleggio Gozzo</p>
                    <p className="text-sm text-gray-600">Oggi ore 14:00</p>
                  </div>
                  <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">
                    4 PAX
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Barche in Manutenzione</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Gozzo Sorrentino 750</p>
                    <p className="text-sm text-gray-600">Motore in revisione</p>
                  </div>
                  <span className="text-xs font-semibold text-orange-600">2 giorni</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Gommone Joker 23</p>
                    <p className="text-sm text-gray-600">Pulizia hull</p>
                  </div>
                  <span className="text-xs font-semibold text-yellow-600">1 giorno</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Servizi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Tour Capri</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style={{width: '85%'}} />
                    </div>
                    <span className="text-sm font-bold text-gray-900">85%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Tour Positano</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full" style={{width: '72%'}} />
                    </div>
                    <span className="text-sm font-bold text-gray-900">72%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Noleggio Giornaliero</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full" style={{width: '68%'}} />
                    </div>
                    <span className="text-sm font-bold text-gray-900">68%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}