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
import { getAuthContext } from '@/lib/auth-context';

/**
 * POST /api/auth/update-staff
 *
 * Admin/platform-admin only. Updates the staff row AND syncs app_metadata/user_metadata in Supabase Auth.
 */
export async function POST(request: Request) {
  try {
    // ── Auth check ───────────────────────────────────────────────────────────
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    const { role: callerRole, facilityId: callerFacilityId } = authCtx;

    if (callerRole !== 'platform_admin' && callerRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // ── Input validation ─────────────────────────────────────────────────────
    const { id, name, role, employeeId, email, facilityId, password, pin } = await request.json();

    if (!id || !name || !role || !employeeId || !email) {
      return NextResponse.json(
        { error: 'All fields (id, name, role, employeeId, email) are required.' },
        { status: 400 }
      );
    }

    // ── Fetch staff to get the auth user_id ──────────────────────────────────
    let staffQuery = supabaseAdmin
      .from('staff')
      .select('user_id, facility_id')
      .eq('id', id);

    if (callerRole === 'admin') {
      staffQuery = staffQuery.eq('facility_id', callerFacilityId);
    }

    const { data: staffRow, error: fetchErr } = await staffQuery.maybeSingle();

    if (fetchErr || !staffRow) {
      return NextResponse.json({ error: 'Staff member not found or access denied.' }, { status: 404 });
    }

    // ── Handle password hashing if updating password ────────────────────────
    let passwordHash: string | undefined = undefined;
    if (password && password.trim() !== '') {
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters for clinical security.' }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    // ── Handle pin hashing if updating pin ────────────────────────
    let pinHash: string | undefined = undefined;
    if (pin && pin.trim() !== '') {
      if (!/^\d{4,6}$/.test(pin)) {
        return NextResponse.json({ error: 'Clinical PIN must be a 4 to 6 digit numeric code.' }, { status: 400 });
      }
      pinHash = await bcrypt.hash(pin, 10);
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
    }
    if (pinHash) {
      updateData.pin_hash = pinHash;
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

    // ── Sync Supabase Auth app_metadata, user_metadata & credentials ──────────
    if (staffRow.user_id) {
      const authUpdates: any = {
        app_metadata: {
          role,
          facility_id: (callerRole === 'platform_admin' && facilityId) ? facilityId : staffRow.facility_id,
          staff_id: id,
        },
        user_metadata: {
          name: name.trim(),
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
