import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { briefingId, userId } = await request.json();

    if (!briefingId || !userId) {
      return NextResponse.json({ 
        error: 'Briefing ID and User ID required' 
      }, { status: 400 });
    }

    console.log('💾 Confirming briefing:', briefingId, 'for user:', userId);

    const { error } = await supabase
      .from('briefing_confirmations')
      .insert({
        briefing_id: briefingId,
        user_id: userId
      });

    if (error) {
      console.error('❌ Confirmation error:', error);
      throw error;
    }

    console.log('✅ Briefing confirmed successfully');

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('💥 Error in confirm API:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}