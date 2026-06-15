import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || 'Failed to fetch Gemini models' }, { status: res.status });
    }

    const models = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name.replace('models/', ''),
        pricing: null
      }));

    return NextResponse.json({ models });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
