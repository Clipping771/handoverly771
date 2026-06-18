/**
 * Bootstrap script for the platform admin account.
 * Run once: npm run setup-platform
 *
 * This creates (or repairs) the platform_admin account in both
 * Supabase Auth and the staff table, then prints the credentials.
 */
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function setupPlatformAdmin() {
  console.log('\n🔧 Bootstrapping Platform Admin...\n');

  const email = 'platform@handoverly.com';
  const password = 'SuperSecretPassword123!';
  const name = 'Platform Administrator';
  const role = 'platform_admin';
  const empId = 'SYS_001';

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // ── 1. Ensure Staff row exists ──────────────────────────────────────────
    const { data: existingStaff } = await supabaseAdmin
      .from('staff')
      .select('id, user_id')
      .eq('email', email)
      .maybeSingle();

    const staffId = existingStaff?.id ?? crypto.randomUUID();

    // ── 2. Ensure Supabase Auth user exists ─────────────────────────────────
    let authUserId = existingStaff?.user_id ?? null;

    if (!authUserId) {
      // Try to create
      const { data: newAuthUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { facility_id: null, role, name, staff_id: staffId },
      });

      if (createErr) {
        if (createErr.message?.includes('already')) {
          // Find existing auth user by email
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const found = users.find(u => u.email === email);
          if (!found) throw new Error('Could not locate existing auth user.');
          authUserId = found.id;
        } else {
          throw createErr;
        }
      } else {
        authUserId = newAuthUser.user.id;
      }
    }

    // ── 3. Always sync user_metadata (idempotent) ───────────────────────────
    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      user_metadata: { facility_id: null, role, name, staff_id: staffId },
    });
    console.log('✅ Auth user_metadata synced');

    // ── 4. Upsert staff row ─────────────────────────────────────────────────
    const { error: upsertErr } = await supabaseAdmin
      .from('staff')
      .upsert({
        id: staffId,
        user_id: authUserId,
        facility_id: null,
        name,
        role,
        employee_id: empId,
        email,
        password_hash: passwordHash,
        pin_hash: passwordHash,
        is_active: true,
      }, { onConflict: 'id' });

    if (upsertErr) throw upsertErr;
    console.log('✅ Staff record upserted');

    console.log('\n✅ Platform Admin ready!');
    console.log('─────────────────────────────────');
    console.log(`  Login:    ${empId}  or  ${email}`);
    console.log(`  Password: ${password}`);
    console.log('─────────────────────────────────');
    console.log('⚠️  Change this password after first login!\n');

  } catch (err) {
    console.error('\n❌ Setup failed:', err.message ?? err);
    process.exit(1);
  }
}

setupPlatformAdmin();
