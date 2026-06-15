import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || 'Failed to fetch OpenAI models' }, { status: res.status });
    }

    // Filter to GPT chat models only
    const chatModels = (data.data || [])
      .filter((m: any) => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))
      .sort((a: any, b: any) => b.created - a.created)
      .map((m: any) => ({
        id: m.id,
        name: m.id,
        pricing: null
      }));

    return NextResponse.json({ models: chatModels });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
