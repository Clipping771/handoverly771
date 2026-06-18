import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/delete-staff
 * Admin/platform-admin only. Deletes a staff row and the linked Supabase Auth user.
 */
export async function POST(request: Request) {
  try {
    // ── Auth check ───────────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => { },
        },
      }
    );

    const { data: { session } } = await supabaseServer.auth.getSession();
    const callerRole = session?.user?.user_metadata?.role as string | undefined;

    if (callerRole !== 'platform_admin' && callerRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // ── Input ────────────────────────────────────────────────────────────────
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Staff ID is required.' }, { status: 400 });
    }

    // ── Prevent self-deletion ────────────────────────────────────────────────
    const callerStaffId = session?.user?.user_metadata?.staff_id;
    if (callerStaffId === id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    // ── Fetch staff to get auth user_id ──────────────────────────────────────
    const { data: staffRow, error: fetchErr } = await supabaseAdmin
      .from('staff')
      .select('user_id, role')
      .eq('id', id)
      .single();

    if (fetchErr || !staffRow) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    // Facility admins cannot delete other admins or platform admins
    if (callerRole === 'admin' && (staffRow.role === 'admin' || staffRow.role === 'platform_admin')) {
      return NextResponse.json(
        { error: 'Facility admins cannot delete admin accounts.' },
        { status: 403 }
      );
    }

    // ── Delete staff row (cascade will handle related records) ───────────────
    const { error: deleteErr } = await supabaseAdmin
      .from('staff')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    // ── Delete Supabase Auth user ────────────────────────────────────────────
    if (staffRow.user_id) {
      const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(staffRow.user_id);
      if (authDeleteErr) {
        // Log but don't fail — staff row is already deleted
        console.error('[delete-staff] Auth user deletion failed:', authDeleteErr.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[delete-staff] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
