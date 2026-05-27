// Phase C4 — Step 8 Ready synthesis. Reuses _shared/gemini.ts (the same
// Vertex client 0.5j Reflect patterns and C3 chat verdicts use).
//
// Request body shape (per Section 6.2 of the C4 spec):
//   { avatar, lifeStage, anchorDay, focusGoalLabel, monthlyIncome }
//
// Response body:
//   { synthesized: string, source: 'ai' }
//
// On Vertex error or hallucination-guard failure → return non-2xx. Frontend
// falls back to the deterministic template at src/lib/onboarding-synthesis-fallback.ts.
//
// No auth required — onboarding fires this BEFORE the demo-login happens, so
// there's no Supabase session yet. The function uses the anon key for
// nothing other than CORS; the Vertex credentials are server-side env vars.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateContent } from '../_shared/gemini.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_TIMEOUT_MS = 8000;

interface Inputs {
  avatar?: 'strategist' | 'adventurer' | 'builder';
  lifeStage?: 'student' | 'working_no_dependents' | 'supporting_dependents' | 'pre_retiree';
  anchorDay?: number;            // 1-28
  focusGoalLabel?: string | null;
  monthlyIncome?: number;        // rounded to nearest 1000 client-side
}

const STAGE_PHRASES: Record<string, string> = {
  student:                'a student',
  working_no_dependents:  'working without dependents',
  supporting_dependents:  'supporting dependents',
  pre_retiree:            'planning for retirement',
};

const AVATAR_VOICE: Record<string, string> = {
  strategist: 'Math-forward, decisive. Use words like "given", "tradeoff", "with these constraints".',
  adventurer: 'Warmth-forward, exploration. Use words like "journey", "explore", "ahead".',
  builder:    'Structure-forward, system-themed. Use words like "framework", "pattern", "structure".',
};

function ordinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  const last = n % 10;
  const suffix = last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

function buildPrompt(inputs: Required<Pick<Inputs, 'avatar' | 'lifeStage' | 'anchorDay'>> & Pick<Inputs, 'focusGoalLabel' | 'monthlyIncome'>): string {
  const stage = STAGE_PHRASES[inputs.lifeStage] || inputs.lifeStage;
  const voice = AVATAR_VOICE[inputs.avatar] || AVATAR_VOICE.strategist;
  const focusClause = inputs.focusGoalLabel
    ? `Their focus this month is: ${inputs.focusGoalLabel}.`
    : `They chose "no specific focus" — keeping options open.`;
  const incomeClause = inputs.monthlyIncome != null
    ? `Their monthly take-home is around ₹${inputs.monthlyIncome.toLocaleString('en-IN')}.`
    : '';

  return `You are Savio, a decision-support companion. A new user just finished onboarding. Generate a 2-3 sentence personalized synthesis acknowledging what they shared. Voice: ${voice}

USER PROFILE:
- Life stage: ${stage}
- Money lands on the ${ordinalSuffix(inputs.anchorDay)} of each month.
- ${focusClause}
${incomeClause ? `- ${incomeClause}` : ''}

CONSTRAINTS:
- 2-3 sentences only. Total under 60 words.
- Reference the focus goal by name (or "your open month" if no focus).
- Reference the life stage in plain language.
- Reference the anchor day naturally.
- Do NOT include ANY rupee values (₹) in your response — this synthesis is qualitative. Even if income or goal amounts feel relevant, refer to them as "your income" / "your target" rather than spelling out the numbers.
- Do NOT use section labels like "Where you stand", "Observation", "Summary".
- End with one forward-looking sentence about the first check-in.
- Plain prose, no markdown headers, no bullets.`;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`AI timeout after ${ms}ms`)), ms)),
  ]);
}

// Hallucination guard: extract every ₹-prefixed number from the response,
// confirm each appears in the inputs (or is one of a few safe small numbers
// the model might use for "first check-in" copy). Fail closed on any unverified
// rupee value.
function hallucinationOK(text: string, knownAmounts: number[]): boolean {
  const matches = text.match(/₹\s*([\d,]+)/g) ?? [];
  if (matches.length === 0) return true;
  const knownSet = new Set(knownAmounts.map(n => n.toString()));
  for (const m of matches) {
    const n = m.replace(/[₹,\s]/g, '');
    if (!knownSet.has(n)) return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as Inputs;
    if (!body.avatar || !body.lifeStage || body.anchorDay == null) {
      throw new Error('avatar, lifeStage, and anchorDay are required');
    }

    const prompt = buildPrompt({
      avatar: body.avatar,
      lifeStage: body.lifeStage,
      anchorDay: body.anchorDay,
      focusGoalLabel: body.focusGoalLabel ?? null,
      monthlyIncome: body.monthlyIncome,
    });

    const model = Deno.env.get('GEMINI_MODEL_ID') || 'gemini-2.5-flash';
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 600,
        // gemini-2.5-flash burns the entire token budget on its default
        // thinking pass for a simple synthesis task; explicit budget=0
        // routes more of the tokens to output prose.
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const startTime = performance.now();
    const json = await withTimeout(generateContent(model, payload), AI_TIMEOUT_MS);
    const latency = Math.round(performance.now() - startTime);

    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!raw) throw new Error('Empty AI response');

    const text = raw.trim();
    const knownAmounts = body.monthlyIncome != null ? [body.monthlyIncome] : [];
    if (!hallucinationOK(text, knownAmounts)) {
      throw new Error('Hallucination guard tripped — unverified rupee value');
    }

    console.log(`[onboarding-synthesize] ${body.avatar}/${body.lifeStage}/day${body.anchorDay} → ${text.length} chars, ${latency}ms`);

    return new Response(
      JSON.stringify({ synthesized: text, source: 'ai', latency_ms: latency }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const msg = (error as Error).message;
    console.error('[onboarding-synthesize] Error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
