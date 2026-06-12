const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-ap-northeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.rqbkoryrlkglgsnqonvf',
  password: 'Bcsbcsmba279@',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    console.log('Creating resident_insights table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.resident_insights (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        resident_id UUID REFERENCES public.residents(id) ON DELETE CASCADE UNIQUE NOT NULL,
        facility_id UUID REFERENCES public.facilities(id) ON DELETE CASCADE NOT NULL,
        insights JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      
      ALTER TABLE public.resident_insights ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Allow public read resident_insights" ON public.resident_insights;
      CREATE POLICY "Allow public read resident_insights" ON public.resident_insights FOR SELECT USING (true);
      
      DROP POLICY IF EXISTS "Allow public write resident_insights" ON public.resident_insights;
      CREATE POLICY "Allow public write resident_insights" ON public.resident_insights FOR ALL USING (true);
    `);
    console.log('Success! resident_insights table created.');
  } catch (err) {
    console.error('Failed to create table:', err);
  } finally {
    await client.end();
  }
}

run();
