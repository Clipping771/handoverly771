import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { facilityId, name, role, employeeId, email, password } = await request.json();

    if (!facilityId || !name || !role || !employeeId || !email || !password) {
      return NextResponse.json(
        { error: 'All fields (facilityId, name, role, employeeId, email, password) are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // 1. Hash the password using bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // 2. Insert the new staff member
    const { data, error } = await supabase
      .from('staff')
      .insert([
        {
          facility_id: facilityId,
          name: name.trim(),
          role: role,
          employee_id: employeeId.trim(),
          email: email.trim().toLowerCase(),
          password_hash: passwordHash,
          pin_hash: passwordHash // backwards compatibility/fallback
        }
      ])
      .select();

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return NextResponse.json(
          { error: 'A user with this email address already exists.' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, staff: data[0] });
  } catch (err: any) {
    console.error('Staff registration error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to register staff member' },
      { status: 500 }
    );
  }
}
