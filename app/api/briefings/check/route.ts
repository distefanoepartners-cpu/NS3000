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

    // Calcola data di oggi (inizio) per cercare tutti i briefing futuri
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log('🔍 Checking briefings from date:', todayStr);

    // Ottieni TUTTI i briefing dalla data odierna in poi (non solo oggi/domani)
    const { data: briefings, error: briefingError } = await supabase
      .from('daily_briefings')
      .select('*')
      .gte('date', todayStr)  // Tutti i briefing da oggi in poi
      .order('date', { ascending: true });  // Ordina per data crescente (più vicini prima)

    if (briefingError) {
      console.error('❌ Briefing error:', briefingError);
      throw briefingError;
    }

    console.log('📋 Found briefings:', briefings?.length || 0);

    if (!briefings || briefings.length === 0) {
      console.log('ℹ️ No future briefings found');
      return NextResponse.json({ pendingBriefing: null });
    }

    // Per ogni briefing (in ordine di data), controlla se l'utente ha confermato
    for (const briefing of briefings) {
      const { data: confirmation } = await supabase
        .from('briefing_confirmations')
        .select('id')
        .eq('briefing_id', briefing.id)
        .eq('user_id', userId)
        .single();

      if (!confirmation) {
        // Briefing non confermato trovato!
        console.log('🔴 Found unconfirmed briefing:', {
          id: briefing.id,
          date: briefing.date,
          bookings: briefing.bookings_count
        });
        return NextResponse.json({ pendingBriefing: briefing });
      } else {
        console.log('✅ Briefing confirmed:', {
          id: briefing.id,
          date: briefing.date
        });
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