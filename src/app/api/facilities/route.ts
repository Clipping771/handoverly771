import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET: Fetch all facilities
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('facilities')
      .select('id, name, code')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Fetch facilities error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch facilities' },
      { status: 500 }
    );
  }
}

// POST: Register a new facility
export async function POST(request: Request) {
  try {
    const { name, code } = await request.json();

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and Code are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('facilities')
      .insert([{
        name: name.trim(),
        code: code.trim()
      }])
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error('Insert facility error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to register facility' },
      { status: 500 }
    );
  }
}

// PUT: Update an existing facility
export async function PUT(request: Request) {
  try {
    const { id, name, code } = await request.json();

    if (!id || !name || !code) {
      return NextResponse.json(
        { error: 'ID, Name and Code are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('facilities')
      .update({
        name: name.trim(),
        code: code.trim()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error('Update facility error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update facility' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a facility
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Facility ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('facilities')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete facility error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete facility' },
      { status: 500 }
    );
  }
}
