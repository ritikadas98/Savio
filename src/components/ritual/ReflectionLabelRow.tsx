import React, { useState } from 'react';
import { Smile, Meh, Frown } from 'lucide-react';
import { parseDate } from '../../lib/dates';
import { Pill } from '../primitives';

// Schema's reflections.label CHECK constraint is ('glad','regret','neutral').
// Display labels here are friendlier ("Worth it" / "Regret" / "Neutral") but
// the stored value is the schema value.
export type ReflectionLabel = 'glad' | 'regret' | 'neutral';

type ReflectionLabelRowProps = {
  transaction: {
    id: string;
    merchant: string | null;
    amount: number;
    occurred_at: string;
    category?: string | null;
  };
  existingLabel?: ReflectionLabel | null;
  onLabel: (label: ReflectionLabel) => Promise<void>;
};

const LABEL_META: Record<ReflectionLabel, { display: string; pillVariant: 'sage' | 'red' | 'neutral'; icon: React.ReactNode }> = {
  glad:    { display: 'Worth it', pillVariant: 'sage',    icon: <Smile size={14} strokeWidth={2} /> },
  neutral: { display: 'Neutral',  pillVariant: 'neutral', icon: <Meh size={14} strokeWidth={2} /> },
  regret:  { display: 'Regret',   pillVariant: 'red',     icon: <Frown size={14} strokeWidth={2} /> },
};

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export function ReflectionLabelRow({ transaction, existingLabel = null, onLabel }: ReflectionLabelRowProps) {
  const [label, setLabel] = useState<ReflectionLabel | null>(existingLabel);
  const [pending, setPending] = useState(false);

  const handleLabel = async (next: ReflectionLabel) => {
    if (pending) return;
    const prev = label;
    setLabel(next);          // optimistic
    setPending(true);
    try {
      await onLabel(next);
    } catch (err) {
      console.error('[ReflectionLabelRow] write failed, reverting:', err);
      setLabel(prev);
    } finally {
      setPending(false);
    }
  };

  const dateStr = parseDate(transaction.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div className="py-3">
      {/* Transaction summary */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[#1A1A1A] truncate">{transaction.merchant ?? 'Unknown'}</div>
          <div className="text-xs text-[#5A6B5F] truncate">
            {dateStr}
            {transaction.category ? ` · ${transaction.category}` : ''}
          </div>
        </div>
        <div className="font-medium text-[#1A1A1A] flex-shrink-0 ml-3">{formatINR(transaction.amount)}</div>
      </div>

      {/* Labeled state — compact summary with undo */}
      {label !== null ? (
        <div className="flex items-center gap-2">
          <Pill variant={LABEL_META[label].pillVariant} icon={LABEL_META[label].icon}>
            {LABEL_META[label].display}
          </Pill>
          <button
            type="button"
            onClick={() => setLabel(null)}
            className="text-xs text-[#8B948E] hover:text-[#5A6B5F] transition-colors underline-offset-2 hover:underline"
            disabled={pending}
          >
            Change
          </button>
        </div>
      ) : (
        // Unlabeled state — three labeling buttons
        <div className="flex gap-2">
          {(['regret', 'neutral', 'glad'] as ReflectionLabel[]).map(opt => {
            const meta = LABEL_META[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleLabel(opt)}
                disabled={pending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-borderHover text-sm font-medium text-[#1A1A1A] hover:bg-[#E4ECE6]/60 transition-colors disabled:opacity-50"
              >
                {meta.icon}
                <span>{meta.display}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
