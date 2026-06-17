import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json({ success: false, error: 'Provider and API Key are required' }, { status: 400 });
    }

    let isSuccess = false;
    let message = '';

    try {
      if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) {
          isSuccess = true;
          message = 'Connected to OpenRouter successfully';
        } else {
          message = `OpenRouter validation failed: ${res.statusText}`;
        }
      } else if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) {
          isSuccess = true;
          message = 'Connected to OpenAI successfully';
        } else {
          message = `OpenAI validation failed: ${res.statusText}`;
        }
      } else if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) {
          isSuccess = true;
          message = 'Connected to Groq successfully';
        } else {
          message = `Groq validation failed: ${res.statusText}`;
        }
      } else if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (res.ok) {
          isSuccess = true;
          message = 'Connected to Google Gemini successfully';
        } else {
          message = `Gemini validation failed: ${res.statusText}`;
        }
      } else if (provider === 'anthropic') {
        // Anthropic doesn't have a simple auth endpoint, so we send an empty message to trigger an auth error or bad request.
        // If it's 401, key is bad. If it's 400 (missing messages), key is good.
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: []
          })
        });
        const data = await res.json();
        if (res.status === 400 && data.error?.type !== 'authentication_error') {
          isSuccess = true;
          message = 'Connected to Anthropic successfully';
        } else if (res.status === 401 || data.error?.type === 'authentication_error') {
          message = 'Anthropic validation failed: Invalid API Key';
        } else {
           isSuccess = true;
           message = 'Connected to Anthropic successfully';
        }
      } else if (provider === 'ollama') {
         // for ollama, the apikey is actually the url
         const res = await fetch(`${apiKey}/api/version`, { method: 'GET' });
         if (res.ok) {
             const data = await res.json();
             isSuccess = true;
             message = `Connected to Local Ollama successfully (v${data.version})`;
         } else {
             message = `Ollama connection failed: ${res.statusText}`;
         }
      } else {
        return NextResponse.json({ success: false, error: 'Unknown provider' }, { status: 400 });
      }
    } catch (fetchErr: any) {
      return NextResponse.json({ success: false, error: fetchErr.message || 'Connection timeout or network error' });
    }

    return NextResponse.json({ success: isSuccess, message });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
