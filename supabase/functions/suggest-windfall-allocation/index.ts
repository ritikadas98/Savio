// supabase/functions/suggest-windfall-allocation/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { windfall_id } = await req.json()

    if (!windfall_id) {
      return new Response(
        JSON.stringify({ error: 'windfall_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // We use service role to read DB directly for the stub, or anon key
    )

    // Fetch the windfall record
    const { data: windfall, error } = await supabaseClient
      .from('windfalls')
      .select('amount, user_id')
      .eq('id', windfall_id)
      .single()

    if (error || !windfall) {
      return new Response(
        JSON.stringify({ error: 'Windfall not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Implement deterministic fallback rule: 40% emergency, 30% priority goal, 20% debt, 10% free spend
    const amount = Number(windfall.amount);
    
    // In a real app we'd query for the user's specific goals/debts, but since it's a fallback stub, we return the split
    const allocations = [
      { bucket_type: 'emergency_fund', amount: amount * 0.40 },
      { bucket_type: 'goal', amount: amount * 0.30 }, // priority goal
      { bucket_type: 'debt', amount: amount * 0.20 },
      { bucket_type: 'free_spend', amount: amount * 0.10 }
    ];

    return new Response(
      JSON.stringify({ windfall_id, amount, allocations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
