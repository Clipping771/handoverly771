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
  const { data: timeline } = await supabase
    .from('activity_timeline')
    .select('*')
    .order('created_at', { ascending: true });
  console.log('Activity Timeline entries:');
  console.log(timeline.map(item => ({
    created_at: item.created_at,
    action_type: item.action_type,
    description: item.description,
    metadata: item.metadata
  })));
}

run();
