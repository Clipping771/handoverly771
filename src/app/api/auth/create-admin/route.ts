import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';
import { getAuthContext } from '@/lib/auth-context';

/**
 * POST /api/auth/create-admin
 * Platform-admin only. Creates a facility admin account.
 *
 * GET /api/auth/create-admin
 * Platform-admin only. Returns facilities + existing admin list (used by system-admin UI).
 */

export async function POST(request: Request) {
  try {
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    if (authCtx.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Forbidden: platform admin access required.' }, { status: 403 });
    }

    const { name, email, employeeId, password, facilityId, pin } = await request.json();

    if (!name || !email || !employeeId || !password || !facilityId) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters for clinical security.' }, { status: 400 });
    }

    const pinToUse = pin || '1111';
    if (!/^\d{4,6}$/.test(pinToUse)) {
      return NextResponse.json({ error: 'Clinical PIN must be a 4 to 6 digit numeric code.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const staffId = crypto.randomUUID();
    const syntheticEmail = `${staffId}@handoverly.local`;
    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(pinToUse, 10);

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      app_metadata: {
        facility_id: facilityId,
        role: 'admin',
        staff_id: staffId,
      },
      user_metadata: {
        name: name.trim(),
      },
    });

    if (authError) {
      console.error('[create-admin] Auth creation error:', authError.message);
      return NextResponse.json({ error: 'Failed to create authentication account.' }, { status: 400 });
    }

    const { data, error: dbError } = await supabaseAdmin
      .from('staff')
      .insert([{
        id: staffId,
        user_id: authUser.user.id,
        facility_id: facilityId,
        name: name.trim(),
        role: 'admin',
        employee_id: employeeId.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        pin_hash: pinHash,
      }])
      .select()
      .single();

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);

      if (dbError.code === '23505' || dbError.message.toLowerCase().includes('unique')) {
        const msg = dbError.message.toLowerCase();
        if (msg.includes('email')) return NextResponse.json({ error: 'An admin with this email already exists.' }, { status: 409 });
        if (msg.includes('employee')) return NextResponse.json({ error: 'An admin with this Employee ID already exists.' }, { status: 409 });
        return NextResponse.json({ error: 'An admin with these details already exists.' }, { status: 409 });
      }

      console.error('[create-admin] DB insert error:', dbError.message);
      return NextResponse.json({ error: 'Failed to save admin record.' }, { status: 500 });
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert([{
        actor_id: authCtx.userId,
        actor_role: 'platform_admin',
        action_type: 'CREATE_FACILITY_ADMIN',
        target_entity: {
          facilityId,
          newAdminEmail: email.trim().toLowerCase(),
          newAdminId: staffId,
        },
      }]);
    } catch (e) {
      // Non-critical, don't fail the request
    }

    return NextResponse.json({ success: true, staff: data });
  } catch (err: any) {
    console.error('[create-admin] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    if (authCtx.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const [facResult, adminsResult] = await Promise.all([
      supabaseAdmin.from('facilities').select('id, name, code').order('name'),
      supabaseAdmin
        .from('staff')
        .select('id, name, role, employee_id, email, facility_id, facilities(name)')
        .eq('role', 'admin')
        .order('created_at', { ascending: false }),
    ]);

    if (facResult.error) throw facResult.error;
    if (adminsResult.error) throw adminsResult.error;

    return NextResponse.json({ facilities: facResult.data, admins: adminsResult.data });
  } catch (err: any) {
    console.error('[create-admin GET] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
