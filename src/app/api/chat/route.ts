import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { parseUntilDate, getAdelaideTodayStr } from '@/lib/taskUtils';

export async function POST(request: Request) {
  try {
    const { query, facilityId, userRole, userId, userKeys: clientUserKeys, chatHistory = [], image } = await request.json();

    if (!query || !facilityId) {
      return NextResponse.json({ error: 'Query and Facility ID are required' }, { status: 400 });
    }

    // Fetch Global Facility Config
    const { data: facilityConf } = await supabaseAdmin.from('facility_configurations').select('ai_config').eq('facility_id', facilityId).single();
    const aiConfig = facilityConf?.ai_config || {};
    const globalProvider = aiConfig.activeProvider || 'auto';
    
    // User preference overrides global, unless user is set to 'auto'
    let provider = clientUserKeys?.activeProvider && clientUserKeys.activeProvider !== 'auto' ? clientUserKeys.activeProvider : globalProvider;
    
    if (provider === 'smart_auto') provider = 'auto';
    const userKeys = { ...(aiConfig.keys || {}), ...(clientUserKeys || {}) };

    // Prepare full conversation messages payload
    const providerMessages = [
      ...chatHistory,
      { role: 'user', content: query }
    ];

    // 1. Fetch ALL handovers for the last 14 days for context (simple RAG)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: handovers } = await supabase
      .from('handovers')
      .select(`
        shift_date, shift_type, urgency, risk_flags, rn_summary, carer_tasks, raw_input,
        resident:residents(name, room_number, is_active)
      `)
      .eq('facility_id', facilityId)
      .gte('shift_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('shift_date', { ascending: false });

    const filteredHandovers = (handovers || []).filter((h: any) => h.resident?.is_active !== false);

    // 2. Fetch ALL Residents for the facility (Active and Archived)
    const { data: residents } = await supabase
      .from('residents')
      .select('id, name, room_number, care_level, dob, wing_id, is_active, status_reason, wings(name)')
      .eq('facility_id', facilityId);

    // 2.5 Fetch Available Wings
    const { data: wings } = await supabase
      .from('wings')
      .select('id, name')
      .eq('facility_id', facilityId);

    // 3. Fetch Active/Pending Tasks
    const todayStr = getAdelaideTodayStr();
    const { data: activeTasks } = await supabase
      .from('tasks')
      .select('title, description, assigned_role, resident_id, is_completed, carry_until_date')
      .eq('facility_id', facilityId)
      .or(`is_completed.eq.false,carry_until_date.gte.${todayStr}`);

    // 4. Fetch Recent Activity Logs (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: timeline } = await supabase
      .from('activity_timeline')
      .select('action_type, description, created_at, resident_id')
      .eq('facility_id', facilityId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    let contextStr = 'No handovers found in the last 14 days.';
    if (handovers && handovers.length > 0) {
      contextStr = handovers.slice(0, 50).map((h: any) => {
        const tasksStr = h.carer_tasks && h.carer_tasks.length > 0
          ? h.carer_tasks.map((t: any) => `- [Assigned Role: ${t.assigned_role || 'carer'}]: ${t.title || t} (${t.description || ''})`).join('\n')
          : 'None';
        const rnSum = h.rn_summary || {};
        const isbar = `Identify: ${rnSum.identify || ''}\nSituation: ${rnSum.situation || ''}\nBackground: ${rnSum.background || ''}\nAssessment: ${rnSum.assessment || ''}\nRecommendation: ${rnSum.recommendation || ''}`;
        
        return `Resident: ${h.resident?.name} (Room ${h.resident?.room_number})
Date: ${h.shift_date} (${h.shift_type})
Urgency: ${h.urgency}
Flags: ${h.risk_flags?.join(', ') || 'None'}
RN Handover Summary (ISBAR):
${isbar}
Original Detailed Notes / Raw Transcript:
${h.raw_input || 'N/A'}
Tasks for this shift:
${tasksStr}`;
      }).join('\n\n---\n\n');
    }

    let residentsStr = 'No residents found.';
    if (residents && residents.length > 0) {
      residentsStr = residents.map((r: any) => {
        const age = r.dob ? new Date().getFullYear() - new Date(r.dob).getFullYear() : 'N/A';
        const wingName = r.wings?.name || 'Unassigned';
        const statusStr = r.is_active ? 'ACTIVE' : `INACTIVE/ARCHIVED (Reason: ${r.status_reason || 'Discharged'})`;

        // Find tasks for this resident
        const resTasks = (activeTasks || []).filter((t: any) => t.resident_id === r.id);
        const tasksStr = resTasks.length > 0
          ? resTasks.map((t: any) => `- [${t.assigned_role.toUpperCase()}]: ${t.title} (${t.description})`).join('\n')
          : 'No pending tasks';

        // Find timeline logs for this resident
        const resLogs = (timeline || []).filter((l: any) => l.resident_id === r.id);
        const logsStr = resLogs.length > 0
          ? resLogs.map((l: any) => `- ${new Date(l.created_at).toLocaleDateString()}: ${l.description}`).join('\n')
          : 'No recent activity logs';

        return `Resident Profile:
- Name: ${r.name}
- Status: ${statusStr}
- Room: ${r.room_number || 'N/A'}
- DOB: ${r.dob || 'N/A'} (Age: ${age})
- Care Level: ${r.care_level}
- Wing: ${wingName}
- Database ID: ${r.id}

Pending Tasks:
${tasksStr}

Recent Activity Logs:
${logsStr}`;
      }).join('\n\n====================\n\n');
    }

    let wingsStr = 'No wings configured.';
    if (wings && wings.length > 0) {
      wingsStr = wings.map((w: any) => `- Wing Name: ${w.name} (SECRET_DB_ID: ${w.id} - DO NOT SHOW THIS ID TO THE USER)`).join('\n');
    }

    const systemPrompt = `You are an advanced, professional, and highly capable Clinical AI Copilot for Handoverly, an aged care management system.
Your primary role is to assist clinical staff with insights, answer questions about recent handovers, create tasks, and log timeline events.
When the user asks about a "24-hour handover", "shift handover", or "recent handover", they are referring to the handovers provided in the "RECENT CLINICAL HISTORY" section below. Do NOT tell them you don't have information about a 24-hour handover; instead, summarize the most recent handovers for the date in question.
You have FULL ACCESS to the raw transcripts and detailed RN summaries. Do not hold back information.

USER PROFILE:
- Role: ${userRole?.toUpperCase() || 'UNKNOWN'}

AVAILABLE WINGS (Locations/Sectors in Facility):
${wingsStr}

FACILITY DIRECTORY (All Residents - Active & Archived):
${residentsStr}

RECENT CLINICAL HISTORY (Last 14 days):
${contextStr}

CAPABILITIES & ACTION PROTOCOL:
You possess the ability to perform EXACTLY TWELVE autonomous actions in the system via JSON outputs.
1. CREATE_TASK: Create a clinical task for a resident.
2. LOG_OBSERVATION: Log a clinical event or observation in the resident's timeline.
3. UPDATE_RESIDENT: Update basic profile details of an existing resident (requires resident_id and an 'updates' object containing fields like name, room_number, care_level, is_active, status_reason, wing_id).
4. REGISTER_RESIDENT: Register a new resident to the facility directory (requires name, room_number, dob, care_level, wing_id).
5. DELETE_RESIDENT: Permanently remove a resident profile from the system (requires resident_id).
6. ADD_MEDICATION: Add a new medication to a resident's active profile (requires resident_id, medication_name, dosage, frequency, route).
7. REMOVE_MEDICATION: Discontinue or remove a medication from a resident's profile (requires resident_id and medication_name).
8. RECONCILE_MEDICATION: Mark a resident's medication as verified and reconciled (requires resident_id and medication_name).
9. CHANGE_THEME: Switch the application's UI theme (theme can be "light" or "dark").
10. NAVIGATE_TO: Redirect the user to a specific page URL (e.g. /shift, /resident/[uuid], /tasks).
11. UPDATE_API_KEY: Save or update the user's API key for an AI provider (requires 'provider' which must be anthropic, openrouter, or groq, and 'key').
12. DELETE_ALL_RESIDENTS: Permanently remove ALL resident profiles from the facility. Use with extreme caution.

IMPORTANT NOTIFICATION: Before executing ANY destructive or modifying action (UPDATE_RESIDENT, REGISTER_RESIDENT, DELETE_RESIDENT, DELETE_ALL_RESIDENTS, ADD_MEDICATION, REMOVE_MEDICATION, RECONCILE_MEDICATION), you MUST output a JSON block wrapped in <confirm_action> tags INSTEAD of <action> tags. Do NOT ask the user to type "yes" or "do it". Just output the <confirm_action> block at the VERY END of your response and the UI will present a confirmation button to the user automatically. 

CRITICAL PROTOCOL: YOU ARE NEVER ALLOWED TO USE <action> FOR UPDATE_RESIDENT, REGISTER_RESIDENT, DELETE_RESIDENT, DELETE_ALL_RESIDENTS, ADD_MEDICATION, REMOVE_MEDICATION, OR RECONCILE_MEDICATION. IF YOU USE <action> FOR THESE, THE SYSTEM WILL FAIL. YOU MUST EXCLUSIVELY USE <confirm_action>.

For all other non-destructive actions (CREATE_TASK, LOG_OBSERVATION, CHANGE_THEME, NAVIGATE_TO, UPDATE_API_KEY), use standard <action> tags at the VERY END of your response.

Example to register resident:
<confirm_action>
{
  "type": "REGISTER_RESIDENT",
  "name": "Jane Doe",
  "room_number": "12B",
  "dob": "1950-01-01",
  "care_level": "High"
}
</confirm_action>

Example to add medication:
<confirm_action>
{
  "type": "ADD_MEDICATION",
  "resident_id": "uuid",
  "medication_name": "Paracetamol",
  "dosage": "500mg",
  "frequency": "Twice daily",
  "route": "Oral"
}
</confirm_action>

Example to remove medication:
<confirm_action>
{
  "type": "REMOVE_MEDICATION",
  "resident_id": "uuid",
  "medication_name": "Paracetamol"
}
</confirm_action>

Example to reconcile medication:
<confirm_action>
{
  "type": "RECONCILE_MEDICATION",
  "resident_id": "uuid",
  "medication_name": "Paracetamol"
}
</confirm_action>

Example to update resident:
<confirm_action>
{
  "type": "UPDATE_RESIDENT",
  "resident_id": "uuid",
  "updates": {
    "name": "Robert Michel",
    "care_level": "Medium"
  }
}
</confirm_action>

Example to change theme:
<action>
{
  "type": "CHANGE_THEME",
  "theme": "dark"
}
</action>

CRITICAL BOUNDARIES & LIMITATIONS:
1. You NOW HAVE the capability to register and delete Resident Profiles via explicit actions.
2. If a user asks about a resident who is NOT in your "FACILITY DIRECTORY", inform them that the resident is not active and offer to REGISTER them for the user.
3. CONTEXT AWARENESS & MISSING INFO: If the user asks you to perform an action (e.g., Register Resident, Add Medication, Create Task) but DOES NOT provide all the required details (e.g., name, room number, medication name), you MUST NOT output the JSON action block. Instead, you MUST ask the user to provide the missing details first. DO NOT invent or hallucinate names like "Jane Doe".
4. Respect Role-Based Access Control (RBAC). 'RN' and 'MANAGER' can perform all actions. 'CARER' cannot approve handovers.

COGNITIVE & BEHAVIORAL PROTOCOL (HUMAN-LIKE AGENCY):
1. PROACTIVE RESPONSIBILITY: Do not just wait for commands. Anticipate clinical needs. If you see a high-risk handover or overdue tasks, proactively suggest interventions or ask if the staff needs help addressing them.
2. SELF-CORRECTION & REASONING: If a user's request contradicts clinical best practices or lacks critical information, gracefully push back, explain your reasoning, and ask for clarification. Own your mistakes; if you misunderstand a query, apologize and correct your course immediately.
3. HOLISTIC DECISION MAKING: Connect the dots across the timeline. If a user asks to add a medication, check recent observations (e.g., if adding a blood pressure med, mention the last recorded BP from the timeline). 
4. RESIDENT REGISTRATION/UPDATE: If the user asks to register or update a resident but does not specify a Wing (location), you MUST ask them which Wing the resident belongs to. When listing the 'AVAILABLE WINGS', ONLY show the names (e.g. "Appleton" or "North Wing") and ABSOLUTELY NEVER expose the SECRET_DB_ID strings to the user. Format your question as a clean, simple bulleted list with ONLY the wing names. If they specify a location name that matches an available wing, map it to the correct 'wing_id' in your JSON action.
5. SENSE OF URGENCY: Prioritize tasks and handovers flagged with 'High' urgency. Treat the clinical data as real, critical health information where human lives are involved. Be highly professional, empathetic, and exceptionally sharp.

RESPONSE GUIDELINES:
- MULTILINGUAL & NATIVE FLUENCY: You MUST reply in the exact language, dialect, and script the user uses.
  - CRITICAL FOR BENGALI/BANGLISH: NEVER use highly formal, robotic, or literal bookish Bengali (e.g. do not translate "Incident" to "ইনসিডেন্ট" or "Resident" to "রিজিডেন্ট" in pure script if it sounds unnatural). Instead, speak colloquially, warmly, and naturally, just like a real person from Bangladesh would speak. It is highly encouraged to use English clinical terms natively within the Bengali/Banglish sentences (e.g., "Resident-এর incident report", "Fall risk", "Handover") rather than translating them into awkward Bengali script. If the user writes in English script (Banglish), you MUST reply in Banglish. 
- DEEP EMPATHY & INTELLIGENCE: Be exceptionally brainy, clever, and highly responsive. Read between the lines to truly understand what the user needs. Make the user feel deeply understood and supported. Do not be a generic robot; inject warm personality and deep clinical wisdom into your responses.
- Be highly professional, clever, and concise. Speak like a senior clinical coordinator. Do not use repetitive phrasing.
- GRAPHS AND CHARTS: If the user asks for a visual graph or chart, you MUST use Mermaid.js markdown code blocks. You are ONLY allowed to use 'pie' charts, 'graph TD' (flowcharts), or 'xychart-beta' (for bar charts). 
  - For bar charts, you MUST start exactly with 'xychart-beta' (not 'bar'). Example:
    xychart-beta
    title "Title"
    x-axis ["A", "B"]
    bar [10, 20]
  - CRITICAL FOR BAR CHARTS: The 'bar' array MUST contain strictly numeric values (e.g., 38.2, 140). You CANNOT use strings, fractions, or slashes like "140/90" or 140/90. If plotting Blood Pressure, either plot only the Systolic value (e.g., 140) and explain it in text, or use a markdown table instead of a graph.
  - CRITICAL: Use standard ASCII characters ONLY (e.g., '-->' for arrows). DO NOT use unicode characters like '──>' or '▷'.
- If you generate a table, you MUST use proper markdown format with explicit NEWLINES separating every single row, and you MUST include a delimiter row immediately after the headers (e.g. '|---|---|---|').
- Do NOT expose database UUIDs in your conversational text. Use them strictly in <action> blocks.
- Provide actionable clinical value, connecting the dots between recent handovers and pending tasks where relevant.`;

    let answerStr: string | null = null;
    const targetProvider = provider || 'auto';
    const errors: string[] = [];

    // --- Direct Action Execution Bypass ---
    if (query.trim().startsWith('<execute_action>') && query.trim().endsWith('</execute_action>')) {
      // The frontend is sending a confirmed action directly. Bypass the LLM.
      answerStr = query.trim().replace('<execute_action>', '<action>').replace('</execute_action>', '</action>');
      // Prepend a success message that will be shown to the user
      answerStr = "Action executed successfully.\n\n" + answerStr;
    }

    // --- Provider Logic ---
    const anthropicKey = userKeys?.anthropicKey || process.env.ANTHROPIC_API_KEY || '';
    if ((targetProvider === 'auto' || targetProvider === 'anthropic') && anthropicKey && !answerStr) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        // Format for Anthropic Vision
        let anthropicMessages = [...providerMessages];
        if (image) {
          const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            anthropicMessages[anthropicMessages.length - 1] = {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } },
                { type: 'text', text: query }
              ]
            };
          }
        }

        const msg = await client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 2000,
          temperature: 0.1,
          system: systemPrompt,
          messages: anthropicMessages,
        });
        answerStr = msg.content[0].type === 'text' ? msg.content[0].text : '';
      } catch (err: any) {
        if (targetProvider !== 'auto') throw err;
        errors.push(`Anthropic failed: ${err.message || err}`);
      }
    }

    const openrouterKey = userKeys?.openrouterKey || process.env.OPENROUTER_API_KEY || '';
    if ((targetProvider === 'auto' || targetProvider === 'openrouter') && openrouterKey && !answerStr) {
      try {
        const model = userKeys?.openrouterModel || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
        // Format for OpenRouter/OpenAI Vision
        let openRouterMessages = [...providerMessages];
        if (image) {
          openRouterMessages[openRouterMessages.length - 1] = {
            role: 'user',
            content: [
              { type: 'text', text: query },
              { type: 'image_url', image_url: { url: image } }
            ]
          };
        }

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Handoverly'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...openRouterMessages
            ],
            temperature: 0.1
          })
        });
        const data = await res.json();
        if (res.ok && data.choices && data.choices[0]) {
          answerStr = data.choices[0].message?.content || '';
        } else {
          console.error("OpenRouter Error Data:", JSON.stringify(data, null, 2));
          let errorMsg = data.error?.message || 'OpenRouter error';
          if (errorMsg === 'Provider returned error' && data.error?.metadata?.raw) {
            try {
              const rawObj = JSON.parse(data.error.metadata.raw);
              if (rawObj.error?.message) {
                errorMsg = `Upstream AI Error: ${rawObj.error.message}`;
              }
            } catch (e) {}
          }
          if (image && errorMsg.toLowerCase().includes('provider')) {
            errorMsg = `Vision Error: The selected OpenRouter model may not support images. (${errorMsg})`;
          }
          throw new Error(errorMsg);
        }
      } catch (err: any) {
        if (targetProvider !== 'auto') throw err;
        errors.push(`OpenRouter failed: ${err.message || err}`);
      }
    }

    const groqKey = userKeys?.groqKey || process.env.GROQ_API_KEY || '';
    if ((targetProvider === 'auto' || targetProvider === 'groq') && groqKey && !answerStr) {
      try {
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
              ...providerMessages
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
        errors.push(`Groq failed: ${err.message || err}`);
      }
    }

    const ollamaUrl = userKeys?.ollamaUrl || process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434';
    if ((targetProvider === 'auto' || targetProvider === 'ollama') && !answerStr) {
      try {
        const model = userKeys?.ollamaModel || process.env.OLLAMA_MODEL || 'llama3';
        // Format for Ollama Vision
        let ollamaMessages = [...providerMessages];
        if (image) {
          const match = image.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
          if (match) {
            ollamaMessages[ollamaMessages.length - 1] = {
              role: 'user',
              content: query,
              images: [match[1]]
            };
          }
        }

        const res = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...ollamaMessages
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
        errors.push(`Ollama failed: ${err.message || err}`);
      }
    }

    // Fallback Mock Answer if all failed
    if (!answerStr) {
      answerStr = `Mock Engine: Based on the query "${query}", I reviewed ${handovers?.length || 0} recent handovers. (Please configure an AI engine in Settings for real answers). Errors: ${errors.join(' | ')}`;
    }

    // --- ACTION PARSING & EXECUTION ---
    let cleanAnswer = answerStr;
    const executedActions: any[] = [];
    const actionRegex = /<action>([\s\S]*?)<\/action>/g;
    
    // Find all matches
    const matches = Array.from(answerStr.matchAll(actionRegex));
    
    for (const match of matches) {
      try {
        let rawJson = match[1].replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          rawJson = jsonMatch[0];
        }
        const actionPayload = JSON.parse(rawJson);

        // Execute the action in Supabase
        if (actionPayload.type === 'CREATE_TASK') {
          const carryUntil = parseUntilDate(actionPayload.description) || parseUntilDate(actionPayload.title);
          const { error } = await supabaseAdmin.from('tasks').insert({
            facility_id: facilityId,
            resident_id: actionPayload.resident_id,
            title: actionPayload.title,
            description: actionPayload.description,
            is_completed: false,
            carry_until_date: carryUntil
          });

          if (!error) {
            executedActions.push(actionPayload);
          } else {
            console.error('Task Action Error:', error);
          }
        } else if (actionPayload.type === 'LOG_OBSERVATION') {
          const { error } = await supabaseAdmin.from('activity_timeline').insert({
            facility_id: facilityId,
            resident_id: actionPayload.resident_id,
            staff_id: userId,
            action_type: actionPayload.action_type || 'clinical_observation',
            description: actionPayload.description || actionPayload.notes || actionPayload.content || 'Clinical Observation Logged',
            metadata: actionPayload.metadata || {}
          });

          if (!error) {
            executedActions.push(actionPayload);
          } else {
            console.error('Observation Action Error:', error);
          }
        } else if (actionPayload.type === 'UPDATE_RESIDENT') {
          // Graceful fallback if AI forgot the 'updates' wrapper object
          const updates = actionPayload.updates || {};
          if (!actionPayload.updates) {
            if (actionPayload.name) updates.name = actionPayload.name;
            if (actionPayload.room_number) updates.room_number = actionPayload.room_number;
            if (actionPayload.care_level) updates.care_level = actionPayload.care_level;
            if (actionPayload.is_active !== undefined) updates.is_active = actionPayload.is_active;
            if (actionPayload.status_reason) updates.status_reason = actionPayload.status_reason;
            if (actionPayload.wing_id) updates.wing_id = actionPayload.wing_id;
          }

          const { error } = await supabaseAdmin
            .from('residents')
            .update(updates)
            .eq('id', actionPayload.resident_id)
            .eq('facility_id', facilityId);

          if (!error) {
            executedActions.push(actionPayload);
            await supabaseAdmin.from('activity_timeline').insert({
              facility_id: facilityId,
              resident_id: actionPayload.resident_id,
              staff_id: userId,
              action_type: 'profile_update',
              description: `Resident profile updated by AI Assistant on behalf of staff.`
            });
          } else {
            console.error('Update Resident Action Error:', error);
            answerStr = answerStr.replace('Action executed successfully.', `Failed to execute action: ${error.message}`);
          }
        } else if (actionPayload.type === 'REGISTER_RESIDENT') {
          const { error } = await supabaseAdmin.from('residents').insert([{
            facility_id: facilityId,
            name: actionPayload.name,
            room_number: actionPayload.room_number,
            dob: actionPayload.dob,
            care_level: actionPayload.care_level || 'High',
            wing_id: actionPayload.wing_id || null
          }]);
          if (!error) executedActions.push(actionPayload);
          else {
            console.error('Register Resident Action Error:', error);
            answerStr = answerStr.replace('Action executed successfully.', `Failed to execute action: ${error.message}`);
          }
        } else if (actionPayload.type === 'DELETE_RESIDENT') {
          const { error } = await supabaseAdmin.from('residents').delete().eq('id', actionPayload.resident_id).eq('facility_id', facilityId);
          if (!error) executedActions.push(actionPayload);
          else {
            console.error('Delete Resident Action Error:', error);
            answerStr = answerStr.replace('Action executed successfully.', `Failed to execute action: ${error.message}`);
          }
        } else if (actionPayload.type === 'DELETE_ALL_RESIDENTS') {
          const { error } = await supabaseAdmin.from('residents').delete().eq('facility_id', facilityId);
          if (!error) executedActions.push(actionPayload);
          else {
            console.error('Delete All Residents Action Error:', error);
            answerStr = answerStr.replace('Action executed successfully.', `Failed to execute action: ${error.message}`);
          }
        } else if (actionPayload.type === 'ADD_MEDICATION') {
          const { error } = await supabaseAdmin.from('medication_profiles').insert([{
            resident_id: actionPayload.resident_id,
            medication_name: actionPayload.medication_name,
            dosage: actionPayload.dosage,
            frequency: actionPayload.frequency,
            route: actionPayload.route || 'Oral',
            status: 'active'
          }]);
          if (!error) executedActions.push(actionPayload);
          else {
            console.error('Add Medication Action Error:', error);
            answerStr = answerStr.replace('Action executed successfully.', `Failed to execute action: ${error.message}`);
          }
        } else if (actionPayload.type === 'REMOVE_MEDICATION') {
          const { error } = await supabaseAdmin.from('medication_profiles')
            .delete()
            .eq('resident_id', actionPayload.resident_id)
            .ilike('medication_name', actionPayload.medication_name);
          if (!error) executedActions.push(actionPayload);
          else {
            console.error('Remove Medication Action Error:', error);
            answerStr = answerStr.replace('Action executed successfully.', `Failed to execute action: ${error.message}`);
          }
        } else if (actionPayload.type === 'RECONCILE_MEDICATION') {
          const { error } = await supabaseAdmin.from('medication_profiles')
            .update({
              last_reconciled_at: new Date().toISOString(),
              last_reconciled_by: userId
            })
            .eq('resident_id', actionPayload.resident_id)
            .ilike('medication_name', actionPayload.medication_name);
          if (!error) executedActions.push(actionPayload);
          else {
            console.error('Reconcile Medication Action Error:', error);
            answerStr = answerStr.replace('Action executed successfully.', `Failed to execute action: ${error.message}`);
          }
        } else if (actionPayload.type === 'CHANGE_THEME' || actionPayload.type === 'NAVIGATE_TO' || actionPayload.type === 'UPDATE_API_KEY') {
          // Client-side actions, just pass them back to the frontend
          executedActions.push(actionPayload);
        }
      } catch (e) {
        console.error('Failed to parse AI action:', e);
      }
    }
    
    // Remove all <action> blocks from the final answer sent to user
    if (matches.length > 0) {
      cleanAnswer = answerStr.replace(/<action>[\s\S]*?<\/action>/g, '').trim();
    }
    
    // Parse <confirm_action> blocks
    let pendingAction = null;
    const confirmRegex = /<confirm_action>([\s\S]*?)<\/confirm_action>/g;
    const confirmMatches = Array.from(cleanAnswer.matchAll(confirmRegex));
    if (confirmMatches.length > 0) {
      try {
        let rawJson = confirmMatches[0][1].replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          rawJson = jsonMatch[0];
        }
        pendingAction = JSON.parse(rawJson);
        cleanAnswer = cleanAnswer.replace(/<confirm_action>[\s\S]*?<\/confirm_action>/g, '').trim();
      } catch (e) {
        console.error('Failed to parse confirm_action JSON:', e, confirmMatches[0][1]);
        cleanAnswer = "⚠️ The AI attempted to perform an action but failed to generate valid parameters. Please try again.";
      }
    }

    return NextResponse.json({
      answer: cleanAnswer,
      executedActions,
      pendingAction
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
