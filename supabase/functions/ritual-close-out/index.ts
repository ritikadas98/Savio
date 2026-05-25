// supabase/functions/ritual-close-out/index.ts
//
// Phase 3 Doc 1 — close-out data for the monthly ritual.
// Returns the JSON payload the close-out screen renders against.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helpers
const num = (x: unknown) => Number(x ?? 0);
const isInvestingCategory = (cat: unknown): boolean =>
  typeof cat === 'string' && (cat.toLowerCase() === 'investing' || cat.toLowerCase() === 'investment');

// 'YYYY-MM' → ['YYYY-MM-01', 'YYYY-MM+1-01']
function monthBoundaries(monthYear: string): [string, string] {
  const [yStr, mStr] = monthYear.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error(`Invalid month '${monthYear}', expected YYYY-MM`);
  }
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const nextMonthStart = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return [monthStart, nextMonthStart];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const month: string = body.month;
    if (!month) throw new Error("'month' is required (e.g. '2026-04')");

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();
    if (profileErr || !profile) throw new Error('Profile not found');

    const profileId = profile.id;
    const [monthStart, nextMonthStart] = monthBoundaries(month);

    // Fetch commitments + active goals + month transactions in parallel.
    const [
      { data: commitments },
      { data: goals },
      { data: monthTxns },
    ] = await Promise.all([
      supabase.from('commitments').select('*').eq('user_id', profileId),
      supabase.from('goals').select('*').eq('user_id', profileId).eq('status', 'active'),
      supabase.from('transactions')
        .select('id, merchant, amount, direction, occurred_at, category, commitment_id')
        .eq('user_id', profileId)
        .gte('occurred_at', monthStart)
        .lt('occurred_at', nextMonthStart),
    ]);

    const txns = monthTxns || [];
    const comms = commitments || [];

    // ── Per-commitment actuals (debits only; sum by commitment_id) ──
    const actualByCommitment = new Map<string, number>();
    let nullCommitmentDebitTotal = 0;
    for (const t of txns) {
      if (t.direction !== 'debit') continue;
      if (t.commitment_id == null) {
        nullCommitmentDebitTotal += num(t.amount);
      } else {
        const prior = actualByCommitment.get(t.commitment_id) || 0;
        actualByCommitment.set(t.commitment_id, prior + num(t.amount));
      }
    }

    // ── Variable commitment buffers / overruns ──
    const variableCommitments = comms.filter((c: any) => c.kind === 'variable');
    const commitment_buffers: any[] = [];
    const commitment_overruns: any[] = [];
    for (const c of variableCommitments) {
      const budgeted = num(c.amount);
      const actual = actualByCommitment.get(c.id) || 0;
      const delta = budgeted - actual;
      if (delta > 0) {
        commitment_buffers.push({
          commitment_id: c.id,
          commitment_name: c.label,
          budgeted,
          actual,
          buffer: Number(delta.toFixed(2)),
        });
      } else if (delta < 0) {
        commitment_overruns.push({
          commitment_id: c.id,
          commitment_name: c.label,
          budgeted,
          actual,
          overrun: Number((-delta).toFixed(2)),
        });
      }
    }
    // Sort: largest buffer first, largest overrun first
    commitment_buffers.sort((a, b) => b.buffer - a.buffer);
    commitment_overruns.sort((a, b) => b.overrun - a.overrun);

    // ── Discretionary leftover ──
    // safe_to_spend (budgeted discretionary) = income - fixed_non_investing_commits - active_goal_contribs
    const fixedCommits = comms.filter((c: any) => (c.kind ?? 'fixed') !== 'variable');
    const fixedNonInvesting = fixedCommits.filter((c: any) => !isInvestingCategory(c.category));
    const totalFixedNonInvesting = fixedNonInvesting.reduce((s: number, c: any) => s + num(c.amount), 0);
    const totalGoalContrib = (goals || []).reduce((s: number, g: any) => s + num(g.monthly_contribution), 0);
    const safeToSpendBudget = num(profile.monthly_income_net) - totalFixedNonInvesting - totalGoalContrib;
    const discretionary_leftover = Number((safeToSpendBudget - nullCommitmentDebitTotal).toFixed(2));

    // ── Net total leftover ──
    const totalBuffers = commitment_buffers.reduce((s, b) => s + b.buffer, 0);
    const totalOverruns = commitment_overruns.reduce((s, o) => s + o.overrun, 0);
    const total_leftover = Number((discretionary_leftover + totalBuffers - totalOverruns).toFixed(2));

    // ── Unlabeled transactions ≥ ₹500 in the month, top 3 by amount ──
    // Fetch the largest 20 debit transactions ≥ ₹500 in month where the
    // transaction is NOT tied to a commitment — reflections are for
    // discretionary purchases, not fixed bills (Rent, EMI, SIPs, etc.).
    // Then exclude any that already have a reflection.
    const { data: candidates } = await supabase
      .from('transactions')
      .select('id, merchant, amount, occurred_at, category')
      .eq('user_id', profileId)
      .eq('direction', 'debit')
      .is('commitment_id', null)
      .gte('occurred_at', monthStart)
      .lt('occurred_at', nextMonthStart)
      .gte('amount', 500)
      .order('amount', { ascending: false })
      .limit(20);

    let unlabeled_transactions: any[] = [];
    if (candidates && candidates.length > 0) {
      const ids = candidates.map((t: any) => t.id);
      const { data: existingRefs } = await supabase
        .from('reflections')
        .select('transaction_id')
        .in('transaction_id', ids);
      const labeled = new Set((existingRefs || []).map((r: any) => r.transaction_id));
      unlabeled_transactions = candidates.filter((t: any) => !labeled.has(t.id)).slice(0, 3);
    }

    return new Response(
      JSON.stringify({
        month,
        total_leftover,
        discretionary_leftover,
        commitment_buffers,
        commitment_overruns,
        unlabeled_transactions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[ritual-close-out] Error:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
