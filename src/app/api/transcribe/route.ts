import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    const userKeysStr = formData.get('userKeys') as string;

    if (!file) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    let userKeys = {};
    try {
      userKeys = JSON.parse(userKeysStr || '{}');
    } catch (e) {}

    const groqKey = (userKeys as any)?.groqKey || process.env.GROQ_API_KEY || '';

    if (!groqKey) {
      return NextResponse.json({ 
        error: 'Groq API Key is not configured. Please set it in Settings to use cloud transcription.' 
      }, { status: 401 });
    }

    const newFormData = new FormData();
    newFormData.append('file', file, 'audio.webm');
    newFormData.append('model', 'whisper-large-v3-turbo');
    newFormData.append('language', 'en');
    newFormData.append('response_format', 'json');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`
      },
      body: newFormData
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Groq Whisper error:', data);
      throw new Error(data.error?.message || 'Failed to transcribe audio');
    }

    return NextResponse.json({ text: data.text });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
