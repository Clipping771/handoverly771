import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/update-staff
 *
 * Admin-only. Updates the staff row AND syncs user_metadata in Supabase Auth
 * so the change takes effect without requiring a re-login.
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

    // ── Input validation ─────────────────────────────────────────────────────
    const { id, name, role, employeeId, email } = await request.json();

    if (!id || !name || !role || !employeeId || !email) {
      return NextResponse.json(
        { error: 'All fields (id, name, role, employeeId, email) are required.' },
        { status: 400 }
      );
    }

    // ── Fetch staff to get the auth user_id ──────────────────────────────────
    const { data: staffRow, error: fetchErr } = await supabaseAdmin
      .from('staff')
      .select('user_id, facility_id')
      .eq('id', id)
      .single();

    if (fetchErr || !staffRow) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    // ── Update staff table ───────────────────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from('staff')
      .update({
        name: name.trim(),
        role,
        employee_id: employeeId.trim(),
        email: email.trim().toLowerCase(),
      })
      .eq('id', id);

    if (updateErr) {
      if (updateErr.message.toLowerCase().includes('unique')) {
        return NextResponse.json(
          { error: 'A staff member with this Employee ID or email already exists.' },
          { status: 409 }
        );
      }
      throw updateErr;
    }

    // ── Sync Supabase Auth user_metadata ─────────────────────────────────────
    // This ensures the role/name change is reflected immediately in the live
    // JWT without the user needing to log out and back in.
    if (staffRow.user_id) {
      await supabaseAdmin.auth.admin.updateUserById(staffRow.user_id, {
        user_metadata: {
          name: name.trim(),
          role,
          facility_id: staffRow.facility_id,
          staff_id: id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[update-staff] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
