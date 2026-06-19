import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthContext } from '@/lib/auth-context';

export async function POST(request: Request) {
  try {
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    const { staffId: verifiedStaffId, facilityId: verifiedFacilityId, role } = authCtx;
    const { handoverId, action, newSummary, rejectionReason, updatedAt } = await request.json();

    if (!handoverId || !action || !updatedAt) {
      return NextResponse.json({ error: 'Missing required fields (handoverId, action, updatedAt)' }, { status: 400 });
    }

    // Validate action
    if (!['approve', 'edit', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Since we are creating records across multiple tables and need to query safely,
    // we use the service role key.
    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch the current handover state
    let handoverQuery = supabaseAdmin
      .from('handovers')
      .select('*')
      .eq('id', handoverId);

    if (role !== 'platform_admin') {
      handoverQuery = handoverQuery.eq('facility_id', verifiedFacilityId);
    }

    const { data: currentHandover, error: fetchError } = await handoverQuery.single();

    if (fetchError || !currentHandover) {
      return NextResponse.json({ error: 'Handover not found or access denied' }, { status: 404 });
    }

    // Optimistic Concurrency Control (OCC) check
    if (new Date(currentHandover.updated_at).getTime() !== new Date(updatedAt).getTime()) {
      return NextResponse.json({ error: 'Handover was modified by another staff member, please refresh.' }, { status: 409 });
    }

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
        facility_id: currentHandover.facility_id,
        edited_by: verifiedStaffId,
        previous_summary: currentHandover.rn_summary,
        new_summary: newSummary
      }]);
    }

    // Update the handover status
    const updateData: any = { 
      status: nextStatus,
      updated_at: new Date().toISOString()
    };
    if (action === 'edit') {
      updateData.rn_summary = summaryToSave;
    }
    if (action === 'approve' || action === 'edit') {
      updateData.approved_at = new Date().toISOString();
    }

    // Enforce Optimistic Concurrency Control (OCC) to prevent race conditions
    const { data: updateDataResult, error: updateError } = await supabaseAdmin
      .from('handovers')
      .update(updateData)
      .eq('id', handoverId)
      .eq('updated_at', currentHandover.updated_at)
      .select();

    if (updateError || !updateDataResult || updateDataResult.length === 0) {
      return NextResponse.json({ error: 'Handover was modified by another staff member, please refresh.' }, { status: 409 });
    }

    // If published (approved or edited), create the pending carer tasks IF they weren't created yet.
    if (nextStatus === 'published') {
      const { count } = await supabaseAdmin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('handover_id', handoverId);

      if (count === 0 && currentHandover.carer_tasks && currentHandover.carer_tasks.length > 0) {
        const taskInserts = currentHandover.carer_tasks.map((t: any) => ({
          resident_id: currentHandover.resident_id,
          facility_id: currentHandover.facility_id,
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
      facility_id: currentHandover.facility_id,
      actor_id: verifiedStaffId,
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
