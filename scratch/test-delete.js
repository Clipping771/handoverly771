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
  const id = 'adecd7c6-c5b6-403a-8dbd-c49301b1ab8e'; // Bob Jenkin
  console.log('Attempting to delete Bob Jenkin via Supabase Admin Client...');
  const { data, error } = await supabase
    .from('residents')
    .update({ is_active: false })
    .eq('id', id)
    .select();
    
  if (error) {
    console.error('Error during update:', error);
  } else {
    console.log('Update result:', data);
  }
}

run();
