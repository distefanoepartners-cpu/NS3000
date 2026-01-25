// app/api/briefings/[id]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const briefingId = params.id;

    console.log('🗑️ Eliminazione briefing:', briefingId);

    // Prima elimina le conferme associate (CASCADE dovrebbe farlo automaticamente, ma per sicurezza)
    const { error: confirmationsError } = await supabase
      .from('briefing_confirmations')
      .delete()
      .eq('briefing_id', briefingId);

    if (confirmationsError) {
      console.error('⚠️ Errore eliminazione conferme:', confirmationsError);
      // Non bloccare, continua comunque
    }

    // Poi elimina il briefing
    const { error: deleteError } = await supabase
      .from('daily_briefings')
      .delete()
      .eq('id', briefingId);

    if (deleteError) {
      console.error('❌ Errore eliminazione briefing:', deleteError);
      throw new Error(`Errore eliminazione briefing: ${deleteError.message}`);
    }

    console.log('✅ Briefing eliminato con successo');

    return NextResponse.json({
      success: true,
      message: 'Briefing eliminato con successo'
    });

  } catch (error: any) {
    console.error('💥 Error deleting briefing:', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}