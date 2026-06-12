const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://rqbkoryrlkglgsnqonvf.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYmtvcnlybGtnbGdzbnFvbnZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTE2NDEsImV4cCI6MjA5NjM2NzY0MX0.mqp50AJbXOw-6lsRHC6fnm8R2Elrdf0E4PjQBlV4N04";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: staff, error } = await supabase
    .from('staff')
    .select('*');
  
  if (error) {
    console.error('Error fetching staff:', error);
    return;
  }
  
  console.log('--- Active & Inactive Staff members ---');
  console.log(JSON.stringify(staff, null, 2));

  const { data: facilities, error: facError } = await supabase
    .from('facilities')
    .select('*');
  
  if (facError) {
    console.error('Error fetching facilities:', facError);
  } else {
    console.log('--- Facilities ---');
    console.log(JSON.stringify(facilities, null, 2));
  }
}

check();
