const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: tasks, error: fetchErr } = await supabase
    .from('tasks')
    .select('id, created_at')
    .eq('handover_id', '517bfd6b-c0ca-462b-82dd-649c5ac314f6');
    
  if (fetchErr) {
    console.error(fetchErr);
    return;
  }
  
  const toDelete = tasks
    .filter(t => t.created_at.includes('12:41:'))
    .map(t => t.id);
    
  console.log('IDs to delete:', toDelete);
  
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('tasks')
      .delete()
      .in('id', toDelete);
      
    if (delErr) {
      console.error(delErr);
    } else {
      console.log('Successfully deleted the 12:41 tasks by ID!');
    }
  }
}

run();
