const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: facs } = await supabase.from('facilities').select('*');
  console.log('Facilities:', facs);
  const { data: staff } = await supabase.from('staff').select('*');
  console.log('All Staff:', staff);
}
run();
