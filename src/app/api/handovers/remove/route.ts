import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
console.log('Force cache bust');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Handover ID is required' }, { status: 400 });
    }

    // Use admin client to bypass RLS since the client might not have DELETE policy
    const { error } = await supabaseAdmin
      .from('handovers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting handover:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Unexpected error in handover delete:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
