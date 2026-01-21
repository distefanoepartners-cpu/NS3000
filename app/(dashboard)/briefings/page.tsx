// app/(dashboard)/briefings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createBrowserClient } from '@supabase/ssr';

const getSupabaseClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

export default function BriefingsPage() {
  const { isAdmin } = useAuth();
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      loadBriefings();
    }
  }, [isAdmin]);

  const loadBriefings = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      // Ottieni ultimi 30 giorni di briefing
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: briefingsData, error } = await supabase
        .from('daily_briefings')
        .select(`
          *,
          confirmations:briefing_confirmations(
            id,
            confirmed_at,
            user:users(full_name, email)
          )
        `)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      // Ottieni lista completa staff
      const { data: allStaff } = await supabase
        .from('users')
        .select('id, full_name, email, role');

      // Per ogni briefing, calcola chi ha confermato e chi no
      const enriched = briefingsData?.map(briefing => {
        const confirmed = briefing.confirmations || [];
        const confirmedIds = confirmed.map((c: any) => c.user?.email);
        
        const pending = allStaff?.filter(
          staff => !confirmedIds.includes(staff.email)
        ) || [];

        return {
          ...briefing,
          confirmed_count: confirmed.length,
          pending_count: pending.length,
          total_staff: allStaff?.length || 0,
          pending_users: pending
        };
      });

      setBriefings(enriched || []);
    } catch (error) {
      console.error('Error loading briefings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Solo gli amministratori possono accedere a questa pagina</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          📋 Tracciamento Promemoria
        </h1>
        <p className="text-gray-600">
          Monitora chi ha confermato la lettura dei promemoria giornalieri
        </p>
      </div>

      {/* Stats Summary */}
      {briefings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-600">
              {briefings[0]?.total_staff || 0}
            </div>
            <div className="text-sm text-gray-600">Membri Staff Totali</div>
          </div>
          
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-600">
              {briefings[0]?.confirmed_count || 0}
            </div>
            <div className="text-sm text-gray-600">Hanno Confermato Oggi</div>
          </div>
          
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-600">
              {briefings[0]?.pending_count || 0}
            </div>
            <div className="text-sm text-gray-600">In Attesa di Conferma</div>
          </div>
        </div>
      )}

      {/* Lista Briefings */}
      <div className="space-y-4">
        {briefings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Nessun promemoria trovato</p>
          </div>
        ) : (
          briefings.map((briefing) => {
            const date = new Date(briefing.date);
            const dateStr = date.toLocaleDateString('it-IT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
            
            const percentage = briefing.total_staff > 0
              ? Math.round((briefing.confirmed_count / briefing.total_staff) * 100)
              : 0;

            return (
              <div 
                key={briefing.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {dateStr}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {briefing.bookings_count} prenotazioni • {briefing.total_passengers} passeggeri
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${
                      percentage === 100 ? 'text-green-600' :
                      percentage >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {percentage}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {briefing.confirmed_count}/{briefing.total_staff} confermati
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      percentage === 100 ? 'bg-green-600' :
                      percentage >= 50 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Confermati */}
                {briefing.confirmations && briefing.confirmations.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Hanno Confermato ({briefing.confirmations.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {briefing.confirmations.map((conf: any) => (
                        <div 
                          key={conf.id}
                          className="bg-green-50 border border-green-200 rounded-lg px-3 py-1 text-sm"
                        >
                          <span className="font-medium text-green-900">
                            {conf.user?.full_name || conf.user?.email}
                          </span>
                          <span className="text-green-600 ml-2 text-xs">
                            {new Date(conf.confirmed_at).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* In Attesa */}
                {briefing.pending_users && briefing.pending_users.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      In Attesa ({briefing.pending_users.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {briefing.pending_users.map((user: any) => (
                        <div 
                          key={user.id}
                          className="bg-red-50 border border-red-200 rounded-lg px-3 py-1 text-sm animate-pulse"
                        >
                          <span className="font-medium text-red-900">
                            {user.full_name || user.email}
                          </span>
                          <span className="text-red-600 ml-2 text-xs">
                            ⏳ Non ancora letto
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}