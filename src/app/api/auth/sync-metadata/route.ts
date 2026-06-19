import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/sync-metadata
 *
 * Platform-admin only.
 * Iterates all staff rows and ensures their Supabase Auth user_metadata
 * contains the correct staff_id, role, name, and facility_id.
 *
 * Run this once after deploying the new auth system to fix any existing
 * accounts that were created before the staff_id field was added.
 */
export async function POST(request: Request) {
    try {
        // Auth check
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
        if (user?.user_metadata?.role !== 'platform_admin') {
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
                user_metadata: {
                    staff_id: s.id,
                    name: s.name,
                    role: s.role,
                    facility_id: s.facility_id ?? null,
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
