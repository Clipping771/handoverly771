import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('facilities')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('[public/facilities] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch facilities.' }, { status: 500 });
    }

    return NextResponse.json({ facilities: data });
  } catch (err: any) {
    console.error('[public/facilities] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
