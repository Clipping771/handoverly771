import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';

// One-time admin creation endpoint
// POST /api/auth/create-admin with { name, email, employeeId, password, facilityId }
export async function POST(request: Request) {
  try {
    const { name, email, employeeId, password, facilityId } = await request.json();

    if (!name || !email || !employeeId || !password || !facilityId) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabaseAdmin
      .from('staff')
      .insert([{
        facility_id: facilityId,
        name: name.trim(),
        role: 'admin',
        employee_id: employeeId.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        pin_hash: passwordHash,
      }])
      .select();

    if (error) {
      if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('already exists')) {
        const msg = error.message.toLowerCase();
        if (msg.includes('email')) {
          return NextResponse.json({ error: 'An admin with this email address already exists.' }, { status: 400 });
        }
        if (msg.includes('employee_id') || msg.includes('employee')) {
          return NextResponse.json({ error: 'An admin with this Employee ID already exists.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'An admin account with these details already exists.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, staff: data[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/auth/create-admin - list facilities and existing admins
export async function GET() {
  try {
    const { data: facilities, error: facError } = await supabaseAdmin
      .from('facilities')
      .select('id, name, code');
    if (facError) throw facError;

    const { data: admins, error: adminError } = await supabaseAdmin
      .from('staff')
      .select(`
        id,
        name,
        role,
        employee_id,
        email,
        facility_id,
        facilities (
          name
        )
      `)
      .eq('role', 'admin')
      .order('created_at', { ascending: false });
    if (adminError) throw adminError;

    return NextResponse.json({ facilities, admins });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
