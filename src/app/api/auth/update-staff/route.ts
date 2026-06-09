import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { id, name, role, employeeId, email } = await request.json();

    if (!id || !name || !role || !employeeId || !email) {
      return NextResponse.json(
        { error: 'All fields (id, name, role, employeeId, email) are required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('staff')
      .update({
        name: name.trim(),
        role: role,
        employee_id: employeeId.trim(),
        email: email.trim().toLowerCase()
      })
      .eq('id', id);

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return NextResponse.json(
          { error: 'A user with this email address already exists.' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Update staff error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update staff member' },
      { status: 500 }
    );
  }
}
