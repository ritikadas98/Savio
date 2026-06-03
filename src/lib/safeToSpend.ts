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
 */
export function calculateSafeToSpend(
  monthlyIncomeNet: number | null,
  commitments: Commitment[],
  goals: Goal[],
  carryForwardFromLastMonth: number = 0
): number {
  if (monthlyIncomeNet === null || monthlyIncomeNet === undefined) return 0;

  // D.64: ALL fixed commitments deduct, including investing. The category
  // distinction is for presentation (investing = savings, not cost) — the
  // STS math sees them identically.
  const totalCommitments = commitments
    .filter(c => (c.kind ?? 'fixed') !== 'variable')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const totalGoals = goals
    .filter(g => g.status === 'active')
    .reduce((sum, g) => sum + Number(g.monthly_contribution || 0), 0);

  return monthlyIncomeNet - totalCommitments - totalGoals + carryForwardFromLastMonth;
}
