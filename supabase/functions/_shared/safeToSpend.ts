// D.65 (Stream 0.5z Spec 2) — Deno-side mirror of src/lib/safeToSpend.ts.
// Used by chat-respond/prompt_builder.ts AND ritual-close-out/index.ts
// so all three STS computation sites read the same formula instead of
// each re-implementing it.
//
// ⚠️ Mirror file: src/lib/safeToSpend.ts holds the browser-side copy
// with byte-identical math. Both files MUST stay in sync.
// tests/unit/safeToSpend-parity.test.ts asserts this for every input in
// a shared fixture — that test is what would have caught the
// carry-forward drift D.65 fixed (Home added it, chat didn't).
//
// CARRY-FORWARD CONTRACT (D.65 Spec 2.1):
//   Single home for carry-forward is the READ path. The locked column
//   `monthly_rituals.safe_to_spend_locked` stores the BASE STS only.
//   This module is called on the read side; chat-respond's prompt
//   builder adds carry-forward both for the locked-ritual branch
//   (`locked + cf`) and for the fresh-compute branch (passed in to
//   computeStsBreakdown). For lock-in writes, callers pass
//   carryForwardFromLastMonth = 0 so the stored value stays base-only.

export type Commitment = {
  amount: number;
  category?: string | null;
  kind?: 'fixed' | 'variable' | null;
};

export type Goal = {
  monthly_contribution?: number | null;
  status?: string | null;
};

export type StsBreakdown = {
  incomeNet: number;
  totalNonInvesting: number;
  totalInvesting: number;
  totalVariable: number;
  totalGoalContrib: number;
  carryForward: number;
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

export function calculateSafeToSpend(
  monthlyIncomeNet: number | null,
  commitments: Commitment[],
  goals: Goal[],
  carryForwardFromLastMonth: number = 0,
): number {
  if (monthlyIncomeNet === null || monthlyIncomeNet === undefined) return 0;
  return computeStsBreakdown(monthlyIncomeNet, commitments, goals, carryForwardFromLastMonth).safeToSpend;
}
