import { useState } from 'react';
import { Receipt, X, type LucideIcon } from 'lucide-react';
import { Card, Pill } from '../primitives';
import { formatRupeesIndian } from '../../lib/formatters';
import { formatRelativeDate } from '../../lib/dates';
import { MOOD_META, ORDERED_MOODS, type ReflectionLabel } from '../../lib/mood';

// Phase B2: Reflect-surface labeling card per JSX preview lines 596-660.
//
// Stream 0.5g-B: small X-icon dismiss affordance + inline confirmation
// pattern. Card content swaps to "Remove this from Reflect?" prompt with
// Remove / Cancel pill buttons when X is tapped. Lighter than a modal,
// more consistent than window.confirm. Departure from JSX preview banked
// in PM_DECISIONS B.10.

export type UnlabeledTxLike = {
  id: string;
  merchant: string | null;
  category: string | null;
  amount: number;
  occurred_at: string;
};

type Props = {
  tx: UnlabeledTxLike;
  label: ReflectionLabel | null;
  pending?: boolean;
  merchantIconFor: (merchantName: string | null) => LucideIcon;
  onLabel: (label: ReflectionLabel) => void;
  onUndo: () => void;
  /** Stream 0.5g: confirmed dismissal. Parent removes the card from the visible list. */
  onDismiss: () => void;
};

export function UnlabeledTxCard({ tx, label, pending, merchantIconFor, onLabel, onUndo, onDismiss }: Props) {
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const MerchantIcon = merchantIconFor(tx.merchant) || Receipt;

  return (
    <Card style={{ marginBottom: 10, padding: 16, position: 'relative' }}>
      {/* X dismiss affordance — quiet by default. Hidden when card is labeled
          (no point dismissing a labeled record) or already in confirmation mode. */}
      {label == null && !confirmDismiss && (
        <button
          type="button"
          onClick={() => setConfirmDismiss(true)}
          aria-label="Remove from Reflect"
          className="hover:opacity-90 transition-opacity"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 24,
            height: 24,
            borderRadius: 999,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888780',
            opacity: 0.5,
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}

      {confirmDismiss ? (
        <ConfirmDismissPanel
          tx={tx}
          onConfirm={() => {
            setConfirmDismiss(false);
            onDismiss();
          }}
          onCancel={() => setConfirmDismiss(false)}
        />
      ) : (
        <>
          {/* Top row: icon + merchant + date·category + amount */}
          <div className="flex items-center" style={{ gap: 12, marginBottom: label != null ? 12 : 14, paddingRight: 24 }}>
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                backgroundColor: '#F4F4F2',
                color: '#5F5E5A',
              }}
            >
              <MerchantIcon size={16} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.2 }} className="truncate">
                {tx.merchant ?? 'Unknown'}
              </div>
              <div style={{ fontSize: 11.5, color: '#888780', marginTop: 2 }} className="truncate">
                {formatRelativeDate(tx.occurred_at)}{tx.category ? ` · ${tx.category}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500 }} className="flex-shrink-0">
              {formatRupeesIndian(Math.abs(Number(tx.amount)))}
            </div>
          </div>

          {/* Bottom row: 3 label buttons OR labeled pill + Undo */}
          {label != null ? (
            <div className="flex items-center justify-between">
              <Pill variant={MOOD_META[label].pillVariant} icon={<MoodIconInline mood={label} />}>
                {MOOD_META[label].display}
              </Pill>
              <button
                type="button"
                onClick={onUndo}
                disabled={pending}
                className="hover:text-[#5F5E5A] transition-colors disabled:opacity-50"
                style={{
                  fontSize: 11.5,
                  color: '#888780',
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 0',
                  cursor: pending ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Undo
              </button>
            </div>
          ) : (
            <div className="flex" style={{ gap: 6 }}>
              {ORDERED_MOODS.map(opt => {
                const meta = MOOD_META[opt];
                const OptIcon = meta.Icon;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onLabel(opt)}
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
                    <OptIcon size={14} strokeWidth={2} color={meta.plateColor} />
                    <span>{meta.display}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function MoodIconInline({ mood }: { mood: ReflectionLabel }) {
  const { Icon } = MOOD_META[mood];
  return <Icon size={12} strokeWidth={2} />;
}

function ConfirmDismissPanel({
  tx,
  onConfirm,
  onCancel,
}: {
  tx: UnlabeledTxLike;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
      <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500 }}>
        Remove this from Reflect?
      </div>
      <div style={{ fontSize: 12.5, color: '#5F5E5A', lineHeight: 1.45 }}>
        {tx.merchant ?? 'Unknown'} {formatRupeesIndian(Math.abs(Number(tx.amount)))}
        {' · '}{formatRelativeDate(tx.occurred_at)}
      </div>
      <div style={{ fontSize: 11.5, color: '#888780', lineHeight: 1.4 }}>
        Dismissed for this session. Refresh Reflect or reset reflections to bring it back.
      </div>
      <div className="flex" style={{ gap: 8, marginTop: 2 }}>
        <button
          type="button"
          onClick={onConfirm}
          className="hover:opacity-90 transition-opacity"
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 999,
            backgroundColor: '#1A1A1A',
            color: '#FFFFFF',
            border: 'none',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Remove
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="hover:bg-black/[0.02] transition-colors"
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 999,
            background: 'transparent',
            color: '#1A1A1A',
            border: '0.5px solid rgba(0,0,0,0.14)',
            fontSize: 13,
            fontWeight: 400,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
