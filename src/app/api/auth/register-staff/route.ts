import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/register-staff
 *
 * Admin-only endpoint. Requires the caller to be an authenticated admin
 * or platform_admin. Creates a Supabase Auth user + staff row atomically.
 */
export async function POST(request: Request) {
  try {
    // ── Auth check ──────────────────────────────────────────────────────────
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
    const { facilityId, name, role, employeeId, email, password } = await request.json();

    if (!facilityId || !name || !role || !employeeId || !email || !password) {
      return NextResponse.json(
        { error: 'All fields (facilityId, name, role, employeeId, email, password) are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
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

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: { facility_id: facilityId, role, name: name.trim(), staff_id: staffId },
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
        pin_hash: passwordHash,
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
