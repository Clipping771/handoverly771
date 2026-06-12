import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { text, facilityId } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });
    }

    // 1. Fetch Facility Config for Feature Flags
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

    if (featureFlags.ariaEnabled === false) {
      return NextResponse.json({
        enabled: false,
        message: 'Aria Voice Parser is disabled by feature flags.'
      }, { status: 403 });
    }

    const userKeys = aiConfig.keys || {};
    const anthropicKey = userKeys.anthropicKey || process.env.ANTHROPIC_API_KEY || '';

    // Initialize default structure
    let parsedVitals = {
      temperature: { value: null as number | null, confidence: 'high' as 'high' | 'low' },
      bp: { systolic: null as number | null, diastolic: null as number | null, confidence: 'high' as 'high' | 'low' }
    };

    // Helper: Local fallback parser (Regex + keyword detection)
    const runFallbackParser = (input: string) => {
      const lower = input.toLowerCase();
      const isAmbiguous = lower.includes('maybe') || 
                          lower.includes('felt') || 
                          lower.includes('feel') || 
                          lower.includes('about') || 
                          lower.includes('around') || 
                          lower.includes('guess') || 
                          lower.includes('?');

      const localConfidence = isAmbiguous ? 'low' : 'high';

      // 1. Parse temperature (looking for decimal or integer close to body temp: 34-43)
      // e.g. "temperature of 38.2", "temp is 39"
      const tempMatch = lower.match(/(?:temp|temperature)(?:\s+is|\s+of|\s+was)?\s+(\d{2}(?:\.\d)?)/) ||
                        lower.match(/(\d{2}\.\d)\s*(?:degrees|celsius|c|deg)/);
      if (tempMatch) {
        const val = parseFloat(tempMatch[1]);
        if (val >= 34 && val <= 43) {
          parsedVitals.temperature.value = val;
          parsedVitals.temperature.confidence = localConfidence;
        }
      }

      // 2. Parse Blood Pressure
      // e.g. "140 over 90", "bp is 120/80"
      const bpSlashMatch = lower.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
      const bpOverMatch = lower.match(/(?:bp|blood\s+pressure)(?:\s+is|\s+of|\s+was)?\s+(\d{2,3})\s+over\s+(\d{2,3})/) ||
                          lower.match(/(\d{2,3})\s+over\s+(\d{2,3})/);

      if (bpSlashMatch) {
        parsedVitals.bp.systolic = parseInt(bpSlashMatch[1]);
        parsedVitals.bp.diastolic = parseInt(bpSlashMatch[2]);
        parsedVitals.bp.confidence = localConfidence;
      } else if (bpOverMatch) {
        parsedVitals.bp.systolic = parseInt(bpOverMatch[1]);
        parsedVitals.bp.diastolic = parseInt(bpOverMatch[2]);
        parsedVitals.bp.confidence = localConfidence;
      }
    };

    // 2. Try LLM Parsing
    let usedLLM = false;
    if (anthropicKey) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        const systemPrompt = `You are a clinical speech parsing engine. Parse temperature and blood pressure (systolic and diastolic) from the spoken phrase.
        
        Rules:
        - Extract exact numbers where mentioned.
        - If a value is vague, guess-work, accompanied by phrases like "maybe", "about", "felt high", "probably", or is unsure, mark that category's confidence as "low".
        - If a category is not mentioned, return null for its values and "high" for confidence.
        
        Respond ONLY with a JSON object of this structure:
        {
          "temperature": { "value": 38.2, "confidence": "high" },
          "bp": { "systolic": 140, "diastolic": 90, "confidence": "low" }
        }`;

        const msg = await client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 500,
          temperature: 0.1,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Parse this: "${text}"` }]
        });

        const textContent = msg.content[0].type === 'text' ? msg.content[0].text : '';
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          if (result.temperature) parsedVitals.temperature = result.temperature;
          if (result.bp) parsedVitals.bp = result.bp;
          usedLLM = true;
        }
      } catch (err) {
        console.error('Aria Claude parsing failed, falling back to local parser:', err);
      }
    }

    if (!usedLLM) {
      runFallbackParser(text);
    }

    return NextResponse.json({
      success: true,
      rawText: text,
      vitals: parsedVitals,
      usedLLM
    });

  } catch (error: any) {
    console.error('Aria Voice Parser API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
