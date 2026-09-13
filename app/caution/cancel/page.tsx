// app/caution/cancel/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function CancelContent() {
  const searchParams = useSearchParams()
  const bookingNumber = searchParams.get('booking') || ''

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Cauzione Non Completata
        </h1>
        <p className="text-gray-600 mb-6">
          La pre-autorizzazione per la prenotazione <strong>{bookingNumber}</strong> non è stata completata.
        </p>
        
        <div className="bg-amber-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            Se hai bisogno di un nuovo link per la cauzione, contatta NS3000 Rent. 
            La tua carta non è stata addebitata né bloccata.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            📧 ns3000rent@gmail.com<br />
            📱 +39 388 114 0189
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CautionCancelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    }>
      <CancelContent />
    </Suspense>
  )
}