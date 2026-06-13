const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, carry_until_date, is_completed, created_at, handover_id')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}

checkTasks();
