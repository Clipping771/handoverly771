import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext } from '@/lib/auth-context';

console.log('Force cache bust');

export async function POST(req: Request) {
  try {
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Handover ID is required' }, { status: 400 });
    }

    // Verify target handover exists and belongs to the caller's facility (unless platform_admin)
    let query = supabaseAdmin
      .from('handovers')
      .select('facility_id')
      .eq('id', id);

    if (authCtx.role !== 'platform_admin') {
      query = query.eq('facility_id', authCtx.facilityId);
    }

    const { data: handover, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !handover) {
      return NextResponse.json({ error: 'Handover not found or access denied' }, { status: 404 });
    }

    // Soft-delete: update is_active to false, and set deleted_at/deleted_by
    const { error } = await supabaseAdmin
      .from('handovers')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: authCtx.staffId
      })
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
