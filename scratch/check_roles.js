const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://rqbkoryrlkglgsnqonvf.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYmtvcnlybGtnbGdzbnFvbnZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTE2NDEsImV4cCI6MjA5NjM2NzY0MX0.mqp50AJbXOw-6lsRHC6fnm8R2Elrdf0E4PjQBlV4N04";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: roles, error } = await supabase
    .from('roles')
    .select('*');
  
  if (error) {
    console.error('Error fetching roles:', error);
    return;
  }
  
  console.log('--- Roles ---');
  console.log(JSON.stringify(roles, null, 2));
}

check();
