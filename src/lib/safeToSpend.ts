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
 * Formula:
 *   monthly_income_net
 *   - sum(FIXED non-investing commitments)
 *   - sum(active goals' monthly_contribution)
 *   + carryForwardFromLastMonth (Phase 3 ritual rollover)
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

  const totalCommitments = commitments
    .filter(c => (c.kind ?? 'fixed') !== 'variable')
    .filter(c => c.category !== 'Investing' && c.category !== 'Investment')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const totalGoals = goals
    .filter(g => g.status === 'active')
    .reduce((sum, g) => sum + Number(g.monthly_contribution || 0), 0);

  return monthlyIncomeNet - totalCommitments - totalGoals + carryForwardFromLastMonth;
}
