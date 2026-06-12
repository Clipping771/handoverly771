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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing URL or service role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  // 1. Get all tasks
  const { data: tasks, error: fetchErr } = await supabase
    .from('tasks')
    .select('id, title, description, created_at, handover_id, is_completed');
    
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  console.log(`Total tasks found: ${tasks.length}`);

  // Find exact duplicates: same title, description, handover_id, and is_completed status
  const seen = new Set();
  const duplicateIds = [];
  
  for (const t of tasks) {
    const key = `${t.title}|${t.description}|${t.handover_id}|${t.is_completed}`;
    if (seen.has(key)) {
      duplicateIds.push(t.id);
    } else {
      seen.add(key);
    }
  }

  console.log(`Duplicate task records to delete: ${duplicateIds.length}`);

  if (duplicateIds.length > 0) {
    const { data: delResult, error: delErr } = await supabase
      .from('tasks')
      .delete()
      .in('id', duplicateIds);
      
    if (delErr) {
      console.error('Delete error:', delErr);
    } else {
      console.log('Successfully deleted duplicate tasks!');
    }
  }
}

run().catch(console.error);
