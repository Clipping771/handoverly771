import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ENHANCE_PROMPT = `You are a highly intelligent clinical documentation assistant for an Australian aged care facility.

The user has just dictated a rough voice note, which may contain speech-to-text errors, fragmented sentences, or just a few discrete keywords. Your job is to smartly interpret the intent and rewrite it into a clear, professional, and concise clinical description suitable for a shift handover note.

Rules:
1. Intelligently paraphrase and expand fragmented words or discrete information into complete, readable sentences.
2. Fix any speech-to-text garble or obvious errors using clinical context (e.g. "paintered" -> "Pain chart", "a seized" → "assessed", "care ers" -> "carers").
3. Rewrite in clear, professional third-person clinical language (e.g. "Resident requires..." or "Pain assessment completed...").
4. Keep the original clinical intent but make it sound professional and grammatically correct. Do NOT hallucinate new medical events, but do use your intelligence to form expected professional responses from the given clues.
5. Add proper punctuation, capitalisation, and structure.
6. Use Australian English spelling (e.g. behaviour, colour, mobilised).
7. Return ONLY the rewritten clinical description. No preamble, no quotes, no commentary.`;

export async function POST(request: Request) {
  try {
    const { text, userKeys, provider = 'auto' } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ refined: text });
    }

    const anthropicKey = userKeys?.anthropicKey || process.env.ANTHROPIC_API_KEY || '';
    const openrouterKey = userKeys?.openrouterKey || process.env.OPENROUTER_API_KEY || '';
    const openrouterModel = userKeys?.openrouterModel || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    const groqKey = userKeys?.groqKey || process.env.GROQ_API_KEY || '';
    const groqModel = userKeys?.groqModel || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const ollamaUrl = userKeys?.ollamaUrl || process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434';
    const ollamaModel = userKeys?.ollamaModel || process.env.OLLAMA_MODEL || 'llama3';

    let refined: string | null = null;

    // 1. Try Anthropic
    if ((provider === 'auto' || provider === 'anthropic') && anthropicKey && !refined) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        const msg = await client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          messages: [
            { role: 'user', content: `${ENHANCE_PROMPT}\n\nRaw dictation:\n"${text}"` }
          ]
        });
        const content = msg.content[0];
        if (content.type === 'text') {
          refined = content.text.trim();
        }
      } catch (err) {
        console.error('Anthropic enhance failed:', err);
      }
    }

    // 2. Try Groq
    if ((provider === 'auto' || provider === 'groq') && groqKey && !refined) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: 'user', content: `${ENHANCE_PROMPT}\n\nRaw dictation:\n"${text}"` }
            ],
            temperature: 0.1,
            max_tokens: 1024
          })
        });
        const data = await res.json();
        if (res.ok && data.choices?.[0]) {
          refined = data.choices[0].message?.content?.trim() || null;
        }
      } catch (err) {
        console.error('Groq enhance failed:', err);
      }
    }

    // 3. Try OpenRouter
    if ((provider === 'auto' || provider === 'openrouter') && openrouterKey && !refined) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Handoverly'
          },
          body: JSON.stringify({
            model: openrouterModel,
            messages: [
              { role: 'user', content: `${ENHANCE_PROMPT}\n\nRaw dictation:\n"${text}"` }
            ],
            temperature: 0.1,
            max_tokens: 1024
          })
        });
        const data = await res.json();
        if (res.ok && data.choices?.[0]) {
          refined = data.choices[0].message?.content?.trim() || null;
        }
      } catch (err) {
        console.error('OpenRouter enhance failed:', err);
      }
    }

    // 4. Try Ollama (Local)
    if ((provider === 'auto' || provider === 'ollama') && ollamaUrl && !refined) {
      try {
        const res = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: `${ENHANCE_PROMPT}\n\nRaw dictation:\n"${text}"`,
            stream: false,
            options: {
              temperature: 0.1
            }
          })
        });
        const data = await res.json();
        if (res.ok && data.response) {
          refined = data.response.trim();
        }
      } catch (err) {
        console.error('Ollama enhance failed:', err);
      }
    }

    // 5. Mock Provider (for testing when offline without API keys)
    if (provider === 'mock' || (provider === 'auto' && !refined)) {
      console.log('Using mock AI provider because no other AI was available or it was explicitly requested.');
      refined = `[MOCK AI] The resident's pain chart must be completed by the Registered Nurse. Carers are responsible for completing all other charts, including ADL, vowel, urinary, sleep, side, and sight charts.`;
    }

    // 6. Final fallback: return original text if even mock is bypassed
    return NextResponse.json({ refined: refined || text, error: !refined ? 'No AI provider available' : null });

  } catch (error: any) {
    console.error('Enhance text error:', error);
    return NextResponse.json({ refined: null, error: error.message }, { status: 500 });
  }
}
