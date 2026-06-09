require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpdate() {
  const facilityId = '2a39a2be-70fa-4009-bfad-523194a34bde'; // A valid facility ID, wait I shouldn't guess it.
  
  // Get an actual facility ID
  const { data: facilities } = await supabase.from('facilities').select('id').limit(1);
  if (!facilities || facilities.length === 0) {
    console.log("No facilities found");
    return;
  }
  const id = facilities[0].id;
  console.log("Found facility ID:", id);

  const { data, error } = await supabase
    .from('facilities')
    .update({ ai_config: { test: "data" } })
    .eq('id', id);

  console.log("Error:", error);
  console.log("Data:", data);
}

testUpdate();
