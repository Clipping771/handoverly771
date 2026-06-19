const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUser() {
  const { data, error } = await supabaseAdmin.from('staff').select('*').eq('role', 'platform_admin');
  if (error) {
    console.error(error);
    return;
  }
  console.log('Platform Admin Staff Row:', data);
}

checkUser();
