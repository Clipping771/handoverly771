import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';

// Initialize Anthropic client (will fallback to mock if key is missing)
const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// Risk keywords
const RISK_KEYWORDS = ['fall', 'injury', 'refused medication', 'medication error', 'aggression', 'hospital transfer', 'rapid deterioration'];

export async function POST(request: Request) {
  try {
    const { residentId, rawInput, facilityId } = await request.json();

    if (!residentId || !rawInput || !facilityId) {
      return NextResponse.json(
        { error: 'Resident ID, raw notes, and Facility ID are required' },
        { status: 400 }
      );
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



    // Fetch resident information for context
    const { data: resident, error: resError } = await supabase
      .from('residents')
      .select('name, room_number, care_level, dob')
      .eq('id', residentId)
      .single();

    if (resError || !resident) {
      return NextResponse.json(
        { error: 'Resident not found' },
        { status: 404 }
      );
    }

    const age = new Date().getFullYear() - new Date(resident.dob).getFullYear();

    // System prompt
    const systemPrompt = `You are a clinical handover assistant for Australian residential aged care facilities. Your role is to convert informal nursing notes into two structured outputs.
    
OUTPUT 1 — RN HANDOVER (ISBAR format):
I - Identify: Resident name, room number, age, care level
S - Situation: What is happening right now
B - Background: Relevant history, ongoing conditions
A - Assessment: Clinical interpretation
R - Recommendation: What the incoming RN should watch for or action

OUTPUT 2 — CARER HANDOVER (Plain English task list):
Simple numbered action list. No clinical jargon.

RISK FLAGS — Always check for:
fall | injury | refused medication | medication error | aggression | hospital transfer | rapid deterioration

Return ONLY valid JSON with this exact structure (no surrounding markdown, no backticks, no comments, just JSON):
{
  "urgency": "critical|attention|routine",
  "risk_flags": ["list any of the detected risk flags from the list above, or empty array"],
  "flags_status": "all_present|some_missing|none_detected",
  "rn_summary": {
    "identify": "Name, Room, Age, Care level",
    "situation": "current status details",
    "background": "history details",
    "assessment": "clinical evaluation details",
    "recommendation": "recommendations for next shift"
  },
  "carer_tasks": [
    {
      "title": "short concise tagline (e.g., Comfort Check, Vitals Monitoring)",
      "description": "action item description in plain language",
      "tags": ["incidents"|"medication"|"hygiene"|"mobility"|"nutrition"|"general"]
    }
  ],
  "follow_up_questions": ["question 1", "question 2 (Only include if critical safety info is MISSING, max 2. Otherwise empty array)"]
}

Use Australian English (e.g. behaviour, monitored, colour). Do not invent information not explicitly provided or strongly implied by the input notes.`;

    const userContent = `Resident Details:
Name: ${resident.name}
Room: ${resident.room_number}
Age: ${age}
Care Level: ${resident.care_level}

Informal Notes:
"${rawInput}"`;

    let resultJson: any = null;
    const targetProvider = provider || 'auto';
    const errors: string[] = [];

    // 1. Try Anthropic Claude
    const activeAnthropicKey = userKeys?.anthropicKey || process.env.ANTHROPIC_API_KEY || '';
    if ((targetProvider === 'auto' || targetProvider === 'anthropic') && activeAnthropicKey && !resultJson) {
      try {
        console.log("Trying Anthropic Claude...");
        const activeAnthropic = new Anthropic({ apiKey: activeAnthropicKey });
        const msg = await activeAnthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          temperature: 0.1,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        });

        const textContent = msg.content[0].type === 'text' ? msg.content[0].text : '';
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : textContent;
        resultJson = JSON.parse(jsonStr);
      } catch (apiErr: any) {
        console.error('Claude API call failed:', apiErr);
        if (targetProvider !== 'auto') {
          throw new Error(`Claude failed: ${apiErr.message || apiErr}`);
        } else {
          errors.push(`Claude failed: ${apiErr.message || apiErr}`);
        }
      }
    }

    // 2. Try OpenRouter
    const openrouterKey = userKeys?.openrouterKey || process.env.OPENROUTER_API_KEY || '';
    if ((targetProvider === 'auto' || targetProvider === 'openrouter') && openrouterKey && !resultJson) {
      const selectedModel = userKeys?.openrouterModel || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
      let currentModel = selectedModel;
      let attempts = 0;
      let lastError: any = null;

      while (attempts < 2 && !resultJson) {
        attempts++;
        try {
          console.log(`Trying OpenRouter with model ${currentModel} (Attempt ${attempts})...`);
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'Handoverly'
            },
            body: JSON.stringify({
              model: currentModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
              ],
              temperature: 0.1
            })
          });

          const data = await res.json();
          if (res.ok && data.choices && data.choices[0]) {
            const textContent = data.choices[0].message?.content || '';
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : textContent;
            resultJson = JSON.parse(jsonStr);
          } else {
            console.error(`OpenRouter response error (${currentModel}):`, data);
            lastError = new Error(data.error?.message || `OpenRouter error (${res.status})`);
            
            if (attempts === 1 && currentModel !== 'google/gemini-2.5-flash') {
              console.log('Switching to fallback model google/gemini-2.5-flash...');
              currentModel = 'google/gemini-2.5-flash';
            } else {
              break;
            }
          }
        } catch (orErr: any) {
          console.error(`OpenRouter call failed (${currentModel}):`, orErr);
          lastError = orErr;
          
          if (attempts === 1 && currentModel !== 'google/gemini-2.5-flash') {
            console.log('Switching to fallback model google/gemini-2.5-flash...');
            currentModel = 'google/gemini-2.5-flash';
          } else {
            break;
          }
        }
      }

      if (!resultJson && lastError) {
        if (targetProvider !== 'auto') {
          throw new Error(`OpenRouter failed: ${lastError.message || lastError}`);
        } else {
          errors.push(`OpenRouter failed: ${lastError.message || lastError}`);
        }
      }
    }

    // 3. Try Groq
    const groqKey = userKeys?.groqKey || process.env.GROQ_API_KEY || '';
    if ((targetProvider === 'auto' || targetProvider === 'groq') && groqKey && !resultJson) {
      try {
        console.log("Trying Groq...");
        const model = userKeys?.groqModel || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })
        });

        const data = await res.json();
        if (res.ok && data.choices && data.choices[0]) {
          const textContent = data.choices[0].message?.content || '';
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : textContent;
          resultJson = JSON.parse(jsonStr);
        } else {
          console.error('Groq response error:', data);
          const errMsg = data.error?.message || 'Groq error';
          if (targetProvider !== 'auto') {
            throw new Error(errMsg);
          } else {
            errors.push(`Groq failed: ${errMsg}`);
          }
        }
      } catch (groqErr: any) {
        console.error('Groq call failed:', groqErr);
        if (targetProvider !== 'auto') {
          throw groqErr;
        } else {
          errors.push(`Groq failed: ${groqErr.message || groqErr}`);
        }
      }
    }

    // 4. Try Ollama (Local)
    const ollamaUrl = userKeys?.ollamaUrl || process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434';
    if ((targetProvider === 'auto' || targetProvider === 'ollama') && !resultJson) {
      try {
        console.log("Trying local Ollama at:", ollamaUrl);
        const model = process.env.OLLAMA_MODEL || 'llama3';
        const res = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent }
            ],
            options: { ... { temperature: 0.1 } },
            stream: false,
            format: 'json'
          })
        });

        const data = await res.json();
        if (res.ok && data.message) {
          const textContent = data.message.content || '';
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : textContent;
          resultJson = JSON.parse(jsonStr);
        } else {
          if (targetProvider !== 'auto') throw new Error('Ollama failed to generate');
          errors.push('Ollama failed to generate');
        }
      } catch (ollamaErr: any) {
        console.log('Local Ollama connection failed/skipped.');
        if (targetProvider !== 'auto') {
          if (ollamaErr.message && ollamaErr.message.includes('fetch failed')) {
            throw new Error(`Could not connect to Ollama at ${ollamaUrl}. Please make sure the Ollama app is running on your machine.`);
          }
          throw ollamaErr;
        } else {
          errors.push(`Ollama failed: ${ollamaErr.message || ollamaErr}`);
        }
      }
    }

    // 5. Fallback to Mock AI Engine if all else failed
    if (!resultJson) {
      const hasConfiguredKeys = activeAnthropicKey || openrouterKey || groqKey || userKeys?.ollamaModel;
      
      if (hasConfiguredKeys && errors.length > 0) {
        throw new Error(errors.join(' | '));
      }

      if (targetProvider !== 'auto' && targetProvider !== 'mock') {
        throw new Error(`Select provider "${targetProvider}" failed and fallback was not allowed.`);
      }
      console.log("Using Mock fallback engine.");
      resultJson = generateMockHandover(resident, age, rawInput);
    }

    return NextResponse.json({ success: true, data: resultJson });
  } catch (err: any) {
    console.error('API Handover Generation error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process notes and generate handover' },
      { status: 500 }
    );
  }
}

