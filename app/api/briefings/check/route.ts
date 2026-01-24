import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Calcola oggi e domani
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log('🔍 Checking briefings for dates:', { today: todayStr, tomorrow: tomorrowStr });

    // Ottieni briefing di oggi/domani
    const { data: briefings, error: briefingError } = await supabase
      .from('daily_briefings')
      .select('*')
      .in('date', [todayStr, tomorrowStr])
      .order('date', { ascending: false });

    if (briefingError) {
      console.error('❌ Briefing error:', briefingError);
      throw briefingError;
    }

    console.log('📋 Found briefings:', briefings?.length || 0);

    if (!briefings || briefings.length === 0) {
      return NextResponse.json({ pendingBriefing: null });
    }

    // Per ogni briefing, controlla se l'utente ha confermato
    for (const briefing of briefings) {
      const { data: confirmation } = await supabase
        .from('briefing_confirmations')
        .select('id')
        .eq('briefing_id', briefing.id)
        .eq('user_id', userId)
        .single();

      if (!confirmation) {
        // Briefing non confermato trovato!
        console.log('🔴 Found unconfirmed briefing:', briefing.id);
        return NextResponse.json({ pendingBriefing: briefing });
      }
    }

    // Tutti confermati
    console.log('✅ All briefings confirmed');
    return NextResponse.json({ pendingBriefing: null });

  } catch (error: any) {
    console.error('💥 Error in check API:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}