import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/auth/login
 *
 * Accepts: { username: string }
 * Returns: { success: true, email: string, staffId: string }
 *
 * Resolves a staff member by employee_id, name, or contact email,
 * then returns the synthetic Supabase Auth email so the client can
 * call signInWithPassword with it.
 *
 * The auth account for every non-platform-admin user is registered under
 * `{staff.id}@handoverly.local`. The staff.email column is contact info only.
 *
 * The platform_admin account uses their real email as the auth email
 * (set by setup-platform-admin.js).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = body?.username;
    const portal = body?.portal as 'clinical' | 'admin' | 'system-admin' | undefined;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }

    if (!portal) {
      return NextResponse.json({ error: 'Portal designation is required.' }, { status: 400 });
    }

    const q = username.trim().toLowerCase();

    // Look up by employee_id first (exact match, indexed), then fall back to name/email.
    // We query by three columns separately to avoid fetching the whole table.
    const { data: staff, error } = await supabaseAdmin
      .from('staff')
      .select('id, role, email, is_active')
      .or(`employee_id.ilike.${q},name.ilike.${q},email.ilike.${q}`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[login] DB lookup error:', error.message);
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 500 });
    }

    if (!staff) {
      // Return a generic message — don't reveal whether the user exists
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Role-Portal Enforcement
    if (portal === 'clinical' && (staff.role === 'admin' || staff.role === 'platform_admin')) {
      return NextResponse.json({ error: 'Access denied. Administrators must use their dedicated login portals.' }, { status: 403 });
    }
    if (portal === 'admin' && staff.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Only Facility Administrators can use this portal.' }, { status: 403 });
    }
    if (portal === 'system-admin' && staff.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Access denied. Only System Administrators can use this portal.' }, { status: 403 });
    }

    // Platform admin logs in with their real email (the auth account was created with it).
    // Everyone else uses the synthetic email keyed off their staff UUID.
    const emailToUse =
      staff.role === 'platform_admin'
        ? staff.email
        : `${staff.id}@handoverly.local`;

    return NextResponse.json({ success: true, email: emailToUse, staffId: staff.id });
  } catch (err: any) {
    console.error('[login] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
