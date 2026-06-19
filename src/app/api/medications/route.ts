import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthContext } from '@/lib/auth-context';

export async function GET(request: Request) {
  try {
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('residentId');
    let facilityId = searchParams.get('facilityId');
    if (!residentId) throw new Error('Missing residentId');

    if (authCtx.role !== 'platform_admin') {
      facilityId = authCtx.facilityId;
    } else if (!facilityId) {
      throw new Error('Missing facilityId for platform admin query');
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify resident belongs to the facility
    const { data: resident, error: resError } = await supabaseAdmin
      .from('residents')
      .select('facility_id')
      .eq('id', residentId)
      .eq('facility_id', facilityId)
      .maybeSingle();

    if (resError || !resident) {
      return NextResponse.json({ success: false, error: 'Resident not found or access denied.' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('medication_profiles')
      .select(`*, last_reconciled_by(name)`)
      .eq('resident_id', residentId)
      .eq('facility_id', facilityId)
      .order('status', { ascending: true })
      .order('medication_name', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    const body = await request.json();

    if (authCtx.role !== 'platform_admin') {
      body.facility_id = authCtx.facilityId;
    }
    if (!body.facility_id) {
      return NextResponse.json({ success: false, error: 'facility_id is required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify resident belongs to the facility
    const { data: resident, error: resError } = await supabaseAdmin
      .from('residents')
      .select('facility_id')
      .eq('id', body.resident_id)
      .eq('facility_id', body.facility_id)
      .maybeSingle();

    if (resError || !resident) {
      return NextResponse.json({ success: false, error: 'Resident not found or access denied.' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('medication_profiles')
      .insert([body])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('API /api/medications POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    const body = await request.json();
    const { medIds, userId, updates, medId } = body;
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const targetFacilityId = authCtx.role === 'platform_admin' ? body.facilityId : authCtx.facilityId;

    if (!targetFacilityId) {
      return NextResponse.json({ success: false, error: 'facilityId is required' }, { status: 400 });
    }

    // Handle generic update for a single medication
    if (medId && updates) {
      const { error } = await supabaseAdmin
        .from('medication_profiles')
        .update(updates)
        .eq('id', medId)
        .eq('facility_id', targetFacilityId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Handle reconcile all
    if (!medIds || !medIds.length || !userId) {
      throw new Error('Missing medIds or userId for reconcile');
    }

    // Verify all medication IDs belong to target facility
    const { data: meds, error: fetchErr } = await supabaseAdmin
      .from('medication_profiles')
      .select('id')
      .in('id', medIds)
      .eq('facility_id', targetFacilityId);

    if (fetchErr || !meds || meds.length !== medIds.length) {
      return NextResponse.json({ success: false, error: 'One or more medications not found or access denied.' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('medication_profiles')
      .update({
        last_reconciled_at: new Date().toISOString(),
        last_reconciled_by: userId
      })
      .in('id', medIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API /api/medications PUT error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    let authCtx;
    try {
      authCtx = await getAuthContext();
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message || 'Unauthorized' }, { status: err.status || 401 });
    }

    const body = await request.json();
    const { medId, residentId } = body;
    const facilityId = authCtx.role === 'platform_admin' ? body.facilityId : authCtx.facilityId;

    if (!facilityId) throw new Error('Missing facilityId');
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (medId) {
      // Delete single medication
      const { error } = await supabaseAdmin
        .from('medication_profiles')
        .delete()
        .eq('id', medId)
        .eq('facility_id', facilityId);
      if (error) throw error;
    } else if (residentId) {
      // Delete all medications for a resident
      const { error } = await supabaseAdmin
        .from('medication_profiles')
        .delete()
        .eq('resident_id', residentId)
        .eq('facility_id', facilityId);
      if (error) throw error;
    } else {
      throw new Error('Missing medId or residentId');
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API /api/medications DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
