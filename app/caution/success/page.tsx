// app/caution/success/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const bookingNumber = searchParams.get('booking') || ''

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Cauzione Autorizzata
        </h1>
        <p className="text-gray-600 mb-6">
          La pre-autorizzazione per la prenotazione <strong>{bookingNumber}</strong> è stata completata con successo.
        </p>
        
        <div className="bg-green-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800">
            🔒 L'importo è stato <strong>bloccato sulla tua carta</strong> ma <strong>non addebitato</strong>. 
            Verrà rilasciato automaticamente al termine del noleggio.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            Per qualsiasi informazione:<br />
            📧 ns3000rent@gmail.com<br />
            📱 +39 388 114 0189
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CautionSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}