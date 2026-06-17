import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const { id, updates, facility_id } = await request.json();

    if (!id || !updates || !facility_id) {
      return NextResponse.json({ error: 'Resident ID, facility_id and updates are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('residents')
      .update(updates)
      .eq('id', id)
      .eq('facility_id', facility_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Resident Update Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update resident' }, { status: 500 });
  }
}
