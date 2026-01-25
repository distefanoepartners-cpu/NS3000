// components/BriefingModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

interface BriefingModalProps {
  userId: string;
}

interface Briefing {
  id: string;
  date: string;
  bookings_count: number;
  total_passengers: number;
  content: any[];
}

export default function BriefingModal({ userId }: BriefingModalProps) {
  const [pendingBriefing, setPendingBriefing] = useState<Briefing | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Controlla briefing non letti all'avvio e poi ogni 30 secondi
  useEffect(() => {
    console.log('🚀 BriefingModal mounted for user:', userId);
    checkPendingBriefing();
    
    // Controlla ogni 30 secondi
    const interval = setInterval(checkPendingBriefing, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const checkPendingBriefing = async () => {
    try {
      console.log('🔍 Checking for pending briefings for user:', userId);
      
      // Usa fetch diretto invece di supabase client per vedere se è un problema di auth
      const response = await fetch('/api/briefings/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        console.error('❌ API error:', response.status);
        return;
      }

      const data = await response.json();
      console.log('📋 API Response:', data);

      if (data.pendingBriefing) {
        console.log('🔴 FOUND UNCONFIRMED BRIEFING! Opening modal...');
        setPendingBriefing(data.pendingBriefing);
        setShowModal(true);
      } else {
        console.log('✅ All briefings confirmed');
        setPendingBriefing(null);
        setShowModal(false);
      }
      
    } catch (error) {
      console.error('💥 Error checking briefing:', error);
    }
  };

  const confirmBriefing = async () => {
    if (!pendingBriefing) return;
    
    setIsConfirming(true);
    
    try {
      console.log('💾 Saving confirmation for user:', userId, 'briefing:', pendingBriefing.id);
      
      const response = await fetch('/api/briefings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefingId: pendingBriefing.id,
          userId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to confirm briefing');
      }
      
      console.log('✅ Briefing confermato con successo');
      
      // Chiudi modal
      setShowModal(false);
      setPendingBriefing(null);
      
    } catch (error) {
      console.error('❌ Error confirming briefing:', error);
      alert('Errore durante la conferma. Riprova.');
    } finally {
      setIsConfirming(false);
    }
  };

  if (!showModal || !pendingBriefing) return null;

  const dateStr = new Date(pendingBriefing.date).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const bookings = pendingBriefing.content || [];
  const noSkipper = bookings.filter((b: any) => !b.skipper).length;

  return (
    <>
      {/* Overlay - NON chiudibile con click */}
      <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] backdrop-blur-sm" />

      {/* Modal - DEVE confermare per chiudere */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 sm:p-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 animate-pulse" />
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold">📋 Promemoria Obbligatorio</h2>
                  <p className="text-blue-100 text-xs sm:text-sm mt-1">
                    Leggi attentamente e conferma la lettura
                  </p>
                </div>
              </div>
              <div className="bg-red-500 text-white px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs font-bold animate-bounce">
                IMPORTANTE
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-6 overflow-y-auto flex-1" style={{ maxHeight: 'calc(95vh - 180px)' }}>
            
            {/* Data e Stats */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">{dateStr}</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-blue-50 rounded-lg p-2 sm:p-4 border-2 border-blue-200">
                  <div className="text-xl sm:text-3xl font-bold text-blue-600">
                    {pendingBriefing.bookings_count}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Prenotazioni</div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-2 sm:p-4 border-2 border-green-200">
                  <div className="text-xl sm:text-3xl font-bold text-green-600">
                    {pendingBriefing.total_passengers}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Passeggeri</div>
                </div>
                
                <div className={`rounded-lg p-2 sm:p-4 border-2 ${
                  noSkipper > 0 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className={`text-xl sm:text-3xl font-bold ${
                    noSkipper > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {noSkipper}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Senza Skipper</div>
                </div>
              </div>
            </div>

            {/* Lista Prenotazioni */}
            {bookings.length === 0 ? (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Nessuna prenotazione
                </h3>
                <p className="text-green-700">
                  Giornata libera! 🎉
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {bookings.map((booking: any, i: number) => (
                  <div 
                    key={booking.id}
                    className={`border-2 rounded-lg p-3 sm:p-4 ${
                      !booking.skipper 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl sm:text-2xl font-bold text-gray-400">
                          {i + 1}
                        </span>
                        <div>
                          <h4 className="text-base sm:text-lg font-bold text-gray-900">
                            {booking.customer?.first_name} {booking.customer?.last_name}
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-600">
                            📞 {booking.customer?.phone || 'N/D'}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs font-bold ${
                        booking.booking_status?.code === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.booking_status?.name || 'N/D'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                      <div>
                        <span className="text-gray-600">🚤 Barca:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {booking.boat?.name || 'Non assegnata'}
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-gray-600">⛵ Servizio:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {booking.service?.name || 'N/D'}
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-gray-600">⏰ Orario:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {getTimeSlotLabel(booking.time_slot)}
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-gray-600">👥 Passeggeri:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {booking.num_passengers || 0}
                        </span>
                      </div>
                      
                      <div className="sm:col-span-2">
                        <span className="text-gray-600">👨‍✈️ Skipper:</span>
                        {booking.skipper ? (
                          <span className="ml-2 font-semibold text-green-700">
                            {booking.skipper.first_name} {booking.skipper.last_name}
                            {booking.skipper.phone && ` (${booking.skipper.phone})`}
                          </span>
                        ) : (
                          <span className="ml-2 font-bold text-red-600 animate-pulse">
                            ❌ NESSUNO ASSEGNATO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - Pulsante Conferma */}
          <div className="bg-gray-50 border-t-2 border-gray-200 p-3 sm:p-6 flex-shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
              <div className="text-xs sm:text-sm text-gray-600">
                <p className="font-semibold mb-1">⚠️ Conferma obbligatoria</p>
                <p className="hidden sm:block">Devi confermare di aver letto il promemoria prima di continuare</p>
              </div>
              
              <button
                onClick={confirmBriefing}
                disabled={isConfirming}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 sm:px-8 sm:py-3 rounded-lg font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
              >
                {isConfirming ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Conferma...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    ✅ Ho Letto e Confermo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function getTimeSlotLabel(timeSlot: string): string {
  const labels: { [key: string]: string } = {
    'morning': '🌅 Mattina',
    'afternoon': '☀️ Pomeriggio',
    'evening': '🌅 Sera',
    'full_day': '🌞 Giornata intera'
  };
  return labels[timeSlot] || timeSlot || 'Non specificato';
}