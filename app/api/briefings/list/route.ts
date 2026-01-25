import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Ottieni ultimi 30 giorni di briefing
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

    console.log('📋 Loading briefings since:', dateFilter);

    // 1. Ottieni briefing
    const { data: briefings, error: briefingsError } = await supabase
      .from('daily_briefings')
      .select('*')
      .gte('date', dateFilter)
      .order('date', { ascending: false });

    if (briefingsError) {
      console.error('❌ Briefings error:', briefingsError);
      throw briefingsError;
    }

    console.log(`✅ Found ${briefings?.length || 0} briefings`);

    // 2. Ottieni tutti gli utenti
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('is_active', true)
      .order('full_name');

    if (usersError) {
      console.error('❌ Users error:', usersError);
      // Non bloccare, continua con array vuoto
      console.warn('⚠️ Continuing without users data');
    }

    console.log(`👥 Found ${allUsers?.length || 0} users`);

    if (!allUsers || allUsers.length === 0) {
      console.warn('⚠️ No users found - confirmations will be empty');
    }

    // 3. Per ogni briefing, ottieni le conferme
    const enrichedBriefings = await Promise.all(
      (briefings || []).map(async (briefing) => {
        // Ottieni conferme per questo briefing
        const { data: confirmations, error: confirmError } = await supabase
          .from('briefing_confirmations')
          .select('id, user_id, confirmed_at')
          .eq('briefing_id', briefing.id);

        if (confirmError) {
          console.error(`❌ Error loading confirmations for briefing ${briefing.id}:`, confirmError);
        }

        const confirmedUserIds = (confirmations || []).map(c => c.user_id);

        // Arricchisci le conferme con i dati utente
        const confirmedUsers = (confirmations || []).map(conf => {
          const user = allUsers?.find(u => u.id === conf.user_id);
          return {
            user_id: conf.user_id,
            user: {
              full_name: user?.full_name || 'Utente sconosciuto',
              email: user?.email || '',
              role: user?.role || 'staff'
            },
            confirmed_at: conf.confirmed_at
          };
        });

        // Trova utenti che non hanno ancora confermato
        const pendingUsers = (allUsers || [])
          .filter(user => !confirmedUserIds.includes(user.id))
          .map(user => ({
            user_id: user.id,
            user: {
              full_name: user.full_name,
              email: user.email,
              role: user.role
            },
            confirmed_at: null
          }));

        // Combina confermati e in attesa
        const allConfirmations = [...confirmedUsers, ...pendingUsers];

        console.log(`📊 Briefing ${briefing.date}: ${confirmedUsers.length}/${allConfirmations.length} confirmed`);

        return {
          id: briefing.id,
          date: briefing.date,
          bookings_count: briefing.bookings_count,
          total_passengers: briefing.total_passengers,
          created_at: briefing.created_at,
          confirmations: allConfirmations
        };
      })
    );

    console.log('✅ Enriched briefings data');

    return NextResponse.json({
      success: true,
      briefings: enrichedBriefings
    });

  } catch (error: any) {
    console.error('💥 Error in list API:', error);
    return NextResponse.json({
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}