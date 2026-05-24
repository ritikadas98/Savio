// supabase/functions/gemini-test/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { generateContent } from '../_shared/gemini.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'prompt is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const modelId = Deno.env.get('GEMINI_MODEL_ID') || 'gemini-2.5-flash';

    const startTime = Date.now();
    const json = await generateContent(modelId, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const latency = Date.now() - startTime;

    const responseText = json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text';

    return new Response(
      JSON.stringify({ response: responseText, latency_ms: latency, model: modelId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
