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
  const { data: residents } = await supabase.from('residents').select('id, name, room_number').eq('room_number', '23');
  console.log('Residents in Room 23:', residents);
  
  if (residents && residents.length > 0) {
    const residentIds = residents.map(r => r.id);
    
    const { data: handovers } = await supabase
      .from('handovers')
      .select('id, resident_id, shift_date, shift_type, created_at, carer_tasks')
      .in('resident_id', residentIds);
    console.log('\nHandovers for Room 23:', handovers);
    
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, description, assigned_role, created_at, resident_id, handover_id')
      .in('resident_id', residentIds);
    console.log('\nTasks for Room 23:', tasks);
  }
}

run();
