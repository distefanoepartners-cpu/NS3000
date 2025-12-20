import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NS3000 RENT',
  description: 'Sistema gestione prenotazioni barche e servizi marittimi',
  manifest: '/manifest.json',
   
}

export const viewport: Viewport = {
  themeColor: '#0066cc',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body>
        {children}
        
        {/* Cleanup Service Worker */}
        <script src="/cleanup-sw.js"></script>
      </body>
    </html>
  )
}