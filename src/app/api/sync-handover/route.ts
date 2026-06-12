import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseUntilDate } from '@/lib/taskUtils';
import { Pool } from 'pg';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

function hashStringToInteger(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash;
}

export async function POST(req: Request) {
  let client;
  let useTransaction = false;
  try {
    try {
      client = await pool.connect();
      useTransaction = true;
    } catch (dbErr) {
      // Silently fall back to Supabase REST API if direct DB port 5432 is blocked
    }

    let body;
    try {
      body = await req.json();
    } catch (jsonErr) {
      console.error('Failed to parse request JSON body in sync-handover:', jsonErr);
      return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
    }
    const { handoverRecord, shiftTasks, carerTasks } = body || {};
    const tasksToSync = shiftTasks || carerTasks;

    // Extract properties that are not in the handovers table schema
    const { device_id, version_number, shift_tasks, is_update_action, ...handoverDbRecord } = handoverRecord;

    // Fix null constraint violations and populate JSONB arrays
    if (!handoverDbRecord.carer_tasks) handoverDbRecord.carer_tasks = tasksToSync || [];
    if (!handoverDbRecord.rn_summary) handoverDbRecord.rn_summary = {};
    if (!handoverDbRecord.rn_summary_original) handoverDbRecord.rn_summary_original = {};
    if (!handoverDbRecord.raw_input) handoverDbRecord.raw_input = "";

    if (useTransaction && client) {
      // Acquire PostgreSQL advisory lock to prevent concurrent sync collisions from the same session
      const lockKey = hashStringToInteger(handoverDbRecord.resident_id || 'global_sync');
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
    }

    // Check if a handover already exists for this resident, date, and shift type
    const { data: existingHandover } = await supabase
      .from('handovers')
      .select('id, raw_input, rn_summary')
      .eq('resident_id', handoverDbRecord.resident_id)
      .eq('shift_date', handoverDbRecord.shift_date)
      .eq('shift_type', handoverDbRecord.shift_type)
      .single();

    let insertedHandover;
    let newVersion = 1;

    if (existingHandover) {
      if (is_update_action) {
        // Smart Merge Raw Inputs if they are different
        let mergedRawInput = handoverDbRecord.raw_input;
        if (existingHandover.raw_input && !existingHandover.raw_input.includes(handoverDbRecord.raw_input)) {
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          mergedRawInput = `${existingHandover.raw_input}\n\n---\n[Addendum at ${timeStr}]:\n${handoverDbRecord.raw_input}`;
        }

        // Merge ISBAR summaries
        const mergedRnSummary = { ...existingHandover.rn_summary };
        const newRnSummary = handoverDbRecord.rn_summary || {};
        
        const fields = ['situation', 'background', 'assessment', 'recommendation'] as const;
        fields.forEach(field => {
          const existingVal = (existingHandover.rn_summary?.[field] || '').trim();
          const newVal = (newRnSummary[field] || '').trim();
          if (newVal && existingVal && !existingVal.includes(newVal)) {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            mergedRnSummary[field] = `${existingVal}\n\n[Update at ${timeStr}]: ${newVal}`;
          } else if (newVal) {
            mergedRnSummary[field] = newVal;
          }
        });

        handoverDbRecord.raw_input = mergedRawInput;
        handoverDbRecord.rn_summary = mergedRnSummary;
      }

      // Calculate new version number from handover_versions table
      const { data: versionData } = await supabase
        .from('handover_versions')
        .select('version')
        .eq('handover_id', existingHandover.id)
        .order('version', { ascending: false })
        .limit(1);
      
      const currentVerNum = versionData && versionData[0] ? versionData[0].version : 1;
      newVersion = currentVerNum + 1;

      // Update existing handover
      const { data: updated, error: handoverError } = await supabase
        .from('handovers')
        .update(handoverDbRecord)
        .eq('id', existingHandover.id)
        .select('id')
        .single();
        
      if (handoverError) {
        console.error('Handover Update Error:', handoverError);
        const status = handoverError.code === '23503' ? 404 : 500;
        return NextResponse.json({ error: handoverError.message, code: handoverError.code }, { status });
      }
      insertedHandover = updated;
    } else {
      // Insert new handover
      const { data: inserted, error: handoverError } = await supabase
        .from('handovers')
        .insert([handoverDbRecord])
        .select('id')
        .single();

      if (handoverError) {
        // If it's a unique constraint violation (code 23505), retry by updating instead.
        if (handoverError.code === '23505') {
          console.log('Concurrency collision detected. Retrying with update/merge logic...');
          const { data: retryHandover } = await supabase
            .from('handovers')
            .select('id, raw_input, rn_summary')
            .eq('resident_id', handoverDbRecord.resident_id)
            .eq('shift_date', handoverDbRecord.shift_date)
            .eq('shift_type', handoverDbRecord.shift_type)
            .single();

          if (retryHandover) {
            if (is_update_action) {
              let mergedRawInput = handoverDbRecord.raw_input;
              if (retryHandover.raw_input && !retryHandover.raw_input.includes(handoverDbRecord.raw_input)) {
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                mergedRawInput = `${retryHandover.raw_input}\n\n---\n[Addendum at ${timeStr}]:\n${handoverDbRecord.raw_input}`;
              }

              const mergedRnSummary = { ...retryHandover.rn_summary };
              const newRnSummary = handoverDbRecord.rn_summary || {};
              const fields = ['situation', 'background', 'assessment', 'recommendation'] as const;
              fields.forEach(field => {
                const existingVal = (retryHandover.rn_summary?.[field] || '').trim();
                const newVal = (newRnSummary[field] || '').trim();
                if (newVal && existingVal && !existingVal.includes(newVal)) {
                  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  mergedRnSummary[field] = `${existingVal}\n\n[Update at ${timeStr}]: ${newVal}`;
                } else if (newVal) {
                  mergedRnSummary[field] = newVal;
                }
              });

              handoverDbRecord.raw_input = mergedRawInput;
              handoverDbRecord.rn_summary = mergedRnSummary;
            }

            const { data: versionData } = await supabase
              .from('handover_versions')
              .select('version')
              .eq('handover_id', retryHandover.id)
              .order('version', { ascending: false })
              .limit(1);
            
            const currentVerNum = versionData && versionData[0] ? versionData[0].version : 1;
            newVersion = currentVerNum + 1;

            const { data: updated, error: retryUpdateError } = await supabase
              .from('handovers')
              .update(handoverDbRecord)
              .eq('id', retryHandover.id)
              .select('id')
              .single();

            if (retryUpdateError) {
              console.error('Handover Concurrency Retry Update Error:', retryUpdateError);
              const status = retryUpdateError.code === '23503' ? 404 : 500;
              return NextResponse.json({ error: retryUpdateError.message, code: retryUpdateError.code }, { status });
            }
            insertedHandover = updated;
          } else {
            return NextResponse.json({ error: handoverError.message }, { status: 500 });
          }
        } else {
          console.error('Handover Insert Error:', handoverError);
          const status = handoverError.code === '23503' ? 404 : 500;
          return NextResponse.json({ error: handoverError.message, code: handoverError.code }, { status });
        }
      } else {
        insertedHandover = inserted;
      }
    }

    // Save snapshot in handover_versions table
    await supabase.from('handover_versions').insert([
      {
        handover_id: insertedHandover.id,
        version: newVersion,
        submitted_by: handoverDbRecord.submitted_by,
        raw_input: handoverDbRecord.raw_input,
        rn_summary: handoverDbRecord.rn_summary,
        carer_tasks: handoverDbRecord.carer_tasks || [],
        urgency: handoverDbRecord.urgency,
        risk_flags: handoverDbRecord.risk_flags || []
      }
    ]);

    // Insert Tasks
    if (tasksToSync && tasksToSync.length > 0) {
      // If we are overwriting (is_update_action is false/undefined), delete any tasks already registered to this handover
      if (existingHandover && !is_update_action) {
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('handover_id', existingHandover.id);
        if (deleteError) {
          console.error('Failed to delete old tasks for overwrite:', deleteError);
        }
      }

      const taskRecords = tasksToSync.map((t: any) => {
        const carryUntil = t.carry_until_date || parseUntilDate(t.description) || parseUntilDate(t.title);
        return {
          handover_id: insertedHandover.id,
          facility_id: handoverRecord.facility_id,
          resident_id: handoverRecord.resident_id,
          title: t.title,
          description: t.description,
          tags: t.tags,
          assigned_role: t.assigned_role || 'carer',
          carry_until_date: carryUntil || null,
          clinical_purpose: t.clinical_purpose
        };
      });
      
      let tasksError;
      
      // Fetch all currently active tasks for this resident to prevent duplicate insertions
      const { data: activeTasks } = await supabase
        .from('tasks')
        .select('title')
        .eq('resident_id', handoverRecord.resident_id)
        .or(`is_completed.eq.false,carry_until_date.gte.${handoverDbRecord.shift_date}`);
      
      const activeTitles = new Set((activeTasks || []).map((t: any) => t.title.toLowerCase().trim()));
      
      // Filter out new tasks that are already active for this resident
      const filteredTaskRecords = taskRecords.filter((t: any) => !activeTitles.has(t.title.toLowerCase().trim()));
      
      if (filteredTaskRecords.length > 0) {
        const { error } = await supabase
          .from('tasks')
          .insert(filteredTaskRecords);
        tasksError = error;
      }
        
      if (!tasksError) {
        // Mark all previous incomplete tasks for this resident as completed/superseded
        // since they have now been successfully carried forward to this new shift
        await supabase
          .from('tasks')
          .update({ is_completed: true })
          .eq('resident_id', handoverRecord.resident_id)
          .eq('is_completed', false)
          .neq('handover_id', insertedHandover.id);
      } else {
        console.error('Tasks Insert/Merge Error:', tasksError);
      }
    }

    // Fetch staff name for audit log
    let staffName = `Staff (ID: ${handoverRecord.submitted_by ? handoverRecord.submitted_by.substring(0, 8) : 'Unknown'})`;
    if (handoverRecord.submitted_by) {
      const { data: staffData } = await supabase
        .from('staff')
        .select('name')
        .eq('id', handoverRecord.submitted_by)
        .single();
      if (staffData && staffData.name) {
        staffName = staffData.name;
      }
    }

    // Insert Audit Log (Activity Timeline)
    const auditRecord = {
      resident_id: handoverRecord.resident_id,
      staff_id: handoverRecord.submitted_by,
      facility_id: handoverRecord.facility_id,
      action_type: 'handover_submitted',
      description: `Handover submitted by ${staffName}`,
      metadata: {
        device_id: handoverRecord.device_id,
        shift_type: handoverRecord.shift_type,
        version_number: handoverRecord.version_number
      }
    };

    await supabase.from('activity_timeline').insert([auditRecord]);

    // Invalidate the database insights cache for this resident
    await supabase
      .from('resident_insights')
      .delete()
      .eq('resident_id', handoverRecord.resident_id);

    if (useTransaction && client) {
      await client.query('COMMIT');
      client.release();
    }
    return NextResponse.json({ success: true, id: insertedHandover.id });

  } catch (err: any) {
    if (useTransaction && client) {
      await client.query('ROLLBACK').catch(console.error);
      client.release();
    }
    console.error('Sync Handover Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
