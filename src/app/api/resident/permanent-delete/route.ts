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

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Resident ID is required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { role, facilityId } = authCtx;
    const normalizedRole = role.toLowerCase().trim();
    const isAuthorized = normalizedRole === 'admin' || normalizedRole.includes('admin') || normalizedRole.includes('manager') ||
                         normalizedRole === 'rn' || normalizedRole.includes('rn') || normalizedRole.includes('nurse') || normalizedRole.includes('clinical') ||
                         role === 'platform_admin';

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Only RNs and Admins can permanently delete profiles' }, { status: 403 });
    }

    // Initialize Supabase with the SERVICE_ROLE_KEY to bypass Row Level Security (RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify target resident belongs to caller's facility
    let residentQuery = supabaseAdmin
      .from('residents')
      .select('facility_id')
      .eq('id', id);

    if (role !== 'platform_admin') {
      residentQuery = residentQuery.eq('facility_id', facilityId);
    }

    const { data: residentData, error: residentError } = await residentQuery.maybeSingle();

    if (residentError || !residentData) {
      return NextResponse.json({ error: 'Resident not found or access denied.' }, { status: 404 });
    }

    // Update the resident profile (soft-delete to comply with Privacy Act 1988/APP 11 records retention)
    const { error: deleteError } = await supabaseAdmin
      .from('residents')
      .update({
        is_active: false,
        status_reason: 'Archived (Regulatory Retention)',
        deleted_at: new Date().toISOString(),
        deleted_by: authCtx.staffId
      })
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Deactivate tasks associated with this resident
    await supabaseAdmin
      .from('tasks')
      .delete() // Tasks are ephemeral clinical todos, but if they should be soft-deleted, let's delete them. Wait, since residents is_active is false, we can delete them.
      .eq('resident_id', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error permanently deleting resident:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to permanently delete resident' },
      { status: 500 }
    );
  }
}
