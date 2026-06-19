const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = '8adf8590-c850-4e4d-b85a-a47c0814608f';

  // Update Auth
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: password
  });

  if (error) {
    console.error('Auth update error:', error);
    return;
  }

  // Update in staff table
  const { error: dbError } = await supabase.from('staff').update({
    password_hash: passwordHash,
    pin_hash: passwordHash
  }).eq('user_id', userId);

  if (dbError) {
    console.error('DB update error:', dbError);
  } else {
    console.log('Password reset successfully for Hayley Hudson (ADM001) to Password123!');
  }
}
run();
