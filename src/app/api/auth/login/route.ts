import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username (Email/Employee ID) and password are required' },
        { status: 400 }
      );
    }

    const cleanedUsername = username.trim().toLowerCase();

    // 1. Fetch active staff member by email OR employee_id
    const { data: staffList, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('is_active', true);

    if (staffError || !staffList || staffList.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials or inactive account' },
        { status: 400 }
      );
    }

    // Filter list for matching email or employee ID (case insensitive)
    const staff = staffList.find(s => 
      (s.email && s.email.toLowerCase() === cleanedUsername) || 
      (s.employee_id && s.employee_id.toLowerCase() === cleanedUsername)
    );

    if (!staff) {
      return NextResponse.json(
        { error: 'Invalid credentials or account does not exist' },
        { status: 401 }
      );
    }

    // 2. Verify password against hashed password (fallback to pin_hash if password_hash is not populated yet)
    const hashToCompare = staff.password_hash || staff.pin_hash;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // 3. Fetch facility associated with staff member
    const { data: facility, error: facError } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', staff.facility_id)
      .single();

    if (facError || !facility) {
      return NextResponse.json(
        { error: 'Associated facility could not be found' },
        { status: 400 }
      );
    }

    // Remove sensitive fields before returning
    const { pin_hash, password_hash, ...staffData } = staff;

    // Create session payload
    const session = {
      staff: staffData,
      facility: facility,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000 // 12 hours session
    };

    const response = NextResponse.json({ success: true, session });
    
    // Set HTTP-only cookie for server-side auth checks
    response.cookies.set('carehandover_session', JSON.stringify(session), {
      httpOnly: false, // Accessible by client-side scripts
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 60 * 60, // 12 hours
      path: '/'
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}
