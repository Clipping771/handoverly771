import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { error: 'Username (Name) is required' },
        { status: 400 }
      );
    }

    const cleanedUsername = username.trim().toLowerCase();

    // Use Service Role to bypass RLS to lookup the user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch active staff member by name
    const { data: staffList, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('*')
      .eq('is_active', true);

    if (staffError || !staffList || staffList.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials or inactive account' },
        { status: 400 }
      );
    }

    // Filter list for matching name
    const staff = staffList.find(s => 
      (s.name && s.name.toLowerCase() === cleanedUsername)
    );

    if (!staff) {
      return NextResponse.json(
        { error: 'Invalid credentials or account does not exist' },
        { status: 401 }
      );
    }

    // Return the synthetic email so the client can perform Supabase signInWithPassword
    const syntheticEmail = `${staff.id}@handoverly.local`;

    return NextResponse.json({ success: true, email: syntheticEmail, staffId: staff.id });
  } catch (err: any) {
    console.error('Login mapping error:', err);
    return NextResponse.json(
      { error: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}
