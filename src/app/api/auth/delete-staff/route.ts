import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Staff ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('staff')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete staff error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete staff member' },
      { status: 500 }
    );
  }
}
