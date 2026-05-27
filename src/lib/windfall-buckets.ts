// Phase C2 — Windfall bucket suggestion helper.
//
// JSX preview lines 928-960 hardcoded a ₹50,000 windfall and ₹20K/15K/10K/5K
// split. The build derives the split from real state (PM_DECISIONS.C.2):
//   - Emergency fund gap (target - current) — anchored to 40% of windfall
//   - Phone fund gap                        — anchored to 30% of windfall
//   - Loan principal                        — DROPPED for Priya (no data; C.3)
//   - Free spend                            — residual
//
// Each suggested amount is capped at the bucket's gap and rounded to ₹100
// (slider step). The free bucket absorbs rounding error so the sum equals
// the windfall amount exactly.

import { tokens } from './design-tokens';

type GoalRow = {
  id: string;
  label: string;
  current_amount: number;
  target_amount: number;
  status: string;
};

export type BucketKey = 'emergency' | 'phone' | 'loan' | 'free';

export interface Bucket {
  key: BucketKey;
  label: string;
  sub: string;
  amount: number;   // suggested amount
  max: number;      // slider max (capped at gap)
  plate: string;    // token color (bg)
  stop: string;     // token color (accent/fg)
}

export interface BucketInputs {
  windfallAmount: number;
  emergencyGoal: GoalRow | null;
  phoneGoal: GoalRow | null;
  loanPrincipal: number | null;  // null for Priya — bucket dropped
}

const round100 = (n: number) => Math.round(n / 100) * 100;
const formatLakhs = (n: number) => {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

export function computeWindfallBuckets(inputs: BucketInputs): Bucket[] {
  const { windfallAmount, emergencyGoal, phoneGoal, loanPrincipal } = inputs;

  const emergencyGap = emergencyGoal
    ? Math.max(0, Number(emergencyGoal.target_amount) - Number(emergencyGoal.current_amount))
    : 0;
  const phoneGap = phoneGoal
    ? Math.max(0, Number(phoneGoal.target_amount) - Number(phoneGoal.current_amount))
    : 0;

  // Anchor splits — capped at the bucket's gap so we never suggest more than
  // the bucket can absorb. Loan bucket only appears when principal data exists.
  const emergencySuggested = emergencyGoal
    ? Math.min(round100(windfallAmount * 0.40), emergencyGap)
    : 0;
  const phoneSuggested = phoneGoal
    ? Math.min(round100(windfallAmount * 0.30), phoneGap)
    : 0;
  const loanSuggested = (loanPrincipal && loanPrincipal > 0)
    ? Math.min(round100(windfallAmount * 0.20), loanPrincipal)
    : 0;

  const allocated = emergencySuggested + phoneSuggested + loanSuggested;
  const freeSuggested = Math.max(0, windfallAmount - allocated);

  const buckets: Bucket[] = [];

  if (emergencyGoal) {
    buckets.push({
      key: 'emergency',
      label: 'Emergency fund',
      sub: `Gap to 6-month buffer (${formatLakhs(emergencyGap)} remaining)`,
      amount: emergencySuggested,
      max: Math.min(windfallAmount, emergencyGap || windfallAmount),
      plate: tokens.gPlate,
      stop: tokens.gStop,
    });
  }

  if (phoneGoal) {
    buckets.push({
      key: 'phone',
      label: 'Phone fund',
      sub: 'Closest goal to completion',
      amount: phoneSuggested,
      max: Math.min(windfallAmount, phoneGap || windfallAmount),
      plate: tokens.avPlate,
      stop: tokens.avStop,
    });
  }

  if (loanPrincipal && loanPrincipal > 0) {
    buckets.push({
      key: 'loan',
      label: 'Personal loan early payment',
      sub: `Principal remaining: ${formatLakhs(loanPrincipal)}`,
      amount: loanSuggested,
      max: Math.min(windfallAmount, loanPrincipal),
      plate: tokens.rPlate,
      stop: tokens.rStop,
    });
  }

  buckets.push({
    key: 'free',
    label: 'Free spend',
    sub: 'Unrestricted',
    amount: freeSuggested,
    max: windfallAmount,
    plate: tokens.yPlate,
    stop: tokens.yStop,
  });

  // Rounding can leave the sum off by ±100. The free bucket absorbs it.
  const sum = buckets.reduce((s, b) => s + b.amount, 0);
  if (sum !== windfallAmount) {
    const freeIdx = buckets.findIndex(b => b.key === 'free');
    buckets[freeIdx].amount = Math.max(0, buckets[freeIdx].amount + (windfallAmount - sum));
  }

  return buckets;
}
