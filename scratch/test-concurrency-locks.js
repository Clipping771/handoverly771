/**
 * Concurrency Collision Lock Test
 * Simulates concurrent sync attempts for the same resident, shift date, and shift type.
 */

const { Client } = require('pg');

const dbConfig = {
  host: 'aws-1-ap-northeast-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.rqbkoryrlkglgsnqonvf',
  password: 'Bcsbcsmba279@',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function runTest() {
  console.log("Starting Concurrency Collision Lock Test...");
  
  const client1 = new Client(dbConfig);
  const client2 = new Client(dbConfig);

  await client1.connect();
  await client2.connect();

  try {
    // 1. Get a test resident
    const res = await client1.query("SELECT id, facility_id FROM public.residents WHERE is_active = true LIMIT 1;");
    if (res.rows.length === 0) {
      console.log("No active residents found in the database. Cannot run test.");
      return;
    }
    const residentId = res.rows[0].id;
    const facilityId = res.rows[0].facility_id;
    const testDate = '2026-06-12';
    const testShift = 'morning';

    console.log(`- Selected resident ID: ${residentId}, Date: ${testDate}, Shift: ${testShift}`);

    // 2. Clean up any existing handover for this test date/shift to ensure clean test
    await client1.query(`
      DELETE FROM public.handovers 
      WHERE resident_id = $1 AND shift_date = $2 AND shift_type = $3
    `, [residentId, testDate, testShift]);

    console.log("- Cleaned up existing handovers for test target.");

    // 3. Attempt concurrent inserts from both clients
    const insertQuery = `
      INSERT INTO public.handovers (
        facility_id, resident_id, raw_input, rn_summary, rn_summary_original, 
        carer_tasks, urgency, flags_status, is_approved, shift_date, shift_type, input_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id;
    `;
    const params1 = [facilityId, residentId, "Client 1 Raw Input", '{}', '{}', '[]', 'routine', 'none_detected', false, testDate, testShift, 'text'];
    const params2 = [facilityId, residentId, "Client 2 Raw Input", '{}', '{}', '[]', 'routine', 'none_detected', false, testDate, testShift, 'text'];

    console.log("- Dispatching concurrent database inserts...");
    
    const results = await Promise.allSettled([
      client1.query(insertQuery, params1),
      client2.query(insertQuery, params2)
    ]);

    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`  Succeeded: ${succeeded.length}, Failed: ${failed.length}`);

    // Assert that one query succeeds and the other fails due to unique constraint (23505)
    if (succeeded.length === 1 && failed.length === 1) {
      const error = failed[0].reason;
      console.log(`  Failed query error code: ${error.code} (${error.message})`);
      if (error.code === '23505') {
        console.log("✅ Concurrency isolation verified! Unique constraint code 23505 blocked duplicate insert.");
      } else {
        throw new Error(`Unexpected error code: ${error.code}`);
      }
    } else {
      throw new Error(`Unexpected concurrent result: Succeeded count = ${succeeded.length}, Failed count = ${failed.length}`);
    }

    // 4. Clean up after test
    await client1.query(`
      DELETE FROM public.handovers 
      WHERE resident_id = $1 AND shift_date = $2 AND shift_type = $3
    `, [residentId, testDate, testShift]);

    console.log("\n✅ Concurrency Collision Lock Test completed successfully!");

  } catch (err) {
    console.error("❌ Concurrency Test failed:", err.message);
    process.exit(1);
  } finally {
    await client1.end();
    await client2.end();
  }
}

runTest();
