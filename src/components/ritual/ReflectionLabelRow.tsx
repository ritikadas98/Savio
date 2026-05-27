import React, { useState } from 'react';
import { parseDate } from '../../lib/dates';
import { Pill } from '../primitives';
import { MOOD_META, ORDERED_MOODS, type ReflectionLabel } from '../../lib/mood';

// Phase B2: refactored to import the shared mood config from src/lib/mood.ts
// so this surface and the Reflect-tab labeling surface stay in sync. Display
// labels still "Worth it / Neutral / Regret" per PM_DECISIONS reflection lock.
// Layout unchanged from Stream 0.5-E (rounded-rectangle equal-width buttons).
export type { ReflectionLabel };

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

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export function ReflectionLabelRow({ transaction, existingLabel = null, onLabel }: ReflectionLabelRowProps) {
  const [label, setLabel] = useState<ReflectionLabel | null>(existingLabel);
  const [pending, setPending] = useState(false);

  const handleLabel = async (next: ReflectionLabel) => {
    if (pending) return;
    const prev = label;
    setLabel(next);
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
      <div className="flex items-baseline justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[#1A1A1A] truncate">{transaction.merchant ?? 'Unknown'}</div>
          <div className="text-xs text-[#5F5E5A] truncate">
            {dateStr}
            {transaction.category ? ` · ${transaction.category}` : ''}
          </div>
        </div>
        <div className="font-medium text-[#1A1A1A] flex-shrink-0 ml-3">{formatINR(transaction.amount)}</div>
      </div>

      {label !== null ? (
        <div className="flex items-center gap-2">
          <Pill variant={MOOD_META[label].pillVariant} icon={<MoodIcon mood={label} size={14} />}>
            {MOOD_META[label].display}
          </Pill>
          <button
            type="button"
            onClick={() => setLabel(null)}
            className="text-xs text-[#888780] hover:text-[#5F5E5A] transition-colors underline-offset-2 hover:underline"
            disabled={pending}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="flex" style={{ gap: 6 }}>
          {ORDERED_MOODS.map(opt => {
            const meta = MOOD_META[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleLabel(opt)}
                disabled={pending}
                className="hover:bg-[#E4ECE6]/40 transition-colors disabled:opacity-50 whitespace-nowrap"
                style={{
                  flex: 1,
                  padding: '9px 8px',
                  border: '0.5px solid rgba(0,0,0,0.07)',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  fontSize: 12.5,
                  color: '#1A1A1A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  fontFamily: 'inherit',
                  cursor: pending ? 'default' : 'pointer',
                }}
              >
                <MoodIcon mood={opt} size={14} />
                <span>{meta.display}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MoodIcon({ mood, size }: { mood: ReflectionLabel; size: number }) {
  const { Icon } = MOOD_META[mood];
  return <Icon size={size} strokeWidth={2} />;
}
