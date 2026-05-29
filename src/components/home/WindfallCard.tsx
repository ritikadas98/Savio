import React from 'react';
import { Sparkles } from 'lucide-react';
import { tokens } from '../../lib/design-tokens';
import { Card } from '../primitives';

type Props = {
  amount: number;
  // `source` is unused after Doc 1.15 Stream E removed the source label
  // above the amount line. Kept as optional for backward-compat with the
  // HomePage call site; safe to drop in a V2 cleanup if a `source` field
  // never re-emerges in the design.
  source?: string;
  // D.55 (Stream 0.5u piece #3) — onDismiss is wired to "Skip for now"
  // only. The previous duplicate X-cross dismiss affordance was removed:
  // (a) both buttons called the same handler so there was no UX value
  // in having two; (b) HomePage never passed onDismiss pre-D.55, so both
  // were silently inert; (c) single Skip affordance reduces the chance
  // of the same bug recurring.
  onDismiss?: () => void;
  onAllocate?: () => void;
};

export function WindfallCard({ amount, onDismiss, onAllocate }: Props) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

  return (
    <Card accentColor="yellow" className="space-y-3 mb-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F4D123]/20 flex items-center justify-center flex-shrink-0">
          <Sparkles size={20} className="text-[#B8860B]" />
        </div>

        {/* Doc 1.15 Stream E: amount IS the headline. The prior small source
            label above the amount has been removed — preview reserves that
            slot pattern for elsewhere.
            D.55 (Stream 0.5u #3): X-cross dismiss removed (was redundant
            with Skip; both were silently broken). Skip for now is the
            single dismiss affordance below. */}
        <div
          className="flex-1 min-w-0"
          style={{ fontSize: 15, color: tokens.p, fontWeight: 500, lineHeight: 1.35 }}
        >
          {formattedAmount} landed today — well above your usual.
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: tokens.s, lineHeight: 1.4 }}>
        Money that breaks pattern is the easiest to spend without noticing. Want to spend 60 seconds deciding what this is for?
      </p>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onAllocate}
          className="px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: tokens.p, color: tokens.card }}
        >
          Allocate now
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-5 py-2.5 rounded-full text-sm font-medium transition-colors hover:bg-black/[0.02]"
          style={{ backgroundColor: 'transparent', color: tokens.p, border: `0.5px solid ${tokens.borderHover}` }}
        >
          Skip for now
        </button>
      </div>
    </Card>
  );
}
