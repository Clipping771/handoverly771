import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const { residentId, userKeys, forceRefresh } = await request.json();

    if (!residentId) {
      return NextResponse.json({ error: 'Resident ID is required' }, { status: 400 });
    }

    // Fetch resident information
    const { data: resident, error: resError } = await supabase
      .from('residents')
      .select('name, room_number, care_level, dob, facility_id, wing_id, wing:wings(name)')
      .eq('id', residentId)
      .single();

    if (resError || !resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
    }

    // 1. Check database cache first if not forcing refresh
    if (!forceRefresh) {
      const { data: cachedInsight } = await supabase
        .from('resident_insights')
        .select('insights, updated_at')
        .eq('resident_id', residentId)
        .single();

      if (cachedInsight) {
        const updatedAt = new Date(cachedInsight.updated_at).getTime();
        // Valid for 3 minutes
        if (Date.now() - updatedAt < 3 * 60 * 1000) {
          return NextResponse.json(cachedInsight.insights);
        }
      }
    }

    // Fetch recent handovers, timeline logs, and tasks (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString();
    
    const { data: handovers, error: handError } = await supabase
      .from('handovers')
      .select('shift_date, shift_type, urgency, risk_flags, rn_summary')
      .eq('resident_id', residentId)
      .gte('shift_date', fourteenDaysAgoStr.split('T')[0])
      .order('shift_date', { ascending: false });

    if (handError) {
      return NextResponse.json({ error: 'Failed to fetch handovers' }, { status: 500 });
    }

    const { data: timeline } = await supabase
      .from('activity_timeline')
      .select('action_type, description, created_at')
      .eq('resident_id', residentId)
      .gte('created_at', fourteenDaysAgoStr)
      .order('created_at', { ascending: false });

    const { data: tasks } = await supabase
      .from('tasks')
      .select('title, description, is_completed, outcome, created_at')
      .eq('resident_id', residentId)
      .gte('created_at', fourteenDaysAgoStr)
      .order('created_at', { ascending: false });

    const saveAndReturn = async (insightsData: any) => {
      if (!insightsData.proactive_alerts) {
        insightsData.proactive_alerts = [];
      }

      // Fetch facility config for feature flags
      const { data: facData } = await supabase
        .from('facilities')
        .select('ai_config')
        .eq('id', resident.facility_id)
        .single();

      const aiConfig = facData?.ai_config || {};
      const featureFlags = aiConfig.featureFlags || {};

      if (featureFlags.chronicleEnabled !== false && resident.wing_id) {
        // Fetch active residents in this facility to map room & wing info
        const { data: allResidents } = await supabase
          .from('residents')
          .select('id, name, room_number, wing_id, wing:wings(name)')
          .eq('facility_id', resident.facility_id)
          .eq('is_active', true);

        if (allResidents) {
          const residentMap = new Map();
          allResidents.forEach((r: any) => {
            const wObj = Array.isArray(r.wing) ? r.wing[0] : r.wing;
            residentMap.set(r.id, {
              name: r.name,
              room: r.room_number,
              wingId: r.wing_id,
              wingName: wObj?.name || 'Unknown Wing'
            });
          });

          // Fetch handovers and timeline logs from the last 48 hours
          const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
          const [handoversRes, timelineRes] = await Promise.all([
            supabase
              .from('handovers')
              .select('resident_id, raw_input, rn_summary, created_at')
              .eq('facility_id', resident.facility_id)
              .gte('created_at', fortyEightHoursAgo),
            supabase
              .from('activity_timeline')
              .select('resident_id, description, created_at')
              .eq('facility_id', resident.facility_id)
              .gte('created_at', fortyEightHoursAgo)
          ]);

          const handoversList = handoversRes.data || [];
          const timelineList = timelineRes.data || [];

          // Extract symptoms
          const detections: any[] = [];
          const SYMPTOM_MAPPING: Record<string, string[]> = {
            "gastrointestinal": [
              "runny tummy", "loose bowel", "stomach upset", "vomiting", "nausea",
              "diarrhea", "diarrhoea", "watery stool", "watery stools", "cramps",
              "stomach ache", "gastro", "loose stool", "loose stools", "upset stomach",
              "bowel change", "abdominal pain", "watery bowel"
            ],
            "respiratory": [
              "cough", "coughing", "runny nose", "sore throat", "sneezing",
              "congestion", "shortness of breath", "breathing difficulty", "wheezing",
              "chest infection", "flu", "cold symptoms", "short of breath", "sob"
            ],
            "cognitive/neurological": [
              "confusion", "increased confusion", "agitation", "lethargy", "dizziness"
            ],
            "infection/general": [
              "fever", "chills", "sweating", "high temperature"
            ]
          };

          const extract = (text: string) => {
            const cats = new Set<string>();
            const lower = text.toLowerCase();
            for (const [cat, kws] of Object.entries(SYMPTOM_MAPPING)) {
              for (const kw of kws) {
                if (lower.includes(kw)) {
                  cats.add(cat);
                  break;
                }
              }
            }
            return Array.from(cats);
          };

          handoversList.forEach((h: any) => {
            const res = residentMap.get(h.resident_id);
            if (!res || res.wingId !== resident.wing_id) return;
            const rnText = h.rn_summary ? JSON.stringify(h.rn_summary) : '';
            extract(`${h.raw_input || ''} ${rnText}`).forEach(cat => {
              detections.push({
                residentId: h.resident_id,
                residentName: res.name,
                room: res.room,
                category: cat,
                evidence: `Handover log: "${h.raw_input}"`,
                timestamp: h.created_at
              });
            });
          });

          timelineList.forEach((t: any) => {
            const res = residentMap.get(t.resident_id);
            if (!res || res.wingId !== resident.wing_id) return;
            extract(t.description || '').forEach(cat => {
              detections.push({
                residentId: t.resident_id,
                residentName: res.name,
                room: res.room,
                category: cat,
                evidence: `Timeline log: "${t.description}"`,
                timestamp: t.created_at
              });
            });
          });

          // Group by category for this wing
          for (const cat of Object.keys(SYMPTOM_MAPPING)) {
            const catDets = detections.filter(d => d.category === cat);
            const uniqueRes = new Map<string, any>();
            catDets.forEach(d => {
              uniqueRes.set(d.residentId, d);
            });
            if (uniqueRes.size >= 3) {
              const names = Array.from(uniqueRes.values()).map(r => r.residentName).join(', ');
              const wingObj = Array.isArray(resident.wing) ? resident.wing[0] : resident.wing;
              const wingName = wingObj?.name || 'this wing';

              // Avoid duplicates
              const exists = insightsData.proactive_alerts.some((a: any) => a.id === `chronicle_outbreak_${cat}`);
              if (!exists) {
                insightsData.proactive_alerts.unshift({
                  id: `chronicle_outbreak_${cat}`,
                  severity: 'critical',
                  message: `CHRONICLE WARNING: Potential ${cat.toUpperCase()} outbreak detected in ${wingName}. ${uniqueRes.size} residents displaying symptoms: ${names}.`,
                  evidence: `Clustered symptoms across 3+ residents in 48h. Citing logs: ${catDets.slice(0, 3).map(d => `${d.residentName} (${d.evidence})`).join('; ')}`
                });
                insightsData.risk_level = 'High';
              }
            }
          }
        }
      }

      await supabase
        .from('resident_insights')
        .upsert({
          resident_id: residentId,
          facility_id: resident.facility_id,
          insights: insightsData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'resident_id' });
      return NextResponse.json(insightsData);
    };

    if (!handovers || handovers.length === 0) {
      return saveAndReturn({ 
        summary: 'No recent handovers available to generate insights.',
        risk_level: 'Low',
        proactive_alerts: [],
        optimizations: []
      });
    }

    // Format data for the AI
    const handoverHistory = handovers.map(h => 
      `Date: ${h.shift_date} (${h.shift_type})
      Urgency: ${h.urgency}
      Risk Flags: ${h.risk_flags.join(', ') || 'None'}
      Summary: ${h.rn_summary?.situation || ''} ${h.rn_summary?.assessment || ''}`
    ).join('\n\n');

    const timelineHistory = (timeline || []).map(t =>
      `[${t.created_at}] Action: ${t.action_type} - ${t.description}`
    ).join('\n');

    const tasksHistory = (tasks || []).map(t =>
      `[${t.created_at}] Task: ${t.title} (${t.description}) - Status: ${t.is_completed ? 'Completed' : 'Pending/Incomplete'} - Outcome: ${t.outcome || 'None'}`
    ).join('\n');

    const systemPrompt = `You are a clinical AI assistant for an aged care facility. Analyze the provided 14-day history (handovers, timeline logs, task outcomes) for the resident.
    
    Your goal is to:
    1. Identify concerning clinical trends (e.g. repeated task refusals, safety risks, deterioration).
    2. Provide a brief, professional clinical summary.
    3. Generate a list of "proactive_alerts" for critical risks and "optimizations" for care workflow.
    
    ALERT ACKNOWLEDGMENT RULES:
    The timeline might contain logs of style: "Acknowledged alert: [category_id] by Staff".
    If a category was acknowledged, do NOT generate a proactive alert for it UNLESS a new event of that same category (e.g. a new fall, a new medication refusal, or new agitation) occurred AFTER the acknowledgment timestamp.
    
    Format the proactive alerts and optimizations with:
    - "id": a unique identifier matching the category of risk (e.g., 'medication_refusal', 'fall_risk', 'skin_integrity', 'hydration_alert').
    - "severity": 'critical' | 'warning'
    - "message": extremely specific clinical alert referencing exact dates and details (e.g., "Refused scheduled morning medication 3 times in the last 4 days (latest: June 11).")
    - "evidence": clinical evidence citing logs (e.g., "3 medication refusals recorded in timeline since June 8")
    
    Return ONLY valid JSON with this exact structure:
    {
      "summary": "2-3 sentences summarizing the clinical status.",
      "risk_level": "Low|Medium|High",
      "proactive_alerts": [
        { "id": "category_id", "severity": "critical|warning", "message": "message", "evidence": "evidence" }
      ],
      "optimizations": [
        { "id": "opt_id", "message": "workflow or clinical optimization suggestion", "evidence": "evidence" }
      ]
    }`;

    const userContent = `Resident: ${resident.name} (Care Level: ${resident.care_level})
    
    Recent Handover Notes:
    ${handoverHistory}
    
    Timeline Logs (Aged Care Journal):
    ${timelineHistory}
    
    Tasks History (Shift Records):
    ${tasksHistory}`;

    // Try Anthropic
    const anthropicKey = userKeys?.anthropicKey || process.env.ANTHROPIC_API_KEY || '';
    if (anthropicKey) {
      const client = new Anthropic({ apiKey: anthropicKey });
      const msg = await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });
      
      const textContent = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return saveAndReturn(JSON.parse(jsonMatch[0]));
      }
    }

    // Fallback Mock (detecting typical problems from timeline)
    const hasFall = timelineHistory.toLowerCase().includes('fall') || timelineHistory.toLowerCase().includes('slip');
    const hasRefusal = timelineHistory.toLowerCase().includes('refused') || tasksHistory.toLowerCase().includes('refused');
    const hasPain = timelineHistory.toLowerCase().includes('pain') || tasksHistory.toLowerCase().includes('pain');

    const proactive_alerts = [];
    const optimizations = [];

    if (hasFall) {
      proactive_alerts.push({
        id: 'fall_risk',
        severity: 'critical',
        message: 'High Risk of Re-falling: Resident had a mobility slip/fall incident recorded in the last 7 days.',
        evidence: 'Fall incident logged in timeline.'
      });
      optimizations.push({
        id: 'fall_prevention',
        message: 'Recommend scheduling Vitals Monitoring and Comfort Check tasks together during morning shifts to decrease transfer disruptions.',
        evidence: 'Identified timing conflicts in post-fall checks.'
      });
    }

    if (hasRefusal) {
      const isAcked = timelineHistory.includes('Acknowledged alert: medication_refusal');
      const ackIndex = timelineHistory.indexOf('Acknowledged alert: medication_refusal');
      const latestRefusalIndex = timelineHistory.indexOf('refused');
      const shouldShow = !isAcked || (latestRefusalIndex !== -1 && latestRefusalIndex < ackIndex); 
      
      if (shouldShow) {
        proactive_alerts.push({
          id: 'medication_refusal',
          severity: 'warning',
          message: 'Medication Non-Compliance: Resident has refused scheduled pain relief or regular tablets.',
          evidence: 'Refusal events noted in tasks and activity timeline.'
        });
      }
    }

    if (hasPain) {
      proactive_alerts.push({
        id: 'pain_management',
        severity: 'warning',
        message: 'Escalating Pain Indicators: Complaints of physical discomfort/soreness logged.',
        evidence: 'Pain observations recorded in task outcome history.'
      });
    }

    return saveAndReturn({
      summary: `Analyzed ${handovers.length} handovers and timeline logs over 14 days. Resident has some clinical care priorities to observe closely.`,
      risk_level: proactive_alerts.some(a => a.severity === 'critical') ? 'High' : (proactive_alerts.length > 0 ? 'Medium' : 'Low'),
      proactive_alerts,
      optimizations
    });

  } catch (error: any) {
    console.error('Generate insights error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
