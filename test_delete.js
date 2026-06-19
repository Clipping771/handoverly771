const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testDelete() {
  const { data: admins } = await supabaseAdmin.from('staff').select('id, name, role').eq('role', 'admin').limit(5);
  console.log("Admins:", admins);
  
  if (admins && admins.length > 0) {
      const idToDelete = admins[0].id;
      console.log(`Trying to delete ${admins[0].name} (${idToDelete})`);
      
      const { error } = await supabaseAdmin.from('staff').delete().eq('id', idToDelete);
      if (error) {
          console.error("Delete error:", error);
      } else {
          console.log("Delete succeeded");
      }
  }
}

testDelete();
