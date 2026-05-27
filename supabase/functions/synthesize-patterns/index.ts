// Stream 0.5j — AI-powered Reflect patterns synthesis.
//
// Frontend calls supabase.functions.invoke('synthesize-patterns') from ReflectPage.
// This function:
//   1. Authenticates the caller, resolves profile.id
//   2. Reads cache; if fresh, returns cached patterns + source flag
//   3. On cache miss: fetches reflections + joined transactions, builds aggregates,
//      calls Vertex AI via the shared gemini.ts helper, parses strict JSON
//   4. Writes the result to reflection_patterns_cache before returning
//   5. On Vertex error: throws — frontend falls back to its local rule engine
//
// Aggregates are pre-computed server-side so the AI is anchored to specific
// counts (PM_DECISIONS.B.15). It cannot fabricate facts beyond the inputs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateContent } from '../_shared/gemini.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cold isolate pays ~300-500ms for JWT mint + Vertex network call adds 3-7s.
// Allow generous headroom — frontend can still fall back to rule engine if
// the user gives up scrolling, the cache will be empty next time.
const AI_TIMEOUT_MS = 30000;
const CACHE_TTL_HOURS = 24;
const MAX_PATTERNS = 4;

// DB stores 'glad' | 'neutral' | 'regret'. The product copy says
// "Worth it / Neutral / Regret" — keep DB labels everywhere internal.
type DbLabel = 'glad' | 'neutral' | 'regret';

interface ReflectionRow {
  id: string;
  label: DbLabel;
  reflected_at: string;
  transaction_id: string;
  transactions: {
    merchant: string | null;
    category: string | null;
    amount: number | string;
    occurred_at: string;
  } | null;
}

interface AIPattern {
  label: string;
  body: string;
  source_aggregates: string[];
}

interface MerchantAgg {
  merchant: string;
  total: number;
  regret: number;
  neutral: number;
  worth_it: number;
  total_amount: number;
  regret_amount: number;
}

interface CategoryAgg {
  category: string;
  total: number;
  regret: number;
  neutral: number;
  worth_it: number;
  total_amount: number;
  regret_amount: number;
}

interface TimeWindowAgg {
  window: 'weekend' | 'weekday';
  total: number;
  regret: number;
  regret_amount: number;
}

function buildAggregates(reflections: ReflectionRow[]) {
  const valid = reflections.filter(r => r.transactions != null);

  const merchantMap = new Map<string, MerchantAgg>();
  const categoryMap = new Map<string, CategoryAgg>();
  const timeWindows: TimeWindowAgg[] = [
    { window: 'weekend', total: 0, regret: 0, regret_amount: 0 },
    { window: 'weekday', total: 0, regret: 0, regret_amount: 0 },
  ];

  for (const r of valid) {
    const tx = r.transactions!;
    const amt = Math.abs(Number(tx.amount));
    const merchant = tx.merchant ?? 'Unknown';
    const category = tx.category ?? 'Uncategorised';

    if (!merchantMap.has(merchant)) {
      merchantMap.set(merchant, {
        merchant, total: 0, regret: 0, neutral: 0, worth_it: 0,
        total_amount: 0, regret_amount: 0,
      });
    }
    const m = merchantMap.get(merchant)!;
    m.total += 1;
    m.total_amount += amt;
    if (r.label === 'regret') { m.regret += 1; m.regret_amount += amt; }
    else if (r.label === 'neutral') m.neutral += 1;
    else if (r.label === 'glad') m.worth_it += 1;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category, total: 0, regret: 0, neutral: 0, worth_it: 0,
        total_amount: 0, regret_amount: 0,
      });
    }
    const c = categoryMap.get(category)!;
    c.total += 1;
    c.total_amount += amt;
    if (r.label === 'regret') { c.regret += 1; c.regret_amount += amt; }
    else if (r.label === 'neutral') c.neutral += 1;
    else if (r.label === 'glad') c.worth_it += 1;

    const day = new Date(tx.occurred_at).getDay(); // 0 Sun, 6 Sat
    const bucket = (day === 0 || day === 6) ? timeWindows[0] : timeWindows[1];
    bucket.total += 1;
    if (r.label === 'regret') { bucket.regret += 1; bucket.regret_amount += amt; }
  }

  const merchantAggregates = Array.from(merchantMap.values())
    .filter(m => m.total >= 2)
    .sort((a, b) => b.regret - a.regret);
  const categoryAggregates = Array.from(categoryMap.values())
    .filter(c => c.total >= 2)
    .sort((a, b) => b.regret - a.regret);

  const totalLabeled = valid.length;
  const totalAmount = valid.reduce((s, r) => s + Math.abs(Number(r.transactions!.amount)), 0);

  return { merchantAggregates, categoryAggregates, timeWindows, totalLabeled, totalAmount };
}

const SYSTEM_PROMPT = `You are Savio's reflection pattern-finder. The user has labeled past purchases as "regret", "neutral", or "worth it" (called "glad" internally). You analyze pre-aggregated counts and surface 2-4 patterns that reveal something non-obvious about their spending.

CONSTRAINTS:
- Every pattern must cite a specific count, amount, or aggregate from the data provided. Never make claims beyond the data.
- Use concrete language: "All 4 Myntra purchases — every one marked regret." NOT "you tend to regret Myntra purchases."
- Avoid scolding or judgmental tone. The user is reflecting; Savio observes.
- Each pattern: 5-25 words for label, 15-40 words for body.
- Prioritize patterns where regret rate is 60%+ in a segment, OR where weekend/weekday rates differ by 25+ percentage points, OR where a single merchant's regret amount is large.
- Skip patterns based on a single data point unless that point is high-amount and labeled regret.
- If only 1-2 aggregates show meaningful signal, return only 1-2 patterns. Do not pad.

OUTPUT FORMAT: Strict JSON array. No prose, no markdown, no code fences. Just the array.
[
  {
    "label": "string (5-25 words, prominent statement)",
    "body": "string (15-40 words, supporting numbers)",
    "source_aggregates": ["merchant:Myntra", "category:Shopping"]
  }
]`;

