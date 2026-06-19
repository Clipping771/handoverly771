const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const userId = '74606314-56bc-4359-972a-3304ed66d03a'; // MD's auth user ID

  // 1. Update auth metadata back to 'rn'
  const { data: authUser, error: authError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      role: 'rn',
      name: 'MD',
      facility_id: '976a94d6-b04a-4f48-98c2-f786e36ced13',
      staff_id: '86089047-7245-42f1-a02e-a7e0d2d011db'
    }
  });

  if (authError) {
    console.error('Error updating auth metadata:', authError);
    return;
  }

  // 2. Update staff table back to 'rn'
  const { error: dbError } = await supabase.from('staff').update({
    role: 'rn'
  }).eq('user_id', userId);

  if (dbError) {
    console.error('Error updating staff table:', dbError);
  } else {
    console.log("Successfully restored MD's role back to 'rn'!");
  }
}
run();
