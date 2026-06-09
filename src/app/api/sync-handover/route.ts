import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Assuming a server/admin client

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { handoverRecord, shiftTasks, carerTasks } = body;
    const tasksToSync = shiftTasks || carerTasks;

    // Insert Handover
    const { data: insertedHandover, error: handoverError } = await supabase
      .from('handovers')
      .insert([handoverRecord])
      .select('id')
      .single();

    if (handoverError) {
      console.error('Handover Insert Error:', handoverError);
      return NextResponse.json({ error: handoverError.message }, { status: 500 });
    }

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
        
      if (tasksError) {
        console.error('Tasks Insert Error:', tasksError);
        // We still return success for handover but log task error
      }
    }

    // Insert Audit Log (Activity Timeline)
    const auditRecord = {
      resident_id: handoverRecord.resident_id,
      staff_id: handoverRecord.submitted_by,
      facility_id: handoverRecord.facility_id,
      action_type: 'handover_submitted',
      description: `Handover submitted by Staff ID ${handoverRecord.submitted_by}`,
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
