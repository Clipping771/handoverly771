const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = "https://rqbkoryrlkglgsnqonvf.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxYmtvcnlybGtnbGdzbnFvbnZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTE2NDEsImV4cCI6MjA5NjM2NzY0MX0.mqp50AJbXOw-6lsRHC6fnm8R2Elrdf0E4PjQBlV4N04";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  // Create admin for Adelaide Care Center
  const adminAdelaide = {
    facility_id: '31ff1930-1041-4019-992c-6f728475d5b4',
    name: 'System Admin',
    role: 'admin',
    employee_id: 'ADMIN',
    email: 'admin@handoverly.com.au',
    password_hash: passwordHash,
    pin_hash: passwordHash,
    is_active: true
  };

  const { data, error } = await supabase
    .from('staff')
    .insert([adminAdelaide])
    .select();

  if (error) {
    console.error('Error seeding admin:', error);
  } else {
    console.log('Seeded admin successfully:', data);
  }
}

seed();
