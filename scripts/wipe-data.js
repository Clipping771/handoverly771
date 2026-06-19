/**
 * wipe-data.js
 * Deletes ALL operational data (staff, residents, handovers, etc.)
 * and ALL Supabase Auth users.
 * Facilities are KEPT so the app still works.
 * Run: node scripts/wipe-data.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function wipe() {
    console.log('\n🗑️  Starting full data wipe...\n');

    // ── 1. Delete all Supabase Auth users ──────────────────────────────────────
    console.log('Step 1: Deleting Auth users...');
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
        console.error('  ❌ Failed to list auth users:', listErr.message);
    } else {
        console.log(`  Found ${users.length} auth users`);
        for (const u of users) {
            const { error } = await supabase.auth.admin.deleteUser(u.id);
            if (error) {
                console.error(`  ❌ Failed to delete auth user ${u.email}:`, error.message);
            } else {
                console.log(`  ✅ Deleted auth user: ${u.email}`);
            }
        }
    }

    // ── 2. Wipe tables in dependency order ─────────────────────────────────────
    const tables = [
        'activity_timeline',
        'handovers',
        'residents',
        'staff',
        'wings',
        // 'facilities',  ← intentionally KEPT
    ];

    for (const table of tables) {
        console.log(`\nStep: Wiping table "${table}"...`);
        const { error, count } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000') // matches all rows
            .select('id', { count: 'exact', head: true });

        if (error) {
            // Some tables might not exist yet — that's fine
            if (error.code === '42P01') {
                console.log(`  ⚠️  Table "${table}" does not exist — skipping`);
            } else {
                console.error(`  ❌ Error wiping "${table}":`, error.message);
            }
        } else {
            console.log(`  ✅ Wiped "${table}"`);
        }
    }

    // Also wipe any extra tables that may exist in the live DB
    const extraTables = ['tasks', 'insights', 'external_comms', 'medications', 'ai_config'];
    for (const table of extraTables) {
        const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error && error.code !== '42P01') {
            console.error(`  ❌ Error wiping "${table}":`, error.message);
        } else if (!error) {
            console.log(`  ✅ Wiped extra table "${table}"`);
        }
    }

    // ── 3. Show remaining facilities ───────────────────────────────────────────
    console.log('\nStep: Checking remaining facilities (kept)...');
    const { data: facilities, error: facErr } = await supabase.from('facilities').select('id, name, code');
    if (facErr) {
        console.error('  ❌ Could not read facilities:', facErr.message);
    } else {
        console.log(`  ✅ ${facilities.length} facility/facilities kept:`);
        facilities.forEach(f => console.log(`     - ${f.name} (${f.code})`));
    }

    console.log('\n✅ Wipe complete. App data is clean. Facilities are intact.\n');
}

wipe().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
