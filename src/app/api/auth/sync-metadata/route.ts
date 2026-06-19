// TODO: CRITICAL SECURITY WARNING — DELETE OR DISABLE THIS ROUTE BEFORE PRODUCTION DEPLOY.
// This is a one-time migration tool only. Leaving this active in production poses a privilege escalation risk.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext } from '@/lib/auth-context';

/**
 * POST /api/auth/sync-metadata
 *
 * Platform-admin only.
 * Iterates all staff rows and ensures their Supabase Auth app_metadata
 * contains the correct staff_id, role, name, and facility_id.
 *
 * Run this once after deploying the new auth system to fix any existing
 * accounts that were created before the staff_id field was added.
 */
export async function POST(request: Request) {
    try {
        // Auth check
        let authCtx;
        try {
            authCtx = await getAuthContext();
        } catch (err: any) {
            return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 });
        }

        if (authCtx.role !== 'platform_admin') {
            return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
        }

        // Fetch all staff
        const { data: allStaff, error: staffErr } = await supabaseAdmin
            .from('staff')
            .select('id, user_id, name, role, facility_id')
            .not('user_id', 'is', null);

        if (staffErr) throw staffErr;

        const results = { updated: 0, failed: 0, errors: [] as string[] };

        for (const s of allStaff ?? []) {
            const { error } = await supabaseAdmin.auth.admin.updateUserById(s.user_id, {
                app_metadata: {
                    staff_id: s.id,
                    role: s.role,
                    facility_id: s.facility_id ?? null,
                },
                user_metadata: {
                    name: s.name,
                },
            });

            if (error) {
                results.failed++;
                results.errors.push(`${s.id}: ${error.message}`);
            } else {
                results.updated++;
            }
        }

        return NextResponse.json({ success: true, ...results });
    } catch (err: any) {
        console.error('[sync-metadata] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
