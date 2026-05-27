import React from 'react';
import { today } from '../../lib/dates';
import { tokens } from '../../lib/design-tokens';
import { Card } from '../primitives';

type Props = {
  amount: number;
  anchorDate: Date;
};

export function SafeToSpendHero({ amount, anchorDate }: Props) {
  const now = today();
  const diffDays = Math.ceil((anchorDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Gauge ceiling — high enough that the marker doesn't pin to the right edge
  // on a typical month.
  const ceiling = Math.max(amount * 1.5, 20000);
  const markerPosition = Math.min(Math.max(amount / ceiling, 0), 1) * 100;

  const formatINR = (n: number) => n.toLocaleString('en-IN');
  const ceilingLabel = ceiling >= 1000 ? `₹${Math.round(ceiling / 1000)}K` : `₹${formatINR(ceiling)}`;

  // No delta pill: prior placeholder ("+₹420") suggested day-over-day rollover
  // which we don't compute. Removed in favor of an honest single-number hero.
  // If a real delta (e.g. monthly carry-forward from rollover_allocations) is
  // wired in future, this is the spot to render it inline with the amount.

  return (
    <Card variant="hero" className="flex flex-col mb-3">
      <div className="mb-2" style={{ fontSize: 14, color: tokens.s }}>
        Safe to spend today
      </div>

      <div style={{ marginBottom: 18 }}>
        <span
          style={{
            fontSize: 56,
            fontWeight: 500,
            color: tokens.p,
            lineHeight: 1,
            letterSpacing: '-1.5px',
          }}
        >
          ₹{formatINR(amount)}
        </span>
      </div>

      {/* Gradient bar — per preview lines 266–285. 10px high, 4×16 vertical marker
          with 3px white halo, positioned to overlap the bar by 3px on top.
          Gradient stops are the preview's exact values, not the prior heavier set. */}
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

      {/* Endpoint labels — 11px / T.t per preview. Center caption stays date-aware
          ("Payday!" on anchor day) — that behavior pre-dated the visual fidelity
          pass and is intentional. */}
      <div
        className="flex justify-between"
        style={{ fontSize: 11, color: tokens.t }}
      >
        <span>₹0</span>
        <span>
          {diffDays > 0 ? `${diffDays} days until salary on the 1st` : 'Payday!'}
        </span>
        <span>{ceilingLabel}</span>
      </div>

      {/* Doc 1.16 Stream D: "updated" footer. Copy is static — the safe-to-spend
          IS recomputed at page load, so "just now" is honest by definition.
          Real "updated X ago" computation could replace this in Phase 6. */}
      <div style={{ fontSize: 12, color: tokens.t, marginTop: 12 }}>
        Updated just now · Refreshes at midnight
      </div>
    </Card>
  );
}
