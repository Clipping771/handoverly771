import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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

    const { data, error } = await supabase
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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, staff: data[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/auth/create-admin - list facilities so we know the ID
export async function GET() {
  const { data, error } = await supabase
    .from('facilities')
    .select('id, name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ facilities: data });
}
