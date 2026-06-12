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

  console.log('Running query with alias: resident.is_active');
  const { data: dataAlias, error: errAlias } = await supabase
    .from('tasks')
    .select(`
      id, title, resident_id,
      resident:residents!inner(name, room_number, is_active)
    `)
    .eq('facility_id', facilityId)
    .eq('resident.is_active', true)
    .gte('created_at', todayStr);

  if (errAlias) {
    console.error('Alias query error:', errAlias);
  } else {
    console.log('Alias query result count:', dataAlias.length);
    console.log('Alias query results:', dataAlias);
  }

  console.log('\nRunning query with table name: residents.is_active');
  const { data: dataTable, error: errTable } = await supabase
    .from('tasks')
    .select(`
      id, title, resident_id,
      resident:residents!inner(name, room_number, is_active)
    `)
    .eq('facility_id', facilityId)
    .eq('residents.is_active', true)
    .gte('created_at', todayStr);

  if (errTable) {
    console.error('Table name query error:', errTable);
  } else {
    console.log('Table name query result count:', dataTable.length);
    console.log('Table name query results:', dataTable);
  }
}

run();
