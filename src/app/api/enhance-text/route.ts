import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ENHANCE_PROMPT = `You are a clinical documentation assistant for an Australian aged care facility.

The user has just dictated a rough voice note. Your job is to rewrite this into a clear, professional, and concise clinical description suitable for a shift handover note.

Rules:
1. Keep ALL factual content — do NOT invent, add, or remove clinical information
2. Rewrite in clear, professional third-person clinical language (e.g. "Resident was observed..." or "Pain assessment completed...")
3. Fix any obvious speech-to-text errors using clinical context (e.g. "a seized" → "assessed", "to" → "two", "there" → "their")
4. Add proper punctuation, capitalisation, and structure
5. Use Australian English spelling (e.g. behaviour, colour, monitored, mobilised)
6. Be concise — one to three sentences maximum
7. Return ONLY the rewritten clinical description. No preamble, no quotes, no commentary.`;

export async function POST(request: Request) {
  try {
    const { text, userKeys } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ refined: text });
    }

    const anthropicKey = userKeys?.anthropicKey || process.env.ANTHROPIC_API_KEY || '';
    const openrouterKey = userKeys?.openrouterKey || process.env.OPENROUTER_API_KEY || '';
    const openrouterModel = userKeys?.openrouterModel || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    const groqKey = userKeys?.groqKey || process.env.GROQ_API_KEY || '';
    const groqModel = userKeys?.groqModel || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    let refined: string | null = null;

    // 1. Try Anthropic
    if (anthropicKey && !refined) {
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
    if (groqKey && !refined) {
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
    if (openrouterKey && !refined) {
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

    // 4. Fallback: return original text if no AI available
    return NextResponse.json({ refined: refined || text });

  } catch (error: any) {
    console.error('Enhance text error:', error);
    return NextResponse.json({ refined: null, error: error.message }, { status: 500 });
  }
}
