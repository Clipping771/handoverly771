import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey') || '';

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 } // cache for 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch models from OpenRouter' }, { status: res.status });
    }

    const data = await res.json();
    const models = (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      context: m.context_length,
      pricing: m.pricing?.prompt,
    })).sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ models });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
