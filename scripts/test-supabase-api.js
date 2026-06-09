const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rqbkoryrlkglgsnqonvf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYmtvcnlybGtnbGdzbnFvbnZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTE2NDEsImV4cCI6MjA5NjM2NzY0MX0.mqp50AJbXOw-6lsRHC6fnm8R2Elrdf0E4PjQBlV4N04';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testApi() {
  console.log("Testing Supabase REST API connection...");
  try {
    const { data, error } = await supabase.from('facilities').select('*');
    if (error) {
      console.error("API error:", error);
    } else {
      console.log("API connection successful! Data:", data);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testApi();
