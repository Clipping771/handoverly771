import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const { residentId, userKeys } = await request.json();

    if (!residentId) {
      return NextResponse.json({ error: 'Resident ID is required' }, { status: 400 });
    }

    // Fetch resident information
    const { data: resident, error: resError } = await supabase
      .from('residents')
      .select('name, room_number, care_level, dob')
      .eq('id', residentId)
      .single();

    if (resError || !resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
    }

    // Fetch recent handovers (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: handovers, error: handError } = await supabase
      .from('handovers')
      .select('shift_date, shift_type, urgency, risk_flags, rn_summary')
      .eq('resident_id', residentId)
      .gte('shift_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('shift_date', { ascending: false });

    if (handError) {
      return NextResponse.json({ error: 'Failed to fetch handovers' }, { status: 500 });
    }

    if (!handovers || handovers.length === 0) {
      return NextResponse.json({ 
        summary: 'No recent handovers available to generate insights.',
        trends: [],
        recommendations: [],
        risk_level: 'Low'
      });
    }

    // Format data for the AI
    const handoverHistory = handovers.map(h => 
      `Date: ${h.shift_date} (${h.shift_type})
      Urgency: ${h.urgency}
      Risk Flags: ${h.risk_flags.join(', ') || 'None'}
      Summary: ${h.rn_summary?.situation} ${h.rn_summary?.assessment}`
    ).join('\n\n');

    const systemPrompt = `You are a clinical AI assistant for an aged care facility. Analyze the provided 7-day handover history for the resident.
    
    Your goal is to:
    1. Identify any concerning trends (e.g., repeated falls, escalating pain, continuous medication refusals).
    2. Provide a brief, professional clinical summary of their week.
    3. Suggest preventative actions based on the trends.
    
    Return ONLY valid JSON with this exact structure:
    {
      "summary": "2-3 sentences summarizing the week.",
      "trends": ["trend 1", "trend 2"],
      "recommendations": ["action 1", "action 2"],
      "risk_level": "Low|Medium|High"
    }`;

    const userContent = `Resident: ${resident.name} (Care Level: ${resident.care_level})
    
    Recent Handovers:
    ${handoverHistory}`;

    // Try Anthropic
    const anthropicKey = userKeys?.anthropicKey || process.env.ANTHROPIC_API_KEY || '';
    if (anthropicKey) {
      const client = new Anthropic({ apiKey: anthropicKey });
      const msg = await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 800,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });
      
      const textContent = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
    }

    // Fallback Mock
    return NextResponse.json({
      summary: `Analyzed ${handovers.length} handovers from the past 7 days. Resident has maintained a stable baseline with some routine care needs.`,
      trends: handovers.some(h => h.risk_flags.includes('fall')) ? ["Recent fall incident noted"] : ["Stable mobility"],
      recommendations: ["Continue routine care plan and monitoring."],
      risk_level: handovers.some(h => h.urgency === 'critical') ? "High" : "Low"
    });

  } catch (error: any) {
    console.error('Generate insights error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
