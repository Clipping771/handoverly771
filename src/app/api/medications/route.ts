import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('residentId');
    const facilityId = searchParams.get('facilityId');
    if (!residentId || !facilityId) throw new Error('Missing residentId or facilityId');

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
    const body = await request.json();
    
    // Create Supabase client with SERVICE_ROLE_KEY to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
    const body = await request.json();
    const { medIds, userId, updates, medId } = body;
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Handle generic update for a single medication
    if (medId && updates) {
      const { error } = await supabaseAdmin
        .from('medication_profiles')
        .update(updates)
        .eq('id', medId)
        .eq('facility_id', body.facilityId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Handle reconcile all
    if (!medIds || !medIds.length || !userId) {
      throw new Error('Missing medIds or userId for reconcile');
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
    const body = await request.json();
    const { medId, residentId, facilityId } = body;
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
