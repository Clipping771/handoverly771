const { Client } = require('pg');

async function fixRls() {
  const client = new Client({
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.rqbkoryrlkglgsnqonvf',
    password: 'Bcsbcsmba279@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  
  try {
    // Drop the old policy just in case
    await client.query(`DROP POLICY IF EXISTS "Allow public read facilities" ON public.facilities;`);
    await client.query(`DROP POLICY IF EXISTS "Allow public update facilities" ON public.facilities;`);
    
    // Create new policies
    await client.query(`CREATE POLICY "Allow public read facilities" ON public.facilities FOR SELECT USING (true);`);
    await client.query(`CREATE POLICY "Allow public update facilities" ON public.facilities FOR UPDATE USING (true);`);
    
    console.log("Successfully updated RLS on facilities.");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

fixRls();
