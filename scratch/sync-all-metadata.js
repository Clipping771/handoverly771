/**
 * One-time migration: sync staff_id, role, name, facility_id into
 * every Supabase Auth user's user_metadata.
 *
 * Run: node -r dotenv/config scratch/sync-all-metadata.js dotenv_config_path=.env.local
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function syncAll() {
    console.log('\n🔄 Syncing auth user_metadata for all staff...\n');

    const { data: allStaff, error } = await supabaseAdmin
        .from('staff')
        .select('id, user_id, name, role, facility_id')
        .not('user_id', 'is', null);

    if (error) {
        console.error('Failed to fetch staff:', error.message);
        process.exit(1);
    }

    let updated = 0;
    let failed = 0;

    for (const s of allStaff) {
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(s.user_id, {
            user_metadata: {
                staff_id: s.id,
                name: s.name,
                role: s.role,
                facility_id: s.facility_id ?? null,
            },
        });

        if (updateErr) {
            console.error(`  ❌ ${s.name} (${s.id}): ${updateErr.message}`);
            failed++;
        } else {
            console.log(`  ✅ ${s.name} — role: ${s.role}`);
            updated++;
        }
    }

    console.log(`\n📊 Done. Updated: ${updated}, Failed: ${failed}\n`);
}

syncAll();
