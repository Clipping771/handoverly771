import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { handoverId, facilityId, staffId, action, newSummary, rejectionReason } = await request.json();

    if (!handoverId || !facilityId || !staffId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate action
    if (!['approve', 'edit', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Fetch the current handover state
    const { data: currentHandover, error: fetchError } = await supabase
      .from('handovers')
      .select('*')
      .eq('id', handoverId)
      .eq('facility_id', facilityId)
      .single();

    if (fetchError || !currentHandover) {
      return NextResponse.json({ error: 'Handover not found' }, { status: 404 });
    }

    // Since we are creating records across multiple tables (audit_log, handover_versions, handovers),
    // and we need to bypass some RLS for system operations or ensure it's done atomically, 
    // we use the service role key.
    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    let nextStatus = 'needs_review';
    let summaryToSave = currentHandover.rn_summary;

    if (action === 'approve') {
      nextStatus = 'published';
    } else if (action === 'reject') {
      nextStatus = 'rejected';
    } else if (action === 'edit') {
      if (!newSummary) return NextResponse.json({ error: 'newSummary required for edit action' }, { status: 400 });
      nextStatus = 'published';
      summaryToSave = newSummary;

      // Create a version record
      await supabaseAdmin.from('handover_versions').insert([{
        handover_id: handoverId,
        facility_id: facilityId,
        edited_by: staffId,
        previous_summary: currentHandover.rn_summary,
        new_summary: newSummary
      }]);
    }

    // Update the handover status
    const updateData: any = { status: nextStatus };
    if (action === 'edit') {
      updateData.rn_summary = summaryToSave;
    }
    if (action === 'approve' || action === 'edit') {
      updateData.approved_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from('handovers')
      .update(updateData)
      .eq('id', handoverId);

    if (updateError) {
      throw new Error(`Failed to update handover: ${updateError.message}`);
    }

    // If published (approved or edited), create the pending carer tasks IF they weren't created yet.
    // Wait, if it was in `needs_review`, the tasks might not have been created.
    // Let's check if there are tasks for this handover.
    if (nextStatus === 'published') {
      const { count } = await supabaseAdmin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('handover_id', handoverId);

      if (count === 0 && currentHandover.carer_tasks && currentHandover.carer_tasks.length > 0) {
        const taskInserts = currentHandover.carer_tasks.map((t: any) => ({
          resident_id: currentHandover.resident_id,
          facility_id: facilityId,
          handover_id: handoverId,
          title: t.title,
          description: t.description,
          assigned_role: t.assigned_role || 'carer',
          tags: t.tags || [],
          clinical_purpose: t.clinical_purpose,
          carry_until_date: t.carry_until_date
        }));
        await supabaseAdmin.from('tasks').insert(taskInserts);
      }
    }

    // Create Audit Log
    const actionType = action === 'approve' ? 'APPROVE_HANDOVER' : action === 'edit' ? 'EDIT_HANDOVER' : 'REJECT_HANDOVER';
    await supabaseAdmin.from('audit_log').insert([{
      facility_id: facilityId,
      actor_id: staffId,
      target_id: handoverId,
      action_type: actionType,
      before_state: { status: currentHandover.status, summary: currentHandover.rn_summary },
      after_state: { status: nextStatus, summary: summaryToSave, reason: rejectionReason }
    }]);

    return NextResponse.json({ success: true, status: nextStatus });

  } catch (error: any) {
    console.error('Error reviewing handover:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
