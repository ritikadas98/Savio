// D.22 (Stream 0.5p piece #5) — derived daily safe-to-spend.
//
// The month value comes from calculateSafeToSpend() (canonical formula in
// safeToSpend.ts). This helper divides that across the days remaining in
// the current month, including today. For Priya on 2026-05-01 with
// monthSPS=₹12,032, this returns 388 across 31 days.
//
// IMPORTANT: this is a derived view-layer concept. The month SPS itself
// doesn't change daily — it's set at the monthly ritual lock-in. Mid-month
// the daily figure stretches as the denominator shrinks ("you have N days
// of disciplined runway left"). That's intentional — reflects how much
// per-day buffer remains rather than tracking real-time transaction sums.
// Real-time spend subtraction is V2 work (requires actual-spend
// reconciliation against the safe-to-spend bucket).

import { today } from './dates';

export interface DailySafeToSpendResult {
  dailyAmount: number;
  daysRemaining: number;  // including today
}

export function computeDailySafeToSpend(monthSafeToSpend: number): DailySafeToSpendResult {
  const t = today();
  const lastDayOfMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const todayDay = t.getDate();
  // Inclusive of today: May 1 → days 1..31 → 31 remaining; May 15 → days 15..31 → 17 remaining.
  const daysRemaining = lastDayOfMonth - todayDay + 1;

  if (daysRemaining <= 0 || monthSafeToSpend <= 0) {
    return { dailyAmount: 0, daysRemaining: Math.max(daysRemaining, 0) };
  }

  return {
    dailyAmount: Math.floor(monthSafeToSpend / daysRemaining),
    daysRemaining,
  };
}
