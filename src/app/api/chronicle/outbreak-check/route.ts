import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Clinical Taxonomy Symptom Dictionary - Approved by Registered Nurse (RN) / Aged Care Clinical Advisor
// Maps informal language/nursing jargon to standardized categories to avoid alert fatigue.
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
    "confusion", "increased confusion", "agitation", "lethargy", "dizziness",
    "hallucination", "disorientation"
  ],
  "infection/general": [
    "fever", "chills", "sweating", "high temperature", "feverish",
    "shivering", "temperature spike", "hot to touch"
  ]
};

function extractSymptomCategories(text: string): string[] {
  const categories = new Set<string>();
  const lower = text.toLowerCase();
  
  for (const [category, keywords] of Object.entries(SYMPTOM_MAPPING)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        categories.add(category);
        break; // Stop after first match in category
      }
    }
  }
  
  return Array.from(categories);
}

export async function POST(req: Request) {
  try {
    const { facilityId } = await req.json();
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });
    }

    // 1. Fetch Facility Feature Flags Config
    const { data: facData, error: facError } = await supabase
      .from('facilities')
      .select('ai_config')
      .eq('id', facilityId)
      .single();

    if (facError) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const aiConfig = facData?.ai_config || {};
    const featureFlags = aiConfig.featureFlags || {};
    
    // Respect Chronicle feature flag (defaults to true if not set)
    if (featureFlags.chronicleEnabled === false) {
      return NextResponse.json({
        enabled: false,
        outbreaks: [],
        message: 'Chronicle module is disabled'
      });
    }

    // 2. Fetch Active Residents in the facility
    const { data: residents, error: resError } = await supabase
      .from('residents')
      .select(`
        id, name, room_number, wing_id,
        wing:wings(id, name)
      `)
      .eq('facility_id', facilityId)
      .eq('is_active', true);

    if (resError || !residents) {
      return NextResponse.json({ error: 'Failed to fetch residents' }, { status: 500 });
    }

    const residentMap = new Map<string, any>();
    residents.forEach((r: any) => {
      const wingObj = Array.isArray(r.wing) ? r.wing[0] : r.wing;
      residentMap.set(r.id, {
        id: r.id,
        name: r.name,
        room: r.room_number,
        wingId: r.wing_id,
        wingName: wingObj?.name || 'Unknown Wing'
      });
    });

    // 3. Fetch handovers and timeline events in the last 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const [handoversRes, timelineRes] = await Promise.all([
      supabase
        .from('handovers')
        .select('id, resident_id, raw_input, rn_summary, created_at')
        .eq('facility_id', facilityId)
        .gte('created_at', fortyEightHoursAgo),
      supabase
        .from('activity_timeline')
        .select('id, resident_id, description, created_at')
        .eq('facility_id', facilityId)
        .gte('created_at', fortyEightHoursAgo)
    ]);

    if (handoversRes.error) {
      return NextResponse.json({ error: 'Failed to fetch handovers' }, { status: 500 });
    }
    if (timelineRes.error) {
      return NextResponse.json({ error: 'Failed to fetch activity timeline' }, { status: 500 });
    }

    const handovers = handoversRes.data || [];
    const timeline = timelineRes.data || [];

    const detections: Array<{
      residentId: string;
      residentName: string;
      room: string;
      wingId: string;
      wingName: string;
      category: string;
      evidence: string;
      timestamp: string;
    }> = [];

    // Analyze Handovers
    handovers.forEach((h: any) => {
      const res = residentMap.get(h.resident_id);
      if (!res || !res.wingId) return;

      const rnText = h.rn_summary ? JSON.stringify(h.rn_summary) : '';
      const textToAnalyze = `${h.raw_input || ''} ${rnText}`;
      const categories = extractSymptomCategories(textToAnalyze);

      categories.forEach(cat => {
        detections.push({
          residentId: res.id,
          residentName: res.name,
          room: res.room,
          wingId: res.wingId,
          wingName: res.wingName,
          category: cat,
          evidence: `Handover log: "${h.raw_input}"`,
          timestamp: h.created_at
        });
      });
    });

    // Analyze Timeline Events
    timeline.forEach((t: any) => {
      const res = residentMap.get(t.resident_id);
      if (!res || !res.wingId) return;

      const categories = extractSymptomCategories(t.description || '');

      categories.forEach(cat => {
        detections.push({
          residentId: res.id,
          residentName: res.name,
          room: res.room,
          wingId: res.wingId,
          wingName: res.wingName,
          category: cat,
          evidence: `Timeline log: "${t.description}"`,
          timestamp: t.created_at
        });
      });
    });

    // Group detections by Wing ID and Symptom Category
    const groups: Record<string, typeof detections> = {};
    detections.forEach(det => {
      const key = `${det.wingId}:${det.category}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(det);
    });

    const activeOutbreaks: any[] = [];

    for (const [key, list] of Object.entries(groups)) {
      const [wingId, category] = key.split(':');
      
      // Determine unique residents
      const residentIds = new Set(list.map(d => d.residentId));
      
      if (residentIds.size >= 3) {
        // Outbreak detected! Assemble details
        const wingName = list[0].wingName;
        
        // Find affected residents
        const affectedResidents = Array.from(residentIds).map(id => {
          const resDets = list.filter(d => d.residentId === id);
          return {
            id,
            name: resDets[0].residentName,
            room: resDets[0].room,
            lastLogged: resDets[resDets.length - 1].timestamp,
            details: resDets.map(d => d.evidence)
          };
        });

        // Generate infection control suggestions
        let suggestedTasks: string[] = [];
        if (category === 'gastrointestinal') {
          suggestedTasks = [
            'Implement strict contact isolation precautions for affected residents',
            'Contact GP and public health unit/advisors',
            'Ensure staff wear contact PPE (gowns and gloves)',
            'Increase fluids and perform hydration chart monitoring',
            'Collect clinical stool sample for laboratory analysis'
          ];
        } else if (category === 'respiratory') {
          suggestedTasks = [
            'Implement droplet and airborne precautions for affected residents',
            'Conduct COVID-19 / Influenza / RSV rapid antigen testing (RAT)',
            'Monitor oxygen saturation (SpO2) and respiratory rate every 4 hours',
            'Staff must wear N95/P2 masks and protective eyewear in the wing',
            'Contact GP and clinical supervisor'
          ];
        } else {
          suggestedTasks = [
            'Monitor vital signs (temperature, pulse, BP, SpO2) every 4 hours',
            'Inform clinical supervisor on duty',
            'Document symptom progression detailed in timeline notes'
          ];
        }

        activeOutbreaks.push({
          wingId,
          wingName,
          category,
          residentCount: residentIds.size,
          residents: affectedResidents,
          suggestedTasks,
          evidenceCount: list.length,
          latestLogTime: list.reduce((latest, d) => d.timestamp > latest ? d.timestamp : latest, list[0].timestamp)
        });
      }
    }

    return NextResponse.json({
      enabled: true,
      outbreaks: activeOutbreaks
    });

  } catch (error: any) {
    console.error('Chronicle Outbreak Check Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
