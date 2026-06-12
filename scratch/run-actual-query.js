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
  const facilityId = '31ff1930-1041-4019-992c-6f728475d5b4'; // From Bob Jenkin's record
  const localMidnight = new Date();
  localMidnight.setHours(0, 0, 0, 0);
  const todayStr = localMidnight.toISOString();

  console.log('Running tasks page query...');
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id, title, description, tags, is_completed, assigned_role, created_at, resident_id,
      resident:residents!inner(name, room_number, is_active),
      handover:handovers(shift_type, approved_at)
    `)
    .eq('facility_id', facilityId)
    .eq('resident.is_active', true)
    .gte('created_at', todayStr);

  if (error) {
    console.error('Query error:', error);
  } else {
    console.log('Query results count:', data.length);
    console.log('Results:', data);
  }
}

run();
