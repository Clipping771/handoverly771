import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/update-staff
 *
 * Admin/platform-admin only. Updates the staff row AND syncs user_metadata in Supabase Auth.
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

    const { data: { user } } = await supabaseServer.auth.getUser();
    const callerRole = user?.user_metadata?.role as string | undefined;

    if (callerRole !== 'platform_admin' && callerRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // ── Input validation ─────────────────────────────────────────────────────
    const { id, name, role, employeeId, email, facilityId, password } = await request.json();

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

    // ── Handle password hashing if updating password ────────────────────────
    let passwordHash: string | undefined = undefined;
    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    // ── Update staff table ───────────────────────────────────────────────────
    const updateData: any = {
      name: name.trim(),
      role,
      employee_id: employeeId.trim(),
      email: email.trim().toLowerCase(),
    };

    if (callerRole === 'platform_admin' && facilityId) {
      updateData.facility_id = facilityId;
    }
    if (passwordHash) {
      updateData.password_hash = passwordHash;
      updateData.pin_hash = passwordHash;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('staff')
      .update(updateData)
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

    // ── Sync Supabase Auth user_metadata & credentials ───────────────────────
    if (staffRow.user_id) {
      const authUpdates: any = {
        user_metadata: {
          name: name.trim(),
          role,
          facility_id: (callerRole === 'platform_admin' && facilityId) ? facilityId : staffRow.facility_id,
          staff_id: id,
        },
      };

      if (password && password.trim() !== '') {
        authUpdates.password = password;
      }

      await supabaseAdmin.auth.admin.updateUserById(staffRow.user_id, authUpdates);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[update-staff] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
