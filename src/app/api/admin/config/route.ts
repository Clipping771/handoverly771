import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { facilityId, activeProvider, featureFlags, userKeys } = await request.json();

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });
    }

    const aiConfig = {
      activeProvider,
      featureFlags: featureFlags || {},
      keys: userKeys
    };

    const { error } = await supabase
      .from('facilities')
      .update({ ai_config: aiConfig })
      .eq('id', facilityId);

    if (error) {
      console.error('Error updating config:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Config save error:', err);
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
  }
}
