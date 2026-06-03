import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildSystemPrompt } from './prompt_builder.ts';
import { hallucinationGuard, hallucinationGuardStructured } from './hallucination_guard.ts';
import { checkScopeFilter, buildScopeDeflection } from './scope_filter.ts';
import { generateContent } from '../_shared/gemini.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phase C3 — structured verdict shape. Mirrored on the frontend in
// src/lib/chat-types.ts so MessageBubble can route to VerdictCard.
type VerdictColor = 'GREEN' | 'YELLOW' | 'RED';
interface StructuredVerdict {
  verdict_color: VerdictColor;
  verdict_line: string;
  body: string;
  tradeoffs: string[];
  best_next_step: string;
}

function isValidStructured(s: unknown): s is StructuredVerdict {
  if (!s || typeof s !== 'object') return false;
  const v = s as Record<string, unknown>;
  return (
    (v.verdict_color === 'GREEN' || v.verdict_color === 'YELLOW' || v.verdict_color === 'RED')
    && typeof v.verdict_line === 'string' && v.verdict_line.length > 0
    && typeof v.body === 'string' && v.body.length > 0
    && Array.isArray(v.tradeoffs) && v.tradeoffs.length >= 2 && v.tradeoffs.length <= 4
    && v.tradeoffs.every((t) => typeof t === 'string' && t.length > 0)
    && typeof v.best_next_step === 'string' && v.best_next_step.length > 0
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const startTime = performance.now();

    // Step 1: Resolve profile by auth_user_id to get the app-level profile.id
    // profiles.id is a hardcoded UUID, auth.uid() is the real auth user ID
    // All child tables FK to profiles.id, NOT to auth.users.id
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileErr || !profile) {
      throw new Error('Profile not found for authenticated user');
    }

    const profileId = profile.id;

    // Step 2: Fetch grounding context using profile.id for all child tables
    const [
      { data: goals },
      { data: commitments },
      { data: transactions },
      { data: ritual },
      { data: merchantStats },
      { data: historyData }
    ] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', profileId),
      supabase.from('commitments').select('*').eq('user_id', profileId),
      supabase.from('transactions').select('amount, merchant, category, direction, occurred_at').eq('user_id', profileId).order('occurred_at', { ascending: false }).limit(15),
      // D.64 (Spec 1) — filter to status='pending' so we always pick the
      // "current ritual to act on" (M-1 in the dynamic-month world). The
      // previous .order('created_at') picked an arbitrary completed
      // ritual when all four seeded rows shared a created_at, which
      // routed the OLD locked safe_to_spend_locked value (₹41,500-₹41,700)
      // into the prompt and bypassed computedSTS. Pending row has
      // safe_to_spend_locked=null until close-out → computedSTS wins.
      supabase.from('monthly_rituals').select('*').eq('user_id', profileId).eq('status', 'pending').limit(1).maybeSingle(),
      supabase.from('merchant_stats').select('*').eq('user_id', profileId),
      supabase.from('chat_messages').select('role, content').eq('user_id', profileId).order('created_at', { ascending: false }).limit(6)
    ]);

    const systemPrompt = buildSystemPrompt(
      profile,
      goals || [],
      commitments || [],
      transactions || [],
      ritual || null,
      merchantStats || []
    );

    // Call Gemini via Vertex AI
    const model = Deno.env.get('GEMINI_MODEL_ID') || 'gemini-2.5-flash';

    const history = (historyData || []).reverse().map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Ensure last message is from user
    if (history.length === 0 || history[history.length - 1].role !== 'user' || history[history.length - 1].parts[0].text !== message) {
      history.push({ role: 'user', parts: [{ text: message }] });
    }

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: history,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingBudget: 256
        }
      }
    };

    console.log(`[chat-respond] Profile: ${profile.full_name}, prompt: ${systemPrompt.length} chars, model: ${model}, history: ${history.length} turns`);

    const json = await generateContent(model, payload);
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Phase C3 — parse the {kind, message?, structured?} contract. Verdict-
    // eligible queries return structured; everything else is prose. Bad JSON
    // or schema mismatch falls back to treating the whole raw text as prose
    // so the user never sees an error.
    let assistantMessage = "I'm not sure how to respond to that.";
    let structured: StructuredVerdict | null = null;

    if (rawText) {
      const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed?.kind === 'structured' && isValidStructured(parsed.structured)) {
          structured = parsed.structured as StructuredVerdict;
          // Use verdict_line as the canonical text for the prose fallback,
          // hallucination guard, and chat history rendering.
          assistantMessage = String(structured.verdict_line);
        } else if (typeof parsed?.message === 'string' && parsed.message.length > 0) {
          assistantMessage = parsed.message;
        } else {
          // Unrecognized JSON shape — treat whole text as prose.
          assistantMessage = rawText;
        }
      } catch {
        // Truncated or otherwise malformed JSON. Defensive extraction:
        // when the model produces `{"kind":"prose","message":"..."` but runs
        // out of tokens before the closing quote, JSON.parse fails. We pull
        // the message contents out of the partial envelope so the user sees
        // useful prose rather than literal `{"kind":"prose"...`. If even
        // this fails (e.g. the rawText isn't an envelope at all), use raw.
        const m = cleaned.match(/"message"\s*:\s*"((?:\\"|[^"])*?)(?:"|$)/);
        if (m && m[1]) {
          // Unescape standard JSON string escapes the model emitted.
          assistantMessage = m[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
        } else {
          assistantMessage = rawText;
        }
      }
    }

    // Guard & Filter — D.18 dispatch:
    //   - structured response: run the guard across verdict_line, body,
    //     tradeoffs[i], best_next_step so every text-bearing field gets
    //     its numbers checked (previously only verdict_line was guarded)
    //   - prose response: existing single-string guard on assistantMessage
    // Both paths return the same shape so the rest of the code stays
    // identical. On structured-guard fallback, drop the structured payload
    // so the user sees the prose error message rather than a verdict card
    // built on numbers we just rejected.
    let guardResult: { verified: boolean; fallback_used: boolean; corrections: any; finalResponse: string };
    if (structured) {
      const sg = hallucinationGuardStructured(structured, systemPrompt, message);
      guardResult = sg;
      if (sg.fallback_used) {
        assistantMessage = sg.finalResponse;
        structured = null;
      }
    } else {
      guardResult = hallucinationGuard(assistantMessage, systemPrompt, message);
      assistantMessage = guardResult.finalResponse;
    }

    // Scope filter checks ONLY the user message — an in-scope answer that
    // mentions a flagged term in passing should not deflect itself. When it
    // triggers, the response becomes the deflection prose and any structured
    // payload is dropped (a scope-deflection is never a verdict).
    const scopeResult = checkScopeFilter(message);
    if (scopeResult.triggered && scopeResult.family) {
      assistantMessage = buildScopeDeflection(scopeResult.family);
      structured = null;
    }

    // Purchase check verdict detection — kept for backward compatibility
    // with existing 7-case audit assertions and the metadata-driven Save
    // Decision button. `is_verdict: true` now ALSO implies a structured
    // payload should be present (unless scope filter dropped it).
    const isVerdict = structured !== null || /\b(afford|buy|purchase|track)\b/i.test(message);

    const latency = Math.round(performance.now() - startTime);

    const ai_metadata = {
      model,
      latency_ms: latency,
      verified: guardResult.verified,
      corrections: guardResult.corrections || null,
      fallback_used: guardResult.fallback_used || false,
      scope_filter_triggered: scopeResult.family || null,
      is_verdict: isVerdict,
      structured,    // Phase C3: full verdict tuple or null
    };

    console.log(`[chat-respond] Total latency: ${latency}ms, structured=${structured ? 'yes' : 'no'}`);

    return new Response(
      JSON.stringify({ response: assistantMessage, ai_metadata }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[chat-respond] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
