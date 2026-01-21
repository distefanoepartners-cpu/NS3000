// app/api/notifications/subscribe/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, subscription, deviceInfo } = body;

    if (!userId || !subscription) {
      return NextResponse.json(
        { error: 'userId e subscription sono richiesti' },
        { status: 400 }
      );
    }

    // Salva o aggiorna la subscription nel database
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription: subscription,
        device_info: deviceInfo || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Subscription salvata con successo',
      data 
    });
  } catch (error: any) {
    console.error('Errore salvataggio subscription:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId è richiesto' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Subscription rimossa' 
    });
  } catch (error: any) {
    console.error('Errore rimozione subscription:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