// Mock Engine for robust pilot demonstrations and fallback
function generateMockHandover(resident: any, age: number, rawInput: string): any {
  const lowercaseInput = rawInput.toLowerCase();
  
  // Detect flags
  const detectedFlags: string[] = [];
  if (lowercaseInput.includes('fall') || lowercaseInput.includes('slip') || lowercaseInput.includes('dropped')) {
    detectedFlags.push('fall');
  }
  if (lowercaseInput.includes('refused') && (lowercaseInput.includes('med') || lowercaseInput.includes('panadol') || lowercaseInput.includes('tablet'))) {
    detectedFlags.push('refused medication');
  }
  if (lowercaseInput.includes('aggressive') || lowercaseInput.includes('hit') || lowercaseInput.includes('shout') || lowercaseInput.includes('aggression')) {
    detectedFlags.push('aggression');
  }
  if (lowercaseInput.includes('injury') || lowercaseInput.includes('wound') || lowercaseInput.includes('bruise') || lowercaseInput.includes('cut')) {
    detectedFlags.push('injury');
  }
  if (lowercaseInput.includes('deteriorat') || lowercaseInput.includes('worse') || lowercaseInput.includes('unwell')) {
    detectedFlags.push('rapid deterioration');
  }

  // Determine urgency
  let urgency = 'routine';
  if (detectedFlags.includes('fall') || detectedFlags.includes('rapid deterioration') || lowercaseInput.includes('hospital')) {
    urgency = 'critical';
  } else if (detectedFlags.length > 0 || lowercaseInput.includes('check') || lowercaseInput.includes('monitor')) {
    urgency = 'attention';
  }

  // Check missing critical info (e.g. if fall, did they do neuro observations? or did they check for injuries?)
  const followUp: string[] = [];
  if (detectedFlags.includes('fall') && !lowercaseInput.includes('neuro') && !lowercaseInput.includes('observations')) {
    followUp.push('Were neurological observations commenced for this fall?');
  }
  if (detectedFlags.includes('fall') && !lowercaseInput.includes('injury') && !lowercaseInput.includes('wound')) {
    followUp.push('Did the resident sustain any visible injuries or complain of pain?');
  }
  if (detectedFlags.includes('refused medication') && !lowercaseInput.includes('why') && !lowercaseInput.includes('reason')) {
    followUp.push('What reason did the resident give for refusing their medication?');
  }

  // Build ISBAR
  const identify = `${resident.name}, Room ${resident.room_number}, Age ${age}, Care Level: ${resident.care_level}`;
  
  let situation = 'Resident is stable and resting comfortably in their room.';
  if (detectedFlags.includes('fall')) {
    situation = `Resident had an unwitnessed slip/fall in the dining area. Checked by RN, currently resting in bed under monitoring.`;
  } else if (detectedFlags.includes('refused medication')) {
    situation = `Resident refused their scheduled evening medication dose. Rest of shift was uneventful.`;
  } else if (lowercaseInput.length > 10) {
    situation = rawInput.split('.')[0] + '.';
  }

  let background = 'Resident has a history of cognitive decline and mobility issues.';
  if (resident.care_level.toLowerCase() === 'dementia') {
    background = 'Resident has advanced dementia with associated sundowning and wanderer risks.';
  }

  let assessment = 'Vitals signs are within normal limits. Rest of shift observations remain stable.';
  if (detectedFlags.includes('fall')) {
    assessment = 'Initial assessment completed. Vitals are stable. Neurological checks started and normal so far. No obvious fractures detected.';
  } else if (detectedFlags.includes('refused medication')) {
    assessment = 'Resident refused scheduled evening medication (Panadol Osteo). Resident states they did not feel pain today. Monitored for pain cues.';
  }

  let recommendation = 'Continue routine checks and care plan.';
  if (detectedFlags.includes('fall')) {
    recommendation = 'Please continue neurological observations every 4 hours. Keep a close eye on mobility. Inform family of the incident if not already done.';
  } else if (detectedFlags.includes('refused medication')) {
    recommendation = 'Monitor pain status and offer Panadol Osteo again on the next shift if resident complains of discomfort.';
  }

  // Build Carer Tasks
  const carerTasks: any[] = [];
  if (detectedFlags.includes('fall')) {
    carerTasks.push({
      title: 'Comfort Checks',
      description: 'Provide regular 2-hourly comfort checks in room.',
      tags: ['incidents', 'mobility']
    });
    carerTasks.push({
      title: 'Transfer Support',
      description: 'Assist with transfers and ensure walking frame is always in reach.',
      tags: ['mobility']
    });
    carerTasks.push({
      title: 'Pain Report',
      description: 'Report any complaints of hip or back pain immediately to the RN.',
      tags: ['incidents']
    });
  } else if (detectedFlags.includes('refused medication')) {
    carerTasks.push({
      title: 'Pain Monitoring',
      description: 'Observe resident for any verbal or non-verbal signs of pain.',
      tags: ['general']
    });
    carerTasks.push({
      title: 'Hydration & Mobility',
      description: 'Encourage oral fluids and report if resident is reluctant to move.',
      tags: ['nutrition', 'mobility']
    });
  } else {
    carerTasks.push({
      title: 'Hygiene Assistance',
      description: 'Assist with routine hygiene and evening grooming care.',
      tags: ['hygiene']
    });
    carerTasks.push({
      title: 'Fluid Intake',
      description: 'Encourage fluids during dinner service.',
      tags: ['nutrition']
    });
    carerTasks.push({
      title: 'Safety Check',
      description: 'Ensure call bell is within easy reach before leaving room.',
      tags: ['general']
    });
  }

  return {
    urgency,
    risk_flags: detectedFlags,
    flags_status: detectedFlags.length > 0 ? (followUp.length > 0 ? 'some_missing' : 'all_present') : 'none_detected',
    rn_summary: {
      identify,
      situation,
      background,
      assessment,
      recommendation
    },
    carer_tasks: carerTasks,
    follow_up_questions: followUp
  };
}
