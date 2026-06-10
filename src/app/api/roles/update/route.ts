import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { id, name } = await request.json();

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Role ID and name are required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('roles')
      .update({ name: name.trim().toLowerCase() })
      .eq('id', id);

    if (error) {
      if (error.message.includes('unique')) {
        return NextResponse.json(
          { error: 'That role already exists.' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Update role error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update role' },
      { status: 500 }
    );
  }
}
