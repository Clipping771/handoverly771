const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  console.log('Starting Supabase Auth migration...');
  
  // 1. Fetch all staff members
  const { data: staffList, error } = await supabaseAdmin.from('staff').select('*');
  if (error) {
    console.error('Failed to fetch staff:', error);
    return;
  }

  console.log(`Found ${staffList.length} staff members.`);

  for (const staff of staffList) {
    const email = `${staff.id}@handoverly.local`;
    
    console.log(`Processing staff: ${staff.name} (${email})`);

    // We can't know the raw PIN, so we set a default one if we can't map it.
    // However, for the seeded ones we know: Admin = 1111, Jane = 2222, John = 3333
    let defaultPassword = 'changeme1234';
    if (staff.name === 'Admin User') defaultPassword = '1111';
    else if (staff.name === 'Jane Doe') defaultPassword = '2222';
    else if (staff.name === 'John Smith') defaultPassword = '3333';

    try {
      // Create user in Supabase Auth
      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          facility_id: staff.facility_id,
          role: staff.role,
          name: staff.name
        }
      });

      let authUserId;

      if (createError) {
        if (createError.message.includes('already registered') || createError.code === 'email_exists') {
          console.log(`User ${email} already exists in auth.users. Fetching to link...`);
          // Fetch existing user via admin API
          const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError) {
            console.error('Failed to list users:', listError);
            continue;
          }
          const existingUser = users.find(u => u.email === email);
          if (existingUser) {
             authUserId = existingUser.id;
          } else {
             console.error(`User ${email} exists but couldn't be found in list.`);
             continue;
          }
        } else {
          console.error(`Failed to create Auth user for ${staff.name}:`, createError);
          continue;
        }
      } else {
        authUserId = authUser.user.id;
      }

      // Update staff table with user_id
      const { error: updateError } = await supabaseAdmin
        .from('staff')
        .update({ user_id: authUserId })
        .eq('id', staff.id);

      if (updateError) {
        console.error(`Failed to link staff ${staff.name} to auth user:`, updateError);
      } else {
        console.log(`Successfully migrated ${staff.name}`);
      }
    } catch (e) {
      console.error(`Error processing ${staff.name}:`, e);
    }
  }
  console.log('Migration complete.');
}

migrate();
