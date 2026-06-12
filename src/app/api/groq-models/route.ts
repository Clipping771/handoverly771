import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey') || '';

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 } // cache for 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch models from Groq' }, { status: res.status });
    }

    const data = await res.json();
    const models = (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.id, // Groq doesn't return friendly names, so use ID as name
      context: m.context_window,
      pricing: 0, // Groq doesn't provide pricing in API
    })).sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ models });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
