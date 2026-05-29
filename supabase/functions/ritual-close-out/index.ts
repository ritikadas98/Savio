// supabase/functions/ritual-close-out/index.ts
//
// Phase 3 Doc 1 — close-out data for the monthly ritual.
// Returns the JSON payload the close-out screen renders against.
//
// Stream 0.5v expansion (D.60 / D.62):
//   - one_off_breakdown: top 4 merchants + "N others" bucket, drives the
//     tap-to-expand row in the math-reveal recap card.
//   - recap: traceable component math (income − fixed − goals + variable
//     net − one-off = net leftover) for the recap card. Same data as
//     elsewhere; surfaced as a typed sub-object so the UI doesn't have
//     to re-derive.
//   - guidance: rule-engine-generated "What you can do now" copy + tier
//     when the user lands in yellow/red zone. Deterministic, no LLM
//     (consistent with D.40). Four tiers with priority ordering:
//     repeated_deficit > deficit_breached > deficit_safe > small_short.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getUserRulesFromProfile } from '../_shared/user-rules.ts';

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

// D.62 (Stream 0.5v #5) — Close-out guidance derivation. Rule-engine, no
// LLM. Returns the "What you can do now" copy + severity tier when the
// leftover lands in yellow/red zone, or {show: false} otherwise.
//
// Severity tiers checked in priority order (most serious first):
//   repeated_deficit > deficit_breached > deficit_safe > small_short
type CloseOutGuidance = {
  show: boolean;
  severity: 'small_short' | 'deficit_safe' | 'deficit_breached' | 'repeated_deficit';
  heading: string;
  body: string;
};

