import React from 'react';
import { today } from '../../lib/dates';
import { computeDailySafeToSpend } from '../../lib/dailySafeToSpend';
import { tokens } from '../../lib/design-tokens';
import { Card } from '../primitives';

type Props = {
  amount: number;       // month safe-to-spend (per src/lib/safeToSpend.ts)
  anchorDate: Date;
};

// D.22 (Stream 0.5p piece #5) — hero reworked.
//
// Pre-D.22: label said "Safe to spend today" but the number was the MONTH
// total — real-user testing surfaced the cognitive mismatch. Now:
//   - primary number = derived daily (monthSPS / days remaining in month)
//   - secondary line = month total + days remaining as context
//   - rainbow ceiling rescales to daily-spend visualization
// Month value still drives everything in chat grounding + ritual lock-in
// (canonical formula unchanged). Daily is a presentation-layer derivation.

export function SafeToSpendHero({ amount, anchorDate }: Props) {
  const now = today();
  const diffDays = Math.ceil((anchorDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const { dailyAmount, daysRemaining } = computeDailySafeToSpend(amount);

  // Gauge ceiling — scaled to daily now, not month. For Priya's ₹388 on
  // May 1, ceiling = max(388 * 1.5, 1000) = 1000. Keeps the marker in
  // useful territory across a wide range of daily budgets.
  const ceiling = Math.max(dailyAmount * 1.5, 1000);
  const markerPosition = Math.min(Math.max(dailyAmount / ceiling, 0), 1) * 100;

  const formatINR = (n: number) => n.toLocaleString('en-IN');
  // D.30 (Stream 0.5q piece #4) — ceiling drives marker position only;
  // the raw rupee label ("₹1K" for Priya) read as meaningless to
  // real-user testers. Right endpoint now reads "Day's cap" — the
  // label answers what the bar is showing without surfacing the value.

  return (
    <Card variant="hero" className="flex flex-col mb-3">
      <div className="mb-2" style={{ fontSize: 14, color: tokens.s }}>
        Safe to spend today
      </div>

      <div style={{ marginBottom: 4 }}>
        <span
          style={{
            fontSize: 56,
            fontWeight: 500,
            color: tokens.p,
            lineHeight: 1,
            letterSpacing: '-1.5px',
          }}
        >
          ₹{formatINR(dailyAmount)}
        </span>
      </div>

      {/* D.22 secondary line — month total + days remaining as context.
          Subdued treatment so the daily figure remains primary. */}
      <div style={{ fontSize: 12, color: tokens.t, marginBottom: 18 }}>
        ₹{formatINR(amount)} this month · {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
      </div>

      {/* Rainbow gradient bar — preview lines 266–285. 10px high, 4×16 vertical
          marker with 3px white halo. D.22: ceiling now scales to daily, not month. */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background:
              'linear-gradient(90deg, #FF8F8F 0%, #FBAA5A 25%, #F4D123 50%, #B2EF82 75%, #58B9FF 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -3,
            left: `${markerPosition}%`,
            transform: 'translateX(-50%)',
            width: 4,
            height: 16,
            backgroundColor: tokens.p,
            borderRadius: 2,
            boxShadow: `0 0 0 3px ${tokens.card}`,
            transition: 'left 500ms ease-out',
          }}
          aria-hidden
        />
      </div>

      {/* Endpoint labels — 11px / T.t. Center caption stays date-aware. */}
      <div
        className="flex justify-between"
        style={{ fontSize: 11, color: tokens.t }}
      >
        <span>₹0</span>
        <span>
          {diffDays > 0 ? `${diffDays} days until salary on the 1st` : 'Payday!'}
        </span>
        <span>Day&rsquo;s cap</span>
      </div>

      {/* Doc 1.16 Stream D footer — copy preserved. */}
      <div style={{ fontSize: 12, color: tokens.t, marginTop: 12 }}>
        Updated just now · Refreshes at midnight
      </div>
    </Card>
  );
}
