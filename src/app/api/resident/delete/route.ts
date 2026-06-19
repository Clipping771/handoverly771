import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthContext } from '@/lib/auth-context';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    const { id, reason } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Resident ID is required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Initialize Supabase with the SERVICE_ROLE_KEY to bypass Row Level Security (RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify target resident exists and belongs to the caller's facility (unless platform_admin)
    let residentQuery = supabaseAdmin
      .from('residents')
      .select('facility_id')
      .eq('id', id);

    if (authCtx.role !== 'platform_admin') {
      residentQuery = residentQuery.eq('facility_id', authCtx.facilityId);
    }

    const { data: resident, error: fetchErr } = await residentQuery.maybeSingle();

    if (fetchErr || !resident) {
      return NextResponse.json({ error: 'Resident not found or access denied.' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('residents')
      .update({ 
        is_active: false,
        status_reason: reason || 'Discharged',
        deleted_at: new Date().toISOString(),
        deleted_by: authCtx.staffId
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    // Also delete any tasks associated with this soft-deleted resident to clean up dashboard/tasks lists
    let taskDeleteQuery = supabaseAdmin
      .from('tasks')
      .delete()
      .eq('resident_id', id);

    if (authCtx.role !== 'platform_admin') {
      taskDeleteQuery = taskDeleteQuery.eq('facility_id', authCtx.facilityId);
    }

    await taskDeleteQuery;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting resident:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete resident' },
      { status: 500 }
    );
  }
}
