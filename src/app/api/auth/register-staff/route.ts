import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';
import { getAuthContext } from '@/lib/auth-context';

/**
 * POST /api/auth/register-staff
 *
 * Admin-only endpoint. Requires the caller to be an authenticated admin
 * or platform_admin. Creates a Supabase Auth user + staff row atomically.
 */
export async function POST(request: Request) {
  try {
    // ── Auth check ──────────────────────────────────────────────────────────
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    const { role: callerRole, facilityId: callerFacilityId } = authCtx;

    const isAuthorized =
      callerRole === 'platform_admin' ||
      callerRole === 'admin';

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: only admins can register staff.' },
        { status: 403 }
      );
    }

    // ── Input validation ─────────────────────────────────────────────────────
    const { facilityId, name, role, employeeId, email, password, pin } = await request.json();

    if (!facilityId || !name || !role || !employeeId || !email || !password || !pin) {
      return NextResponse.json(
        { error: 'All fields (facilityId, name, role, employeeId, email, password, pin) are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters for clinical security.' },
        { status: 400 }
      );
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'Clinical PIN must be a 4 to 6 digit numeric code.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Check scope boundaries
    if (callerRole === 'admin' && facilityId !== callerFacilityId) {
      return NextResponse.json(
        { error: 'Forbidden: Facility admins can only register staff for their own facility.' },
        { status: 403 }
      );
    }

    // Non-admins cannot register other admins
    if (callerRole === 'admin' && (role === 'admin' || role === 'platform_admin')) {
      return NextResponse.json(
        { error: 'Facility admins cannot create other admin accounts.' },
        { status: 403 }
      );
    }

    // ── Create Supabase Auth user ────────────────────────────────────────────
    const staffId = crypto.randomUUID();
    const syntheticEmail = `${staffId}@handoverly.local`;
    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(pin, 10);

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      app_metadata: { facility_id: facilityId, role, staff_id: staffId },
      user_metadata: { name: name.trim() },
    });

    if (authError) {
      console.error('[register-staff] Auth creation failed:', authError.message);
      return NextResponse.json(
        { error: 'Failed to create authentication account.' },
        { status: 400 }
      );
    }

    // ── Insert staff row ─────────────────────────────────────────────────────
    const { data, error: dbError } = await supabaseAdmin
      .from('staff')
      .insert([{
        id: staffId,
        user_id: authUser.user.id,
        facility_id: facilityId,
        name: name.trim(),
        role,
        employee_id: employeeId.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        pin_hash: pinHash,
      }])
      .select()
      .single();

    if (dbError) {
      // Roll back the auth user to avoid orphans
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);

      if (dbError.code === '23505' || dbError.message.toLowerCase().includes('unique')) {
        if (dbError.message.toLowerCase().includes('employee')) {
          return NextResponse.json(
            { error: 'A staff member with this Employee ID already exists.' },
            { status: 409 }
          );
        }
        if (dbError.message.toLowerCase().includes('email')) {
          return NextResponse.json(
            { error: 'A staff member with this email already exists.' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: 'A staff member with these details already exists.' },
          { status: 409 }
        );
      }

      console.error('[register-staff] DB insert failed:', dbError.message);
      return NextResponse.json({ error: 'Failed to save staff record.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, staff: data });
  } catch (err: any) {
    console.error('[register-staff] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
