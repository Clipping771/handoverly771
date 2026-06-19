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

  // MD's user ID from the staff table
  const userId = '74606314-56bc-4359-972a-3304ed66d03a';

  // Update in Auth
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
    console.log('Password reset successfully for MD to Password123!');
  }
}
run();
