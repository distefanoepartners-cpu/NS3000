// app/(dashboard)/briefings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Send, Calendar, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function BriefingsPage() {
  const { isAdmin } = useAuth();
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    if (isAdmin) {
      loadBriefings();
      
      // Auto-refresh ogni 30 secondi
      const interval = setInterval(loadBriefings, 30000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [isAdmin]);

  const loadBriefings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/briefings/list', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to load briefings');
      }

      const data = await response.json();
      // Ordina briefing per data decrescente (più recenti prima)
      const sortedBriefings = (data.briefings || []).sort((a: any, b: any) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      setBriefings(sortedBriefings);
    } catch (error) {
      console.error('Error loading briefings:', error);
    } finally {
      setLoading(false);
    }
  };

  const createManualBriefing = async () => {
    if (!confirm('Vuoi inviare il briefing per domani?')) return;

    try {
      setCreating(true);
      const response = await fetch('/api/briefings/create-manual', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to create briefing');
      }

      const data = await response.json();
      
      if (data.success) {
        alert(`Briefing aggiornato!\n\nPrenotazioni: ${data.briefing.bookings_count}\nPasseggeri: ${data.briefing.total_passengers}`);
        await loadBriefings();
      }
    } catch (error) {
      console.error('Error creating briefing:', error);
      alert('Errore durante la creazione del briefing');
    } finally {
      setCreating(false);
    }
  };

  const createBriefingWithDate = async () => {
    if (!selectedDate) {
      alert('Seleziona una data');
      return;
    }

    if (!confirm(`Vuoi inviare il briefing per il ${new Date(selectedDate).toLocaleDateString('it-IT')}?`)) {
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/briefings/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
      });

      if (!response.ok) {
        throw new Error('Failed to create briefing');
      }

      const data = await response.json();
      
      if (data.success) {
        alert(`Briefing creato/aggiornato per ${new Date(selectedDate).toLocaleDateString('it-IT')}!\n\nPrenotazioni: ${data.briefing.bookings_count}\nPasseggeri: ${data.briefing.total_passengers}`);
        setShowDatePicker(false);
        setSelectedDate('');
        await loadBriefings();
      }
    } catch (error) {
      console.error('Error creating briefing:', error);
      alert('Errore durante la creazione del briefing');
    } finally {
      setCreating(false);
    }
  };

  const deleteBriefing = async (briefingId: string, date: string) => {
    if (!confirm(`Vuoi eliminare il briefing del ${new Date(date).toLocaleDateString('it-IT')}?`)) {
      return;
    }

    try {
      setDeleting(briefingId);
      const response = await fetch(`/api/briefings/${briefingId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete briefing');
      }

      alert('Briefing eliminato con successo');
      await loadBriefings();
    } catch (error) {
      console.error('Error deleting briefing:', error);
      alert('Errore durante l\'eliminazione del briefing');
    } finally {
      setDeleting(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Solo gli amministratori possono visualizzare i briefings.
        </div>
      </div>
    );
  }

  if (loading && briefings.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2">Caricamento briefings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">📋 Promemoria Operativi</h1>
          <p className="text-gray-600 mt-1">Tracciamento conferme di lettura del personale</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadBriefings}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="whitespace-nowrap">Aggiorna</span>
          </button>
          <button
            onClick={createManualBriefing}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            <Send className="w-4 h-4" />
            <span className="whitespace-nowrap">{creating ? 'Invio...' : 'Invio Manuale'}</span>
          </button>
          <button
            onClick={() => setShowDatePicker(true)}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            <Calendar className="w-4 h-4" />
            <span className="whitespace-nowrap">Scegli Data</span>
          </button>
        </div>
      </div>

      {/* Modal Selezione Data */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Seleziona Data Briefing</h3>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              min={new Date().toISOString().split('T')[0]}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDatePicker(false);
                  setSelectedDate('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                disabled={creating}
              >
                Annulla
              </button>
              <button
                onClick={createBriefingWithDate}
                disabled={!selectedDate || creating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {creating ? 'Creazione...' : 'Crea Briefing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Programmazione Automatica */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">📅 Programmazione Automatica</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>17:00</strong> - Primo invio briefing per il giorno successivo</li>
          <li>• <strong>07:00</strong> - Secondo invio/reminder del giorno operativo</li>
          <li>• <strong>Manuale</strong> - Possibilità di invio/aggiornamento in qualsiasi momento</li>
        </ul>
      </div>

      {/* Lista Briefings */}
      <div className="space-y-4">
        {briefings.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500">Nessun briefing disponibile</p>
          </div>
        ) : (
          briefings.map((briefing) => {
            const totalStaff = briefing.confirmations?.length || 0;
            const confirmedStaff = briefing.confirmations?.filter((c: any) => c.confirmed_at).length || 0;
            const percentage = totalStaff > 0 ? Math.round((confirmedStaff / totalStaff) * 100) : 0;
            const isComplete = percentage === 100;

            return (
              <div key={briefing.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                    <div className="flex-1">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                        Briefing del {new Date(briefing.date).toLocaleDateString('it-IT', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </h2>
                      <p className="text-sm sm:text-base text-gray-600 mt-1">
                        {briefing.bookings_count || 0} prenotazioni • {briefing.total_passengers || 0} passeggeri
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        isComplete 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {isComplete ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            <span className="whitespace-nowrap">Completato</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 mr-1" />
                            <span className="whitespace-nowrap">Conferme: {confirmedStaff}/{totalStaff}</span>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => deleteBriefing(briefing.id, briefing.date)}
                        disabled={deleting === briefing.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                        title="Elimina briefing"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Tabella Conferme */}
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Nominativo</th>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Ruolo</th>
                            <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Notifica</th>
                            <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Orario</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {briefing.confirmations?.map((confirmation: any) => (
                            <tr key={confirmation.user_id} className="hover:bg-gray-50">
                              <td className="px-3 sm:px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                {confirmation.user?.full_name || confirmation.user?.email || 'N/D'}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                {confirmation.user?.role === 'admin' ? 'Staff' : confirmation.user?.role || 'N/D'}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-center">
                                {confirmation.confirmed_at ? (
                                  <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                                )}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-center text-gray-600 whitespace-nowrap">
                                {confirmation.confirmed_at
                                  ? new Date(confirmation.confirmed_at).toLocaleTimeString('it-IT', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}