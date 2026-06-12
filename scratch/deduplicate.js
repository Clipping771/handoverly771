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
  console.log('Fetching all handovers to identify duplicates...');
  const { data: handovers, error } = await supabase
    .from('handovers')
    .select('id, resident_id, shift_date, shift_type, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching handovers:', error);
    return;
  }

  const seen = new Set();
  const duplicateIds = [];

  for (const h of handovers) {
    const key = `${h.resident_id}-${h.shift_date}-${h.shift_type}`;
    if (seen.has(key)) {
      duplicateIds.push(h.id);
    } else {
      seen.add(key);
    }
  }

  console.log(`Found ${duplicateIds.length} duplicate handovers to delete.`);
  if (duplicateIds.length > 0) {
    console.log('Deleting duplicate handovers:', duplicateIds);
    const { error: deleteError } = await supabase
      .from('handovers')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) {
      console.error('Error deleting duplicates:', deleteError);
    } else {
      console.log('Successfully deleted all duplicate handovers!');
    }
  } else {
    console.log('No duplicates found in the database.');
  }
}

run();
