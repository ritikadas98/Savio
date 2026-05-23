import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildSystemPrompt } from './prompt_builder.ts';
import { hallucinationGuard } from './hallucination_guard.ts';
import { applyScopeFilter } from './scope_filter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Fetch Grounding Context — all in parallel
    const startTime = performance.now();
    const [
      { data: profile },
      { data: goals },
      { data: commitments },
      { data: transactions },
      { data: ritual },
      { data: merchantStats },
      { data: historyData }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('commitments').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('amount, merchant, category, direction, occurred_at').eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(15),
      supabase.from('monthly_rituals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('merchant_stats').select('*').eq('user_id', user.id),
      supabase.from('chat_messages').select('role, content').eq('user_id', user.id).order('created_at', { ascending: false }).limit(6)
    ]);

    const systemPrompt = buildSystemPrompt(
      profile || {},
      goals || [],
      commitments || [],
      transactions || [],
      ritual || null,
      merchantStats || []
    );

    // Call Gemini
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
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
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: history,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 400
      }
    };

    console.log(`[chat-respond] System prompt length: ${systemPrompt.length} chars, model: ${model}, history: ${history.length} turns`);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const json = await res.json();
    let assistantMessage = json.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond to that.";

    // Guard & Filter
    const guardResult = hallucinationGuard(assistantMessage, systemPrompt + '\n' + message);
    assistantMessage = guardResult.finalResponse;

    const scopeResult = applyScopeFilter(assistantMessage, message);
    if (scopeResult.triggered) {
      assistantMessage = scopeResult.finalResponse;
    }

    // Purchase check verdict detection
    const isVerdict = /\b(afford|buy|purchase|track)\b/i.test(message);

    const latency = Math.round(performance.now() - startTime);

    const ai_metadata = {
      model,
      latency_ms: latency,
      verified: guardResult.verified,
      corrections: guardResult.corrections || null,
      fallback_used: guardResult.fallback_used || false,
      scope_filter_triggered: scopeResult.family || null,
      is_verdict: isVerdict
    };

    console.log(`[chat-respond] Total latency: ${latency}ms`);

    return new Response(
      JSON.stringify({ response: assistantMessage, ai_metadata }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
