const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createPlatformAdmin() {
  const email = 'dev@handoverly.com';
  const password = 'Password123!';
  const role = 'platform_admin';
  const name = 'System Developer';

  const staffId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  // Check if exists
  const { data: existingUser } = await supabase.from('staff').select('id').eq('email', email).single();
  if (existingUser) {
    console.log(`User ${email} already exists! Use password: ${password}`);
    return;
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, name, staff_id: staffId },
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    return;
  }

  console.log('Created Auth User:', authUser.user.id);

  const { error: dbError } = await supabase.from('staff').insert([{
    id: staffId,
    user_id: authUser.user.id,
    name,
    role,
    employee_id: 'DEV001',
    email,
    password_hash: passwordHash,
    pin_hash: passwordHash,
  }]);

  if (dbError) {
    console.error('Error inserting into staff table:', dbError);
  } else {
    console.log(`Successfully created platform admin!\nEmail: ${email}\nPassword: ${password}`);
  }
}

createPlatformAdmin();
