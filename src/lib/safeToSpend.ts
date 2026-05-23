export type Commitment = {
  amount: number;
  category?: string | null;
};

export type Goal = {
  monthly_contribution?: number | null;
  status?: string | null;
};

/**
 * Deterministic safe-to-spend formula.
 * Formula: monthly_income_net - sum(commitments where category != 'Investing') - sum(active goals' monthly_contribution)
 */
export function calculateSafeToSpend(
  monthlyIncomeNet: number | null,
  commitments: Commitment[],
  goals: Goal[]
): number {
  if (monthlyIncomeNet === null || monthlyIncomeNet === undefined) return 0;

  const totalCommitments = commitments
    .filter(c => c.category !== 'Investing' && c.category !== 'Investment')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const totalGoals = goals
    .filter(g => g.status === 'active')
    .reduce((sum, g) => sum + Number(g.monthly_contribution || 0), 0);

  return monthlyIncomeNet - totalCommitments - totalGoals;
}
