import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    // Fetch incomplete tasks created more than 2 hours ago
    const { data, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id, title, description, tags, created_at, resident_id, assigned_role, facility_id,
        resident:residents(name, room_number),
        handover:handovers(urgency, shift_type, facility_id)
      `)
      .or('is_completed.is.null,is_completed.eq.false')
      .lt('created_at', twoHoursAgo);

    if (tasksError) {
      console.error('Sentinel fetch tasks error:', tasksError);
      // Log failure execution
      await supabase.from('scheduler_execution_logs').insert([{
        alert_scanned_count: 0,
        status: 'failure',
        details: { error: tasksError.message }
      }]);
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    const tasksList: any[] = data || [];

    // Filter tasks where the associated handover is high-priority ('critical' or 'attention')
    // or has high-priority tags ('incidents', 'medication')
    const escalatedTasks = tasksList.filter((t: any) => {
      const urgency = t.handover?.urgency || 'routine';
      const hasPriorityTag = t.tags?.includes('medication') || t.tags?.includes('incidents');
      return urgency === 'critical' || urgency === 'attention' || hasPriorityTag;
    });

    // Write audit execution log
    const { error: logError } = await supabase
      .from('scheduler_execution_logs')
      .insert([{
        alert_scanned_count: escalatedTasks.length,
        status: 'success',
        details: {
          scanned_total: tasksList.length,
          escalated_tasks: escalatedTasks.map((t: any) => {
            const resObj = Array.isArray(t.resident) ? t.resident[0] : t.resident;
            const handObj = Array.isArray(t.handover) ? t.handover[0] : t.handover;
            return {
              id: t.id,
              title: t.title,
              resident: resObj?.name,
              room: resObj?.room_number,
              urgency: handObj?.urgency || 'routine'
            };
          })
        }
      }]);

    if (logError) {
      console.error('Failed to write execution log:', logError);
    }

    // Optionally: Write escalation warnings to activity timeline for auditing
    for (const t of escalatedTasks) {
      const resObj = Array.isArray(t.resident) ? t.resident[0] : t.resident;
      const handObj = Array.isArray(t.handover) ? t.handover[0] : t.handover;
      await supabase.from('activity_timeline').insert([{
        resident_id: t.resident_id,
        facility_id: t.facility_id || handObj?.facility_id || null,
        action_type: 'sentinel_escalation_triggered',
        description: `CRITICAL ALERT ESCALATION: Task "${t.title}" for ${resObj?.name || 'Resident'} (Room ${resObj?.room_number || 'N/A'}) has remained uncompleted for over 2 hours.`,
        metadata: { task_id: t.id, urgency: handObj?.urgency || 'routine' }
      }]);
    }

    return NextResponse.json({
      success: true,
      scanned_total: tasksList.length,
      escalated_count: escalatedTasks.length,
      escalated_tasks: escalatedTasks
    });

  } catch (err: any) {
    console.error('Sentinel Escalation Route Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
