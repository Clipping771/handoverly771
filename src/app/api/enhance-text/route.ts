import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ENHANCE_PROMPT = `You are an exceptionally advanced clinical documentation assistant for an Australian aged care facility.
Your goal is to take a very brief, informal, or fragmented note and rewrite/paraphrase it into a highly professional, clinical, precise, and extremely concise entry for a shift handover.

Rules:
1. Keep the rewrite extremely concise, direct, and to the point. Do NOT add unnecessary filler, boilerplate, or extra sentences. Ideally, return 1-2 short clinical sentences.
2. Incorporate the Resident's name where clinically appropriate (e.g., "Resident [Name] reported..." or "Assessed [Name]...").
3. Use the tagline/focus (if provided) as the clinical domain to guide the terminology, but do not write generic descriptions of that domain.
4. Correct speech-to-text or typing errors using clinical context.
5. Keep it objective, professional, and in third-person clinical language.
6. Do NOT hallucinate, invent, or assume any new medical symptoms, actions taken, or care outcomes. Only rewrite the exact facts provided in the raw note into professional clinical phrasing.
7. Preserve assignments and future tenses: If the note indicates that a specific role (e.g., 'RN', 'Carer') needs to perform an action (e.g., 'will do', 'to do'), keep it as an active/future task for that role. Do NOT rewrite future tasks as completed actions (e.g., do NOT rewrite 'RN to complete pain chart' into 'Pain chart completed' or 'Assessed pain').
8. Use Australian English spelling (e.g., behaviour, colour, mobilised).
9. Return ONLY the rewritten clinical description. No preamble, no quotes, no conversational filler.`;

export async function POST(request: Request) {
  try {
    const { text, tag, resident, otherTasks, userKeys, provider = 'auto' } = await request.json();

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

    // Build rich context prompt
    let contextPrompt = `${ENHANCE_PROMPT}\n\n`;
    if (resident) {
      contextPrompt += `RESIDENT CONTEXT:\n- Name: ${resident.name}\n- Room: ${resident.room_number}\n- Care Level: ${resident.care_level || 'Not Specified'}\n\n`;
    }
    if (tag) {
      contextPrompt += `TASK FOCUS/TAG: ${tag}\n\n`;
    }
    if (otherTasks && Array.isArray(otherTasks) && otherTasks.length > 0) {
      contextPrompt += `OTHER NOTES LOGGED IN THIS SESSION (for broader context):\n`;
      otherTasks.forEach((t: any, idx: number) => {
        contextPrompt += `- [${t.tag || 'General'}]: ${t.description || ''}\n`;
      });
      contextPrompt += `\n`;
    }
    contextPrompt += `Raw note to paraphrase/rewrite clinically:\n"${text}"`;

    let refined: string | null = null;

    // 1. Try Anthropic
    if ((provider === 'auto' || provider === 'anthropic') && anthropicKey && !refined) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        const msg = await client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          messages: [
            { role: 'user', content: contextPrompt }
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
              { role: 'user', content: contextPrompt }
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
              { role: 'user', content: contextPrompt }
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
            prompt: contextPrompt,
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
      const resName = resident?.name || 'Resident';
      const tagStr = tag ? `[${tag}] ` : '';
      refined = `[MOCK AI] Under the tagline of "${tag || 'General Care'}", resident ${resName} (Room ${resident?.room_number || 'N/A'}) was noted for the following: "${text}". Rewritten in clinical style: The resident required clinical attention for ${text.toLowerCase()}.`;
    }

    // 6. Final fallback: return original text if even mock is bypassed
    return NextResponse.json({ refined: refined || text, error: !refined ? 'No AI provider available' : null });

  } catch (error: any) {
    console.error('Enhance text error:', error);
    return NextResponse.json({ refined: null, error: error.message }, { status: 500 });
  }
}
