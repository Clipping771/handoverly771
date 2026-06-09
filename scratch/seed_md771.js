const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = 'https://rqbkoryrlkglgsnqonvf.supabase.co';
const supabaseServiceKey = 'YOUR_SUPABASE_SERVICE_KEY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  try {
    console.log("Checking if facility MD771 already exists...");
    let { data: facility, error: facFindError } = await supabase
      .from('facilities')
      .select('id')
      .eq('code', 'MD771')
      .maybeSingle();

    if (facFindError) throw facFindError;

    let facilityId;
    if (!facility) {
      console.log("Inserting facility MD771...");
      const { data: newFac, error: facInsertError } = await supabase
        .from('facilities')
        .insert([{ name: 'Melbourne Care Center', code: 'MD771' }])
        .select()
        .single();
      if (facInsertError) throw facInsertError;
      facilityId = newFac.id;
      console.log(`Created facility MD771 with ID: ${facilityId}`);
    } else {
      facilityId = facility.id;
      console.log(`Facility MD771 already exists with ID: ${facilityId}`);
    }

    // Hash PIN 123456
    const pinHash = await bcrypt.hash('123456', 10);

    // Insert staff
    console.log("Seeding staff accounts for MD771...");
    const staffToSeed = [
      { name: 'Admin MD771', role: 'admin', pin_hash: pinHash, facility_id: facilityId },
      { name: 'Jane RN', role: 'rn', pin_hash: pinHash, facility_id: facilityId },
      { name: 'John Carer', role: 'carer', pin_hash: pinHash, facility_id: facilityId }
    ];

    for (const staff of staffToSeed) {
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('facility_id', facilityId)
        .eq('name', staff.name)
        .maybeSingle();

      if (!existingStaff) {
        const { error: staffError } = await supabase
          .from('staff')
          .insert([staff]);
        if (staffError) throw staffError;
        console.log(`Seeded staff member: ${staff.name}`);
      } else {
        console.log(`Staff member ${staff.name} already exists.`);
      }
    }

    // Insert residents
    console.log("Seeding residents for MD771...");
    const residentsToSeed = [
      { name: 'Sarah Jenkins', room_number: '201', dob: '1945-10-10', care_level: 'High', facility_id: facilityId },
      { name: 'Donald Evans', room_number: '202', dob: '1948-03-12', care_level: 'Low', facility_id: facilityId },
      { name: 'Elizabeth Taylor', room_number: '203', dob: '1939-06-25', care_level: 'Dementia', facility_id: facilityId }
    ];

    for (const res of residentsToSeed) {
      const { data: existingRes } = await supabase
        .from('residents')
        .select('id')
        .eq('facility_id', facilityId)
        .eq('name', res.name)
        .maybeSingle();

      if (!existingRes) {
        const { error: resError } = await supabase
          .from('residents')
          .insert([res]);
        if (resError) throw resError;
        console.log(`Seeded resident: ${res.name}`);
      } else {
        console.log(`Resident ${res.name} already exists.`);
      }
    }

    console.log("Database seeding completed successfully!");
  } catch (err) {
    console.error("Seeding failed:", err);
  }
}

seed();