function deriveCloseOutGuidance(params: {
  net_leftover: number;
  one_off_breakdown: {
    top: { merchant: string; total: number }[];
    full_list: { merchant: string; total: number }[];
    total: number;
  };
  variable_category_net: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules: any;
  current_savings: number;
  consecutive_deficit_months: number;
}): CloseOutGuidance {
  const {
    net_leftover,
    one_off_breakdown,
    variable_category_net,
    rules,
    current_savings,
    consecutive_deficit_months,
  } = params;

  // Guidance only renders in yellow/red zone. Anything comfortably positive
  // (> ₹5K) stays quiet — the math-reveal recap already tells that story.
  const SMALL_POSITIVE_THRESHOLD = 5000;
  if (net_leftover > SMALL_POSITIVE_THRESHOLD) {
    return { show: false, severity: 'small_short', heading: '', body: '' };
  }

  const inr = (n: number) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;
  const topThreeMerchants = one_off_breakdown.top.slice(0, 3).map(m => m.merchant).join(', ');
  const topTwoMerchants = one_off_breakdown.top.slice(0, 2).map(m => m.merchant).join(' and ');
  const oneOffTotal = one_off_breakdown.total;
  // How much of the one-off spending would have been caught by the
  // impulse-wait rule (each transaction above the threshold).
  const caughtByImpulseRule = one_off_breakdown.full_list
    .filter(m => m.total >= rules.impulse_wait_threshold)
    .reduce((s, m) => s + m.total, 0);
  const tighterThreshold = Math.max(1000, Math.round(rules.impulse_wait_threshold * 0.8));

  // Bodies are multi-paragraph (paragraphs separated by \n\n). Frontend
  // GuidanceCard splits and renders each as its own <p>. Bullets use
  // unicode "•" — keep them on their own paragraph break so the visual
  // list reads clean. Length budget: 4-5 short paragraphs / ~150-220
  // words. The goal is thorough analysis (the user expects context +
  // diagnosis + concrete steps), not a one-liner that reads as canned.

  // ── repeated_deficit (highest priority) ──
  if (consecutive_deficit_months >= 2) {
    const ordinals = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
    const ord = ordinals[consecutive_deficit_months] ?? `${consecutive_deficit_months}th`;
    return {
      show: true,
      severity: 'repeated_deficit',
      heading: 'Where we can help next',
      body: [
        `This is the ${ord} month in a row closing short. Once is a bad month — that's normal. Twice in a row is a pattern, and patterns don't fix themselves by hoping next month is different.`,
        `The arithmetic is worth sitting with. Your fixed commitments (rent, EMI, SIPs, utilities) come to roughly the same amount each month — those aren't the variable here. What's variable is one-off spending: this month it was ${inr(oneOffTotal)} (${topThreeMerchants}). If that pattern keeps repeating, the deficit will too.`,
        `Your safety net of ${inr(rules.safety_net)} is the line worth protecting. Two more months of this rate would put real pressure on it.`,
        `Three things worth doing this week:`,
        `• Open the Reflect tab and walk through the labeled purchases from the past three months. Which ones felt worth it? Which felt like regret? The pattern of regret-labeled purchases is where the leak is.`,
        `• Consider whether your commitments and income are actually matched. If non-discretionary outflow + goal contributions are eating most of your income, the math will keep pulling discretionary into the red regardless of how careful you are. That's a structural conversation, not a willpower one.`,
        `• Lower your impulse-wait threshold from ${inr(rules.impulse_wait_threshold)} to ${inr(tighterThreshold)} for the next month. Tightening the cooling-off period catches more decisions before they happen. Profile → Your rules.`,
      ].join('\n\n'),
    };
  }

  // ── deficit_breached ──
  // Safety net is breached when accessible cash (emergency fund proxy)
  // dropped below the user's safety_net rule value.
  if (current_savings < rules.safety_net) {
    const shortfall = rules.safety_net - current_savings;
    return {
      show: true,
      severity: 'deficit_breached',
      heading: 'Where we can help next',
      body: [
        `This month went past your safety net. Your accessible cash is now ${inr(current_savings)} — below the ${inr(rules.safety_net)} line you set as the floor. The shortfall is ${inr(shortfall)}.`,
        `The safety net rule exists for a specific reason: it's the cushion that lets you handle an emergency without taking on debt. Once it's below the threshold, every new discretionary purchase makes the gap wider.`,
        `What drove this month: ${inr(oneOffTotal)} in one-off spending — ${topThreeMerchants}. The big one-offs add up faster than they feel like they should.`,
        `Until your safety net is back above ${inr(rules.safety_net)}, the priority is rebuilding it. Concretely:`,
        `• Pause discretionary purchases above ${inr(rules.impulse_wait_threshold)} for the next 4-6 weeks. The ${rules.impulse_wait_hours}-hour wait rule becomes a "wait until safety net restored" rule for this window.`,
        `• Redirect the next month's leftover (when it goes positive) straight to the emergency fund rather than carrying forward as free spend. ${inr(shortfall)} restored is the target.`,
        `• Audit fixed commitments — anything that's a recent add (a subscription, a new EMI) is worth questioning. If it can wait, pausing it for a month accelerates the rebuild.`,
        `This isn't permanent. It's a short window to get back above the line. May resets fresh on the 1st.`,
      ].join('\n\n'),
    };
  }

  // ── deficit_safe ──
  // Negative leftover but safety net still intact. Course-correct framing
  // with the impulse-wait lever cited by name + value (uses rules.*).
  if (net_leftover < 0) {
    return {
      show: true,
      severity: 'deficit_safe',
      heading: 'Where we can help next',
      body: [
        `Your spending leftover landed at ${inr(net_leftover)} this month. The biggest drivers were ${inr(oneOffTotal)} of one-off spending — ${topThreeMerchants}. That's where the gap between budgeted and actual came from; the fixed commitments and goal contributions were on plan.`,
        `Your impulse-wait rule (${rules.impulse_wait_hours} hours over ${inr(rules.impulse_wait_threshold)}) would have given you a cooling-off period on ${inr(caughtByImpulseRule)} of those purchases. If you'd taken the pause on even one or two — particularly ${topTwoMerchants} — this month would have closed at or near zero instead of in the red. The rule is built for exactly this pattern.`,
        `Your safety net of ${inr(rules.safety_net)} is still intact (current accessible cash: ${inr(current_savings)}). So this is a course-correct moment, not an emergency. You don't carry this deficit forward — next month resets fresh on the 1st — but the pattern itself is the signal worth paying attention to.`,
        `Two things worth doing this week:`,
        `• Open the Reflect tab and label the ${topThreeMerchants} purchases as worth-it / neutral / regret. Whichever ones you label "regret" are the ones the impulse-wait rule should have caught — and labeling them trains the regret-rate signal so next time those merchants show up in chat, you'll have evidence.`,
        `• If these one-offs feel recurring, consider tightening your impulse-wait threshold from ${inr(rules.impulse_wait_threshold)} to ${inr(tighterThreshold)} for next month. You can update it in Profile → Your rules. Lower threshold catches more decisions before they happen.`,
      ].join('\n\n'),
    };
  }

  // ── small_short ──
  // Tiny positive (0 to ₹5K). Gentle nudge — month was close, worth a
  // reflection look but not a course-correct.
  return {
    show: true,
    severity: 'small_short',
    heading: 'Where we can help next',
    body: [
      `You finished ${inr(net_leftover)} ahead — close to the line. That's not a deficit, but it's also not the buffer you'd want every month. Variable categories came in ${variable_category_net >= 0 ? `${inr(variable_category_net)} under budget` : `${inr(variable_category_net)} over budget`}; the rest of the gap came from ${inr(oneOffTotal)} in one-off spending (${topThreeMerchants}).`,
      `Months that finish this close are the most useful ones to reflect on. The leftover was small enough that even one or two different discretionary calls would have made the month feel different — but big enough that nothing scary happened.`,
      `What's worth doing this week:`,
      `• Open the Reflect tab and label the top one-off purchases. The ones you label "worth it" are evidence the spend was aligned with what matters to you. The ones you label "regret" are exactly the kind of purchase your impulse-wait rule is meant to catch — and labeling them trains the regret-rate signal so the chat verdicts get sharper.`,
      `• No need to change the rules — they're working. Just notice if the same merchants keep showing up across months.`,
    ].join('\n\n'),
  };
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
    const nullCommitmentDebits: { merchant: string; amount: number }[] = [];
    for (const t of txns) {
      if (t.direction !== 'debit') continue;
      if (t.commitment_id == null) {
        nullCommitmentDebitTotal += num(t.amount);
        nullCommitmentDebits.push({
          merchant: typeof t.merchant === 'string' && t.merchant.length > 0 ? t.merchant : 'Other',
          amount: num(t.amount),
        });
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

    // ── D.60 (Stream 0.5v #1) — One-off-spending breakdown ──
    // Group all null-commitment debits by merchant, sort descending, take
    // top 4 explicitly + bucket the rest as "other_total" / "other_count".
    // full_list is kept for the tap-to-expand affordance (frontend can show
    // all merchants if it wants; we only label the top 4 + others by default).
    const merchantTotals = new Map<string, number>();
    for (const d of nullCommitmentDebits) {
      merchantTotals.set(d.merchant, (merchantTotals.get(d.merchant) ?? 0) + d.amount);
    }
    const sortedMerchants = [...merchantTotals.entries()]
      .map(([merchant, total]) => ({ merchant, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total);
    const topMerchants = sortedMerchants.slice(0, 4);
    const otherMerchants = sortedMerchants.slice(4);
    const one_off_breakdown = {
      top: topMerchants,
      other_total: Number(otherMerchants.reduce((s, m) => s + m.total, 0).toFixed(2)),
      other_count: otherMerchants.length,
      total: Number(nullCommitmentDebitTotal.toFixed(2)),
      full_list: sortedMerchants,
    };

    // ── D.60 — Recap object for the math-reveal card ──
    // Same component values used to compute total_leftover, surfaced as
    // a typed sub-object so the UI doesn't re-derive. Sign convention:
    // income + variable_category_net are positive contributions;
    // fixed_commitments + goal_contributions + one_off_discretionary
    // are reported as positive numbers, the UI shows them with "−".
    const recap = {
      income: Number(num(profile.monthly_income_net).toFixed(2)),
      fixed_commitments: Number(totalFixedNonInvesting.toFixed(2)),
      goal_contributions: Number(totalGoalContrib.toFixed(2)),
      variable_category_net: Number((totalBuffers - totalOverruns).toFixed(2)),
      one_off_discretionary: Number(nullCommitmentDebitTotal.toFixed(2)),
      net_leftover: total_leftover,
    };

    // ── D.62 (Stream 0.5v #5) — "What you can do now" guidance ──
    // Rule-engine-generated (no LLM, no hallucination — consistent with
    // D.40). Shows only when leftover is yellow/red zone (<= ₹5K). Four
    // severity tiers checked in priority order.
    //
    // Simplifications for 0.5v:
    //   - current_savings proxy: Emergency-fund goal's current_amount.
    //     The safety net is conceptually "minimum accessible cash to
    //     preserve"; for this single-user demo, that IS what the
    //     emergency fund represents. V2: real bank-balance integration.
    //   - consecutive_deficit_months: stubbed at 0 (always — only this
    //     month is checked). The repeated_deficit tier ships as
    //     designed-but-not-demoed; the canonical demo flow exercises
    //     deficit_safe via the March seed. V2: track close-out outcomes
    //     in monthly_rituals and walk history backwards.
    const userRules = getUserRulesFromProfile(profile);
    const emergencyGoal = (goals || []).find((g: any) =>
      typeof g.label === 'string' && g.label.toLowerCase().includes('emergency'));
    const currentSavings = emergencyGoal ? num(emergencyGoal.current_amount) : 0;
    const consecutiveDeficitMonths = 0; // V2 polish — see comment above.
    const guidance = deriveCloseOutGuidance({
      net_leftover: total_leftover,
      one_off_breakdown,
      variable_category_net: recap.variable_category_net,
      rules: userRules,
      current_savings: currentSavings,
      consecutive_deficit_months: consecutiveDeficitMonths,
    });

    return new Response(
      JSON.stringify({
        month,
        total_leftover,
        discretionary_leftover,
        commitment_buffers,
        commitment_overruns,
        unlabeled_transactions,
        one_off_breakdown,
        recap,
        guidance,
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
