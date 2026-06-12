const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = (match[2] || '').replace(/^"|"$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const ids = ['40c6261a-b8e2-4be9-9a69-b48523e55edc', 'ef9e4717-a55d-4d32-a4c8-12581dcb37ee'];
  
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, assigned_role, created_at, resident_id, resident:residents(name, room_number, is_active)')
    .in('id', ids);
    
  console.log('Mystery tasks details:', tasks);
}

run();
