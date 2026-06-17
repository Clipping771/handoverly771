import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { getAdelaideTodayStr } from '@/lib/taskUtils';

// Initialize Anthropic client (will fallback to mock if key is missing)
const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// Risk keywords
const RISK_KEYWORDS = ['fall', 'injury', 'refused medication', 'medication error', 'aggression', 'hospital transfer', 'rapid deterioration'];

export async function POST(request: Request) {
  try {
    const { residentId, rawInput, facilityId, staffId, shiftType, shiftDate, inputMethod } = await request.json();

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

    // Fetch pending/incomplete/carryover tasks for this resident
    const todayStr = getAdelaideTodayStr();
    const { data: pendingTasks } = await supabase
      .from('tasks')
      .select('title, description, assigned_role, tags, is_completed, carry_until_date')
      .eq('resident_id', residentId)
      .or(`is_completed.eq.false,carry_until_date.gte.${todayStr}`);

    const pendingTasksStr = pendingTasks && pendingTasks.length > 0
      ? pendingTasks.map(t => `- [${t.assigned_role.toUpperCase()}] ${t.title}: ${t.description} (Tags: ${t.tags?.join(', ') || 'none'})`).join('\n')
      : 'None';

    // Fetch recently declined/refused tasks in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: declinedEvents } = await supabase
      .from('activity_timeline')
      .select('description, created_at')
      .eq('resident_id', residentId)
      .eq('action_type', 'task_declined')
      .gte('created_at', oneDayAgo);

    const declinedTasksStr = declinedEvents && declinedEvents.length > 0
      ? declinedEvents.map(e => `- ${e.description} (at ${new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`).join('\n')
      : 'None';

    const currentAdelaideTime = new Date().toLocaleString("en-US", { 
      timeZone: "Australia/Adelaide",
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // System prompt
    const systemPrompt = `You are a clinical handover assistant for Australian residential aged care facilities. Your role is to convert informal nursing notes into two structured outputs.
    
CRITICAL TIME INSTRUCTION: The current date and time is ${currentAdelaideTime}.
When the informal notes mention relative times like "15 mins ago", "just now", or "earlier today", you MUST calculate and write the ABSOLUTE time (e.g. "at 09:45 PM" or "at 21:45"). NEVER write relative time phrases (like "15 minutes ago", "recently", or "today") in the ISBAR summary. This text will be read hours later, and relative times will become factually incorrect and dangerous for clinical care.

OUTPUT 1 — RN HANDOVER (ISBAR format):
I - Identify: Resident name, room number, age, care level
S - Situation: What is happening right now
B - Background: Relevant history, ongoing conditions
A - Assessment: Clinical interpretation
R - Recommendation: What the incoming RN should watch for or action
NOTE: If there are any "Recently Declined/Refused Tasks" listed in the user prompt, you MUST mention them in the Recommendation or Situation section so the incoming staff are flagged (e.g. noting that the resident refused a shower or medication).

OUTPUT 2 — SHIFT TASKS (Actionable task list):
Generate tasks for both Registered Nurses (clinical actions, medication, review) and Carers (hygiene, mobility, comfort).
NOTE: The "Incomplete Tasks Carrying Forward" are already tracked in the system. Do NOT include them in your "shift_tasks" output list. Only generate NEW tasks that arise from the new informal notes.
NOTE: If there are any "Recently Declined/Refused Tasks" listed in the user prompt, you MUST create a follow-up/retry task in the "shift_tasks" list to attempt the care activity again during this shift (especially for critical ADLs like showers, hygiene, medication, or fluid restriction).

RESIDENT ABSENCE & HOSPITAL TRANSFERS GUIDELINES:
- Carefully evaluate if the resident is currently absent from the facility (e.g. transferred to hospital, out on social leave) or if they have just returned.
- If the resident is currently in the hospital or absent:
  1. Do NOT schedule physical care tasks for the current shift (such as comfort checks, shower assistance, hygiene care, physical transfers, or nutrition monitoring) since the resident is not physically present to receive them. Carers should not have to mark these as completed.
  2. You may schedule coordinator tasks for RNs such as "Contact hospital for condition update".
  3. Do NOT schedule return-preparation tasks (e.g. "Implement fall prevention measures upon return") for the current shift if they have not returned yet. Only schedule them with a future carry_until_date or hold off entirely until the resident is actually back.
- If the resident has just returned/arrived back at the facility (e.g. the informal notes say "resident arrived", "resident returned", or "resident is back"):
  1. Do NOT carry forward any hospital-monitoring or absence-tracking tasks (such as "Monitor for Return from Hospital" or "Contact hospital for condition update") as they are now completed/no longer needed.
  2. Resume scheduling standard physical care tasks (hygiene, comfort checks, etc.) as the resident is now present.
- If a note mentions a visitor arriving to see the resident, understand the context: a visitor coming to see an absent resident does NOT mean the resident is back or needs care. Do not trigger physical care tasks based on visitor arrivals.

RISK FLAGS — Always check for:
fall | injury | refused medication | medication error | aggression | hospital transfer | rapid deterioration

Return ONLY valid JSON with this exact structure (no surrounding markdown, no backticks, no comments, just JSON):
{
  "risk_flag": "routine|attention|critical",
  "confidence_score": 0.95,
  "uncertainty_reason": "Provide reason if confidence is low, else null",
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
      "description": "action item description",
      "assigned_role": "rn|carer|all",
      "tags": ["incidents"|"medication"|"hygiene"|"mobility"|"nutrition"|"clinical_review"|"general"],
      "clinical_purpose": "brief explanation of why this task is needed for the resident's care outcome (e.g. To prevent dehydration or observe for pain cues)",
      "carry_until_date": "If the task description or title specifies that the task must be performed until/by/through/to a specific date, parse and set this to that date in YYYY-MM-DD format (e.g., '2026-06-15'). Otherwise, set to null."
    }
  ],
  "follow_up_questions": ["question 1", "question 2 (Only include if critical safety info is MISSING, max 2. Otherwise empty array.)"]
}

Use Australian English (e.g. behaviour, monitored, colour). Do not invent information not explicitly provided or strongly implied by the input notes.`;

    const userContent = `Resident Details:
Name: ${resident.name}
Room: ${resident.room_number}
Age: ${age}
Care Level: ${resident.care_level}

Incomplete Tasks Carrying Forward from Previous Shifts:
${pendingTasksStr}

Recently Declined/Refused Tasks (Last 24 Hours):
${declinedTasksStr}

Informal Notes:
"${rawInput}"`;

    let resultJson: any = null;
    let fallbackEngineUsed = false;
    let usedProvider = '';
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
        usedProvider = 'Anthropic Claude';
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
      const selectedModel = userKeys?.openrouterModel || process.env.OPENROUTER_MODEL || 'google/gemini-1.5-flash';
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
            usedProvider = 'OpenRouter';
            if (currentModel !== selectedModel) {
              fallbackEngineUsed = true;
              usedProvider = `OpenRouter (${currentModel})`;
            }
          } else {
            console.error(`OpenRouter response error (${currentModel}):`, data);
            lastError = new Error(data.error?.message || `OpenRouter error (${res.status})`);

            if (attempts === 1 && currentModel !== 'google/gemini-1.5-flash') {
              console.log('Switching to fallback model google/gemini-1.5-flash...');
              currentModel = 'google/gemini-1.5-flash';
              fallbackEngineUsed = true;
            } else {
              break;
            }
          }
        } catch (orErr: any) {
          console.error(`OpenRouter call failed (${currentModel}):`, orErr);
          lastError = orErr;

          if (attempts === 1 && currentModel !== 'google/gemini-1.5-flash') {
            console.log('Switching to fallback model google/gemini-1.5-flash...');
            currentModel = 'google/gemini-1.5-flash';
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
      fallbackEngineUsed = true;
      usedProvider = 'Mock Engine (Offline)';
    }

    // --- DETERMINISTIC SERVER DECISION ENGINE ---
    const lowerInput = rawInput.toLowerCase();
    const hasCriticalKeyword = RISK_KEYWORDS.some(k => lowerInput.includes(k));
    
    // In case AI completely failed or timed out, we fallback to our mock generator
    let finalJson = resultJson;
    if (!finalJson) {
       console.log('AI Generation failed entirely, falling back to deterministic safe mock.');
       finalJson = generateMockHandover(resident, age, rawInput);
       fallbackEngineUsed = true;
       usedProvider = 'Fail-Safe Deterministic Fallback';
    }

    // Determine Status
    let status = 'published';
    if (
      finalJson.risk_flag === 'critical' || 
      (finalJson.confidence_score && finalJson.confidence_score < 0.75) || 
      hasCriticalKeyword || 
      fallbackEngineUsed || 
      errors.length > 0
    ) {
      status = 'needs_review';
    }

    // --- WRITE DIRECTLY TO DATABASE (Service Role allows bypassing RLS for system operations, but we use it securely) ---
    // Actually, we can use the regular client if we want RLS, but the API doesn't have the user's JWT. 
    // We will use the service role key to insert, because it's a backend operation on behalf of the user.
    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Extract Risk Flags array based on the single flag mapping to align with schema requirements
    const riskFlags = [];
    if (finalJson.risk_flag === 'critical') riskFlags.push('critical');
    if (hasCriticalKeyword) riskFlags.push('keyword_override');

    const { data: dbHandover, error: dbError } = await supabaseAdmin.from('handovers').insert([{
      facility_id: facilityId,
      resident_id: residentId,
      submitted_by: staffId,
      raw_input: rawInput,
      rn_summary: finalJson.rn_summary,
      rn_summary_original: finalJson.rn_summary,
      carer_tasks: finalJson.carer_tasks || finalJson.shift_tasks || [],
      urgency: finalJson.risk_flag || 'routine',
      risk_flags: riskFlags,
      flags_status: riskFlags.length > 0 ? 'all_present' : 'none_detected',
      status: status,
      confidence_score: finalJson.confidence_score || 0.5,
      uncertainty_reason: finalJson.uncertainty_reason || null,
      shift_date: shiftDate || new Date().toISOString().split('T')[0],
      shift_type: shiftType || 'morning',
      input_method: inputMethod || 'text'
    }]).select('id').single();

    if (dbError) {
      console.error('Failed to write handover to DB:', dbError);
      throw new Error('Database write failed');
    }

    // If it was published immediately, we need to create tasks
    if (status === 'published' && finalJson.carer_tasks) {
      const taskInserts = (finalJson.carer_tasks || finalJson.shift_tasks).map((t: any) => ({
        resident_id: residentId,
        facility_id: facilityId,
        handover_id: dbHandover.id,
        title: t.title,
        description: t.description,
        assigned_role: t.assigned_role || 'carer',
        tags: t.tags || [],
        clinical_purpose: t.clinical_purpose,
        carry_until_date: t.carry_until_date
      }));
      if (taskInserts.length > 0) {
        await supabaseAdmin.from('tasks').insert(taskInserts);
      }
    }

    return NextResponse.json({ 
      success: true, 
      handoverId: dbHandover.id, 
      status,
      data: finalJson, 
      fallbackEngineUsed, 
      usedProvider 
    });
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
      tags: ['incidents', 'mobility'],
      clinical_purpose: 'To monitor cognitive status and ensure comfort post-fall.'
    });
    carerTasks.push({
      title: 'Transfer Support',
      description: 'Assist with transfers and ensure walking frame is always in reach.',
      tags: ['mobility'],
      clinical_purpose: 'To mitigate high risk of re-falling and support stability.'
    });
    carerTasks.push({
      title: 'Pain Report',
      description: 'Report any complaints of hip or back pain immediately to the RN.',
      tags: ['incidents'],
      clinical_purpose: 'To detect late-onset pain or internal injuries from the fall.'
    });
  } else if (detectedFlags.includes('refused medication')) {
    carerTasks.push({
      title: 'Pain Monitoring',
      description: 'Observe resident for any verbal or non-verbal signs of pain.',
      tags: ['general'],
      clinical_purpose: 'To identify signs of discomfort since the resident refused pain medication.'
    });
    carerTasks.push({
      title: 'Hydration & Mobility',
      description: 'Encourage oral fluids and report if resident is reluctant to move.',
      tags: ['nutrition', 'mobility'],
      clinical_purpose: 'To maintain fluid balance and monitor mobility deterioration.'
    });
  } else {
    carerTasks.push({
      title: 'Hygiene Assistance',
      description: 'Assist with routine hygiene and evening grooming care.',
      tags: ['hygiene'],
      clinical_purpose: 'To support personal hygiene and check skin integrity.'
    });
    carerTasks.push({
      title: 'Fluid Intake',
      description: 'Encourage fluids during dinner service.',
      tags: ['nutrition'],
      clinical_purpose: 'To ensure hydration standards are met.'
    });
    carerTasks.push({
      title: 'Safety Check',
      description: 'Ensure call bell is within easy reach before leaving room.',
      tags: ['general'],
      clinical_purpose: 'To ensure resident has access to assistance at all times.'
    });
  }

  return {
    risk_flag: urgency,
    confidence_score: 0.5,
    uncertainty_reason: "Generated by deterministic fallback engine due to API timeout or failure.",
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