function buildUserPrompt(agg: ReturnType<typeof buildAggregates>): string {
  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const pct = (a: number, b: number) => b === 0 ? '0%' : `${Math.round((a / b) * 100)}%`;

  const lines: string[] = [];
  lines.push(`TOTAL: ${agg.totalLabeled} reflections, total amount ${inr(agg.totalAmount)}`);
  lines.push('');

  lines.push('MERCHANT BREAKDOWN (merchants with 2+ reflections):');
  if (agg.merchantAggregates.length === 0) lines.push('  (none)');
  for (const m of agg.merchantAggregates) {
    lines.push(`  - ${m.merchant}: ${m.regret}/${m.total} regret (${pct(m.regret, m.total)}), regret amount ${inr(m.regret_amount)} of ${inr(m.total_amount)} total`);
  }
  lines.push('');

  lines.push('CATEGORY BREAKDOWN (categories with 2+ reflections):');
  if (agg.categoryAggregates.length === 0) lines.push('  (none)');
  for (const c of agg.categoryAggregates) {
    lines.push(`  - ${c.category}: ${c.regret}/${c.total} regret (${pct(c.regret, c.total)}), regret amount ${inr(c.regret_amount)} of ${inr(c.total_amount)} total`);
  }
  lines.push('');

  lines.push('WEEKEND vs WEEKDAY:');
  for (const t of agg.timeWindows) {
    lines.push(`  - ${t.window}: ${t.regret}/${t.total} regret (${pct(t.regret, t.total)}), regret amount ${inr(t.regret_amount)}`);
  }
  lines.push('');
  lines.push('Find 2-4 patterns. Return JSON array only.');

  return lines.join('\n');
}

function parsePatterns(raw: string): AIPattern[] {
  let text = raw.trim();
  // Strip code fences if model wraps the JSON despite the instruction.
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('AI response is not an array');
  if (parsed.length === 0) throw new Error('AI returned empty pattern array');
  const trimmed = parsed.slice(0, MAX_PATTERNS);
  return trimmed.map((p: Record<string, unknown>) => ({
    label: String(p.label ?? '').slice(0, 200),
    body: String(p.body ?? '').slice(0, 400),
    source_aggregates: Array.isArray(p.source_aggregates)
      ? (p.source_aggregates as unknown[]).map(s => String(s)).slice(0, 6)
      : [],
  })).filter(p => p.label.length > 0 && p.body.length > 0);
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`AI timeout after ${ms}ms`)), ms)),
  ]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();
    if (profileErr || !profile) throw new Error('Profile not found');
    const profileId = profile.id as string;

    let forceRefresh = false;
    try {
      const body = await req.json();
      forceRefresh = body?.force_refresh === true;
    } catch (_e) { /* empty body OK */ }

    // 1. Cache check
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('reflection_patterns_cache')
        .select('patterns, source, expires_at, generated_at')
        .eq('user_id', profileId)
        .maybeSingle();
      if (cached && new Date(cached.expires_at) > new Date()) {
        return new Response(
          JSON.stringify({
            patterns: cached.patterns,
            source: cached.source,
            cached: true,
            generated_at: cached.generated_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // 2. Cache miss — fetch + aggregate
    const { data: refs, error: refErr } = await supabase
      .from('reflections')
      .select('id, label, reflected_at, transaction_id, transactions:transaction_id(merchant, category, amount, occurred_at)')
      .eq('user_id', profileId)
      .order('reflected_at', { ascending: false });
    if (refErr) throw refErr;

    const reflections = (refs ?? []) as unknown as ReflectionRow[];
    if (reflections.length === 0) {
      // Empty — no point calling the AI. Return empty array; frontend will
      // render the rule engine's empty-state copy.
      return new Response(
        JSON.stringify({ patterns: [], source: 'ai', cached: false, generated_at: new Date().toISOString(), reason: 'no_reflections' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aggregates = buildAggregates(reflections);
    const userPrompt = buildUserPrompt(aggregates);

    const model = Deno.env.get('GEMINI_MODEL_ID') || 'gemini-2.5-flash';
    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    };

    const startTime = performance.now();
    console.log(`[synthesize-patterns] Calling ${model} for profile ${profileId}, ${reflections.length} reflections, prompt ${userPrompt.length} chars`);

    const json = await withTimeout(generateContent(model, payload), AI_TIMEOUT_MS);
    const latency = Math.round(performance.now() - startTime);
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!raw) throw new Error('AI returned empty response');

    let patterns: AIPattern[];
    try {
      patterns = parsePatterns(raw);
    } catch (parseErr) {
      console.error(`[synthesize-patterns] parse failed. raw=${JSON.stringify(raw).slice(0, 500)}`);
      throw new Error(`AI parse failed: ${(parseErr as Error).message}`);
    }
    if (patterns.length === 0) throw new Error('No valid patterns after parsing');

    // 3. Cache the result
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { error: cacheErr } = await supabase
      .from('reflection_patterns_cache')
      .upsert({
        user_id: profileId,
        patterns,
        source: 'ai',
        generated_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
    if (cacheErr) console.warn('[synthesize-patterns] cache write failed:', cacheErr.message);

    console.log(`[synthesize-patterns] Success: ${patterns.length} patterns, ${latency}ms`);

    return new Response(
      JSON.stringify({
        patterns,
        source: 'ai',
        cached: false,
        latency_ms: latency,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const msg = (error as Error).message;
    console.error('[synthesize-patterns] Error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
