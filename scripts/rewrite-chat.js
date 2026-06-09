const fs = require('fs');

const content = `import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const { query, facilityId, userRole, userId } = await request.json();

    if (!query || !facilityId) {
      return NextResponse.json({ error: 'Query and Facility ID are required' }, { status: 400 });
    }

    const { data: facilityData, error: facilityError } = await supabase
      .from('facilities')
      .select('ai_config')
      .eq('id', facilityId)
      .single();

    if (facilityError) {
      return NextResponse.json({ error: 'Failed to fetch facility configuration' }, { status: 500 });
    }

    const aiConfig = facilityData?.ai_config || {};
    const provider = aiConfig.activeProvider || 'auto';
    const userKeys = aiConfig.keys || {};

    // 1. Fetch ALL handovers for the last 14 days for context (simple RAG)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    const { data: handovers } = await supabase
      .from('handovers')
      .select(\`
        shift_date, shift_type, urgency, risk_flags, rn_summary,
        resident:residents (name, room_number)
      \`)
      .eq('facility_id', facilityId)
      .gte('shift_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('shift_date', { ascending: false });

    // 2. Fetch Active Residents for the facility
    const { data: residents } = await supabase
      .from('residents')
      .select('id, name, room_number, care_level')
      .eq('facility_id', facilityId)
      .eq('is_active', true);

    let contextStr = 'No handovers found in the last 14 days.';
    if (handovers && handovers.length > 0) {
      contextStr = handovers.slice(0, 50).map((h: any) => 
        \`Resident: \${h.resident?.name} (Room \${h.resident?.room_number})
Date: \${h.shift_date} (\${h.shift_type})
Urgency: \${h.urgency}
Flags: \${h.risk_flags?.join(', ') || 'None'}
Summary: \${h.rn_summary?.situation || ''} \${h.rn_summary?.assessment || ''}\`
      ).join('\\n\\n---\\n\\n');
    }

    let residentsStr = 'No active residents.';
    if (residents && residents.length > 0) {
      residentsStr = residents.map((r: any) => 
        \`- \${r.name} (Room \${r.room_number}, ID: \${r.id})\`
      ).join('\\n');
    }

    const systemPrompt = \`You are an Action-Oriented AI Clinical Assistant for an aged care facility.
Staff will ask you questions about residents, and you can perform tasks on their behalf.

USER ROLE: \${userRole?.toUpperCase() || 'UNKNOWN'}
You must respect Role-Based Access Control (RBAC). 
- 'RN' and 'MANAGER' can perform all actions.
- 'CARER' has restricted access and cannot approve/create handovers.
If the user's role prohibits an action, politely refuse.

FACILITY RESIDENTS DIRECTORY (Live):
\${residentsStr}

RECENT HANDOVERS (Last 14 days):
\${contextStr}

ACTION PROTOCOL:
If the user explicitly asks you to perform an action (e.g. create a task, assign a reminder), you MUST output a JSON block wrapped in <action> tags at the very end of your response.

Example to create a task:
<action>
{
  "type": "CREATE_TASK",
  "resident_id": "uuid-from-directory",
  "title": "Short task title",
  "description": "Detailed task instructions"
}
</action>

Answer the user's query accurately based ONLY on the provided history. Be concise, professional, and directly address the question.\`;

    let answerStr: string | null = null;
    const targetProvider = provider || 'auto';
    const errors: string[] = [];

    // --- Provider Logic (Unchanged) ---
    const anthropicKey = userKeys?.anthropicKey || process.env.ANTHROPIC_API_KEY || '';
    if ((targetProvider === 'auto' || targetProvider === 'anthropic') && anthropicKey && !answerStr) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        const msg = await client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 500,
          temperature: 0.1,
          system: systemPrompt,
          messages: [{ role: 'user', content: query }],
        });
        answerStr = msg.content[0].type === 'text' ? msg.content[0].text : '';
      } catch (err: any) {
        if (targetProvider !== 'auto') throw err;
        errors.push(\`Anthropic failed: \${err.message || err}\`);
      }
    }

    const openrouterKey = userKeys?.openrouterKey || process.env.OPENROUTER_API_KEY || '';
    if ((targetProvider === 'auto' || targetProvider === 'openrouter') && openrouterKey && !answerStr) {
      try {
        const model = userKeys?.openrouterModel || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${openrouterKey}\`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Handoverly'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query }
            ],
            temperature: 0.1
          })
        });
        const data = await res.json();
        if (res.ok && data.choices && data.choices[0]) {
          answerStr = data.choices[0].message?.content || '';
        } else {
          throw new Error(data.error?.message || 'OpenRouter error');
        }
      } catch (err: any) {
        if (targetProvider !== 'auto') throw err;
        errors.push(\`OpenRouter failed: \${err.message || err}\`);
      }
    }

    const groqKey = userKeys?.groqKey || process.env.GROQ_API_KEY || '';
    if ((targetProvider === 'auto' || targetProvider === 'groq') && groqKey && !answerStr) {
      try {
        const model = userKeys?.groqModel || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${groqKey}\`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query }
            ],
            temperature: 0.1
          })
        });
        const data = await res.json();
        if (res.ok && data.choices && data.choices[0]) {
          answerStr = data.choices[0].message?.content || '';
        } else {
          throw new Error(data.error?.message || 'Groq error');
        }
      } catch (err: any) {
        if (targetProvider !== 'auto') throw err;
        errors.push(\`Groq failed: \${err.message || err}\`);
      }
    }

    const ollamaUrl = userKeys?.ollamaUrl || process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434';
    if ((targetProvider === 'auto' || targetProvider === 'ollama') && !answerStr) {
      try {
        const model = userKeys?.ollamaModel || process.env.OLLAMA_MODEL || 'llama3';
        const res = await fetch(\`\${ollamaUrl}/api/chat\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query }
            ],
            options: { temperature: 0.1 },
            stream: false
          })
        });
        const data = await res.json();
        if (res.ok && data.message) {
          answerStr = data.message.content || '';
        } else {
          throw new Error('Ollama failed to generate');
        }
      } catch (err: any) {
        if (targetProvider !== 'auto') throw err;
        errors.push(\`Ollama failed: \${err.message || err}\`);
      }
    }

    // Fallback Mock Answer if all failed
    if (!answerStr) {
      answerStr = \`Mock Engine: Based on the query "\${query}", I reviewed \${handovers?.length || 0} recent handovers. (Please configure an AI engine in Settings for real answers).\`;
    }

    // --- ACTION PARSING & EXECUTION ---
    let cleanAnswer = answerStr;
    const executedActions: any[] = [];
    const actionRegex = /<action>([\\s\\S]*?)<\\/action>/;
    const match = answerStr.match(actionRegex);

    if (match) {
      try {
        const actionPayload = JSON.parse(match[1].trim());
        
        // Execute the action in Supabase
        if (actionPayload.type === 'CREATE_TASK') {
          const { error } = await supabase.from('tasks').insert({
            facility_id: facilityId,
            resident_id: actionPayload.resident_id,
            title: actionPayload.title,
            description: actionPayload.description,
            is_completed: false
          });
          
          if (!error) {
            executedActions.push(actionPayload);
          } else {
            console.error('Task Action Error:', error);
          }
        }
        
        // Remove the <action> block from the final answer sent to user
        cleanAnswer = answerStr.replace(actionRegex, '').trim();
      } catch (e) {
        console.error('Failed to parse AI action:', e);
      }
    }

    return NextResponse.json({ 
      answer: cleanAnswer,
      executedActions
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;

fs.writeFileSync('src/app/api/chat/route.ts', content);
console.log('Updated src/app/api/chat/route.ts');
