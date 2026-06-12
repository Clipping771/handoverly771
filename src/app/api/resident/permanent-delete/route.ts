import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    const { id, staffId } = await request.json();

    if (!id || !staffId) {
      return NextResponse.json({ error: 'Resident ID and Staff ID are required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Initialize Supabase with the SERVICE_ROLE_KEY to bypass Row Level Security (RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify staff role
    const { data: staffMember, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('role')
      .eq('id', staffId)
      .single();

    if (staffError || !staffMember) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 403 });
    }

    const role = staffMember.role?.toLowerCase().trim() ?? '';
    const isAuthorized = role === 'admin' || role.includes('admin') || role.includes('manager') ||
                         role === 'rn' || role.includes('rn') || role.includes('nurse') || role.includes('clinical');

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Only RNs and Admins can permanently delete profiles' }, { status: 403 });
    }

    // Delete the resident profile (cascades to handovers, tasks, and timeline events in database)
    const { error: deleteError } = await supabaseAdmin
      .from('residents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error permanently deleting resident:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to permanently delete resident' },
      { status: 500 }
    );
  }
}
