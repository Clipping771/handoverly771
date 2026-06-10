import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { handoverRecord, shiftTasks, carerTasks } = body;
    const tasksToSync = shiftTasks || carerTasks;

    // Extract properties that are not in the handovers table schema
    const { device_id, version_number, shift_tasks, ...handoverDbRecord } = handoverRecord;

    // Fix null constraint violations and populate JSONB arrays
    if (!handoverDbRecord.carer_tasks) handoverDbRecord.carer_tasks = tasksToSync || [];
    if (!handoverDbRecord.rn_summary) handoverDbRecord.rn_summary = {};
    if (!handoverDbRecord.rn_summary_original) handoverDbRecord.rn_summary_original = {};
    if (!handoverDbRecord.raw_input) handoverDbRecord.raw_input = "";

    // Check if a handover already exists for this resident, date, and shift type
    const { data: existingHandover } = await supabase
      .from('handovers')
      .select('id, raw_input')
      .eq('resident_id', handoverDbRecord.resident_id)
      .eq('shift_date', handoverDbRecord.shift_date)
      .eq('shift_type', handoverDbRecord.shift_type)
      .single();

    let insertedHandover;
    let newVersion = 1;

    if (existingHandover) {
      // Smart Merge Raw Inputs if they are different
      let mergedRawInput = handoverDbRecord.raw_input;
      if (existingHandover.raw_input && !existingHandover.raw_input.includes(handoverDbRecord.raw_input)) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        mergedRawInput = `${existingHandover.raw_input}\n\n---\n[Addendum at ${timeStr}]:\n${handoverDbRecord.raw_input}`;
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

      handoverDbRecord.raw_input = mergedRawInput;

      // Update existing handover
      const { data: updated, error: handoverError } = await supabase
        .from('handovers')
        .update(handoverDbRecord)
        .eq('id', existingHandover.id)
        .select('id')
        .single();
        
      if (handoverError) {
        console.error('Handover Update Error:', handoverError);
        return NextResponse.json({ error: handoverError.message }, { status: 500 });
      }
      insertedHandover = updated;
      
      // Delete existing tasks to replace them with the updated ones
      await supabase.from('tasks').delete().eq('handover_id', existingHandover.id);
    } else {
      // Insert new handover
      const { data: inserted, error: handoverError } = await supabase
        .from('handovers')
        .insert([handoverDbRecord])
        .select('id')
        .single();

      if (handoverError) {
        console.error('Handover Insert Error:', handoverError);
        return NextResponse.json({ error: handoverError.message }, { status: 500 });
      }
      insertedHandover = inserted;
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
      const taskRecords = tasksToSync.map((t: any) => ({
        handover_id: insertedHandover.id,
        facility_id: handoverRecord.facility_id,
        resident_id: handoverRecord.resident_id,
        title: t.title,
        description: t.description,
        tags: t.tags,
        assigned_role: t.assigned_role || 'carer'
      }));
      
      const { error: tasksError } = await supabase
        .from('tasks')
        .insert(taskRecords);
        
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
        console.error('Tasks Insert Error:', tasksError);
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

    return NextResponse.json({ success: true, id: insertedHandover.id });

  } catch (err: any) {
    console.error('Sync Handover Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
