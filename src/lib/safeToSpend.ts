export type Commitment = {
  amount: number;
  category?: string | null;
  kind?: 'fixed' | 'variable' | null;
};

export type Goal = {
  monthly_contribution?: number | null;
  status?: string | null;
};

/**
 * Deterministic safe-to-spend formula.
 *
 * Formula (post-D.64 — Spec 1, revises D.63):
 *   monthly_income_net
 *   - sum(FIXED non-investing commitments)
 *   - sum(FIXED investing commitments — SIPs, RDs, PPF, NPS)
 *   - sum(active goals' monthly_contribution)
 *   + carryForwardFromLastMonth (Phase 3 ritual rollover)
 *
 * Why investing commitments are now deducted (D.64): a monthly SIP / RD
 * auto-debits on its anchor day; the money isn't spendable, even though
 * it isn't "cost" — it's a committed outflow toward the user's future.
 * Same shape as a goal contribution. The investing/non-investing split is
 * preserved at *presentation* time (the prompt builder labels investing
 * as savings, not cost) but both subtract from STS.
 *
 * Variable commitments (kind='variable') are budgets WITHIN the discretionary
 * bucket — they do NOT subtract from safe-to-spend. The ritual close-out
 * surfaces their buffer/overrun against actual linked transactions.
 *
 * For backwards compatibility (data seeded before the kind column existed),
 * a missing/null kind is treated as 'fixed' — i.e. it subtracts. This matches
 * the column's default value at the schema level.
 *
 * carryForwardFromLastMonth is the sum of rollover_allocations.total_amount
 * for last month's ritual where destination_kind = 'carry_forward'. Default 0
 * so callers that don't supply it preserve pre-Phase-3 behavior.
 *
 * ⚠️ Mirror file: supabase/functions/_shared/safeToSpend.ts holds the
 * Deno-side copy with byte-identical math. Both files MUST stay in sync.
 * tests/unit/safeToSpend-parity.test.ts asserts this for every input in
 * a shared fixture — that test is what would have caught the
 * carry-forward drift D.65 fixed (Home added it, chat didn't).
 */

/**
 * D.65 — richer return shape so all surfaces (Home, chat grounding,
 * close-out, Profile "Your finances") consume one decomposition. The
 * scalar `calculateSafeToSpend()` wrapper below preserves the prior
 * call sites that only need the number.
 */
export type StsBreakdown = {
  /** Net monthly income from profile. */
  incomeNet: number;
  /** Σ fixed non-investing commitments (rent, EMIs, utilities, family support, …). */
  totalNonInvesting: number;
  /** Σ fixed investing commitments (SIPs, RDs, PPF, NPS). */
  totalInvesting: number;
  /** Σ informational variable budgets (groceries, eating out, …). NOT subtracted from STS. */
  totalVariable: number;
  /** Σ active-goal monthly contributions. */
  totalGoalContrib: number;
  /** Σ rollover_allocations.total_amount where destination_kind='carry_forward' for last month's ritual. */
  carryForward: number;
  /** Final number: income − non_inv − inv − goals + carry. */
  safeToSpend: number;
};

const isFixed = (c: Commitment) => (c.kind ?? 'fixed') !== 'variable';
const isInvesting = (c: Commitment) => {
  const cat = (c.category ?? '').toLowerCase();
  return cat === 'investing' || cat === 'investment';
};

export function computeStsBreakdown(
  monthlyIncomeNet: number | null | undefined,
  commitments: Commitment[],
  goals: Goal[],
  carryForwardFromLastMonth: number = 0,
): StsBreakdown {
  const incomeNet = Number(monthlyIncomeNet ?? 0);
  const carryForward = Number(carryForwardFromLastMonth || 0);

  const fixed = commitments.filter(isFixed);
  const totalNonInvesting = fixed.filter(c => !isInvesting(c)).reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalInvesting    = fixed.filter(c =>  isInvesting(c)).reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalVariable     = commitments.filter(c => !isFixed(c)).reduce((s, c) => s + Number(c.amount || 0), 0);

  const totalGoalContrib = goals
    .filter(g => g.status === 'active')
    .reduce((sum, g) => sum + Number(g.monthly_contribution || 0), 0);

  const safeToSpend = incomeNet - totalNonInvesting - totalInvesting - totalGoalContrib + carryForward;

  return { incomeNet, totalNonInvesting, totalInvesting, totalVariable, totalGoalContrib, carryForward, safeToSpend };
}

/** Scalar convenience for callers (Home, ritual lock-in) that only need the number. */
export function calculateSafeToSpend(
  monthlyIncomeNet: number | null,
  commitments: Commitment[],
  goals: Goal[],
  carryForwardFromLastMonth: number = 0,
): number {
  if (monthlyIncomeNet === null || monthlyIncomeNet === undefined) return 0;
  return computeStsBreakdown(monthlyIncomeNet, commitments, goals, carryForwardFromLastMonth).safeToSpend;
}
