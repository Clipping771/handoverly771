const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
    return;
  }

  const passwordHash = await bcrypt.hash('Password123!', 10);
  
  for (const u of users) {
    console.log('Auth user:', u.id, u.email, u.user_metadata);
    
    // Check if in staff table
    const { data: staffMember } = await supabase.from('staff').select('*').eq('user_id', u.id).single();
    if (!staffMember) {
      console.log('User missing from staff table, inserting...');
      const role = u.user_metadata.role || 'carer';
      const name = u.user_metadata.name || 'Staff';
      const facilityId = u.user_metadata.facility_id || '976a94d6-b04a-4f48-98c2-f786e36ced13';
      const empId = role === 'platform_admin' ? 'DEV001' : (role === 'admin' ? 'ADM001' : 'EMP999');
      
      const { error: insertErr } = await supabase.from('staff').insert([{
        id: u.user_metadata.staff_id || crypto.randomUUID(),
        user_id: u.id,
        facility_id: facilityId,
        name,
        role,
        employee_id: empId,
        email: u.email,
        password_hash: passwordHash,
        pin_hash: passwordHash,
        is_active: true
      }]);
      
      if (insertErr) {
        console.error('Insert error:', insertErr);
      } else {
        console.log(`Successfully synced staff table for ${u.email} (${role})`);
      }
    } else {
      console.log('User already exists in staff table:', staffMember.employee_id);
    }
  }
}
run();
