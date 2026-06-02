import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { tokens } from '../../lib/design-tokens';
import { formatRupeesIndian } from '../../lib/formatters';
import { formatRelativeDate } from '../../lib/dates';
import { MOOD_META } from '../../lib/mood';
import type { MerchantTrend } from '../../lib/reflect-patterns';

// B.18 (Stream 0.5p piece #7 — Path B) — per-merchant trend card.
//
// Surface design: left-edge stripe (color encodes level + trend per
// computeMerchantTrends rules) + merchant name + reflection count +
// delta as headline + chevron. Tap expands inline to detail showing
// current rate, prior 3-month average, percentage point change, and
// the recent reflections list. No modal, no route change.
//
// Current regret rate is HIDDEN from the card surface by spec lock —
// the user accesses it via expansion. Keeps the surface minimal so
// the headline is the change, not the snapshot.

interface Props {
  trend: MerchantTrend;
}

export function MerchantTrendCard({ trend }: Props) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = trend.recentReflections.length > 0;

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderLeft: `4px solid ${trend.stripeColor}`,
        borderTop: '0.5px solid rgba(0,0,0,0.07)',
        borderRight: '0.5px solid rgba(0,0,0,0.07)',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        borderRadius: '0 12px 12px 0',
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => canExpand && setExpanded(e => !e)}
        className="w-full hover:bg-black/[0.02] transition-colors"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: canExpand ? 'pointer' : 'default',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500, lineHeight: 1.3 }}>
            {trend.merchant}
          </div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>
            {trend.reflectionCount} {trend.reflectionCount === 1 ? 'reflection' : 'reflections'}
          </div>
        </div>
        <span style={{ fontSize: 14, color: trend.deltaColor, fontWeight: 500 }}>
          {trend.deltaLabel}
        </span>
        {canExpand && (
          <ChevronDown
            size={12}
            color="#888880"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
              flexShrink: 0,
            }}
            aria-hidden
          />
        )}
      </button>

      {expanded && (
        <div
          style={{
            padding: '0 14px 12px 14px',
            borderTop: '0.5px solid rgba(0,0,0,0.06)',
            marginTop: 0,
          }}
        >
          <div style={{ paddingTop: 10, fontSize: 11, color: '#5A6B5F', lineHeight: 1.6 }}>
            <DetailRow
              label="Current regret rate"
              value={
                trend.currentRegretRate == null
                  ? '— (no recent purchases)'
                  : `${trend.currentRegretRate}%  (${trend.currentCount} ${trend.currentCount === 1 ? 'reflection' : 'reflections'} in last 30 days)`
              }
            />
            <DetailRow
              label="Prior 3-month average"
              value={
                trend.priorRegretRate == null
                  ? '— (insufficient prior data)'
                  : `${trend.priorRegretRate}%  (${trend.priorCount} reflections)`
              }
            />
            <DetailRow
              label="Change"
              value={
                trend.delta == null
                  ? '— first period'
                  : `${trend.delta > 0 ? '+' : ''}${trend.delta} percentage points`
              }
            />
          </div>

          {trend.recentReflections.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#5A6B5F', fontWeight: 500, marginBottom: 4 }}>
                Recent reflections at {trend.merchant}:
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {trend.recentReflections.map((r, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 11,
                      color: '#1a1a1a',
                      lineHeight: 1.6,
                      padding: '2px 0',
                    }}
                  >
                    <span style={{ color: tokens.t }}>•</span>{' '}
                    {formatRupeesIndian(r.amount)} · {formatRelativeDate(r.occurred_at)} ·{' '}
                    <span style={{ color: MOOD_META[r.label]?.plateColor ?? tokens.t }}>
                      {MOOD_META[r.label]?.display ?? r.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
      <span style={{ color: '#5A6B5F' }}>{label}</span>
      <span style={{ color: '#1a1a1a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}
