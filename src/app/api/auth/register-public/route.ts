import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/register-public
 *
 * Public endpoint to either:
 * 1. Create a new facility and register as admin.
 * 2. Join an existing facility using a facility code.
 */
export async function POST(request: Request) {
  try {
    const { action, facilityId, name, role, employeeId, email, password, pin } = await request.json();

    if (!action || !name || !role || !employeeId || !email || !password || !pin) {
      return NextResponse.json(
        { error: 'Missing required fields (including pin).' },
        { status: 400 }
      );
    }

    // Enforce role boundaries for public sign-ups using a strict allowlist
    const ALLOWED_PUBLIC_ROLES = ['carer', 'rn'];
    const requestedRole = role.toLowerCase().trim();
    if (!ALLOWED_PUBLIC_ROLES.includes(requestedRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Public registration can only be used to register as a carer or rn.' },
        { status: 403 }
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

    let targetFacilityId = null;

    if (action === 'join_facility') {
      if (!facilityId) {
        return NextResponse.json({ error: 'Facility selection is required to join.' }, { status: 400 });
      }

      const { data: facilityData, error: facilityError } = await supabaseAdmin
        .from('facilities')
        .select('id')
        .eq('id', facilityId)
        .single();

      if (facilityError || !facilityData) {
        return NextResponse.json({ error: 'Invalid facility selection.' }, { status: 400 });
      }

      targetFacilityId = facilityData.id;
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    // Create Supabase Auth user
    const staffId = crypto.randomUUID();
    const syntheticEmail = `${staffId}@handoverly.local`;
    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(pin, 10);

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      app_metadata: { facility_id: targetFacilityId, role, staff_id: staffId },
      user_metadata: { name: name.trim() },
    });

    if (authError) {
      console.error('[register-public] Auth creation failed:', authError.message);
      return NextResponse.json(
        { error: 'Failed to create authentication account.' },
        { status: 400 }
      );
    }

    // Insert staff row
    const { data, error: dbError } = await supabaseAdmin
      .from('staff')
      .insert([{
        id: staffId,
        user_id: authUser.user.id,
        facility_id: targetFacilityId,
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
      // Rollback: delete the auth user we just created
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);

      console.error('[register-public] DB insert failed:', dbError.message, '| code:', dbError.code, '| details:', dbError.details);

      if (dbError.code === '23505' || dbError.message.toLowerCase().includes('unique')) {
        if (dbError.message.toLowerCase().includes('employee') || dbError.details?.toLowerCase().includes('employee')) {
          return NextResponse.json(
            { error: 'A staff member with this Employee ID already exists at this facility.' },
            { status: 409 }
          );
        }
        if (dbError.message.toLowerCase().includes('email') || dbError.details?.toLowerCase().includes('email')) {
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

      return NextResponse.json({ error: `Failed to save staff record: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, staff: data });
  } catch (err: any) {
    console.error('[register-public] Unexpected error:', err.message, err.stack);
    return NextResponse.json({ error: `Unexpected error: ${err.message}` }, { status: 500 });
  }
}
