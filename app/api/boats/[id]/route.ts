import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { data, error } = await supabaseAdmin
      .from('boats')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log('PUT boats - ID:', id)
    console.log('PUT boats - Body:', body)

    const { data, error } = await supabaseAdmin
      .from('boats')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    console.log('Supabase result - data:', data)
    console.log('Supabase result - error:', error)

    if (error) {
      console.error('Supabase error detail:', JSON.stringify(error, null, 2))
      throw error
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('PUT boats error:', error)
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { error } = await supabaseAdmin
      .from('boats')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}