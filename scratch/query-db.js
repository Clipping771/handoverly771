const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse env file
const envPath = path.join(__dirname, '../.env.local');
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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching all residents...');
  const { data: residents, error: resError } = await supabase
    .from('residents')
    .select('id, name, room_number, is_active');
  
  if (resError) {
    console.error('Error fetching residents:', resError);
  } else {
    console.log('Residents:', residents);
  }

  console.log('\nFetching tasks...');
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, title, is_completed, created_at, resident_id, resident:residents(name, room_number, is_active)');

  if (tasksError) {
    console.error('Error fetching tasks:', tasksError);
  } else {
    console.log('Tasks:', tasks.map(t => ({
      id: t.id,
      title: t.title,
      is_completed: t.is_completed,
      created_at: t.created_at,
      resident_name: t.resident?.name,
      resident_is_active: t.resident?.is_active
    })));
  }
}

run();
