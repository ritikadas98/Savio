import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMonthName, getNextMonthName } from '../../lib/dates';
import { Card, Pill, SectionHeader } from '../primitives';
// D.61 (Stream 0.5v piece #4) — ReflectionLabelRow no longer used here.
// Reflect tab owns transaction labeling; the close-out's "Looking back"
// section was removed to avoid duplication.

type CommitmentBuffer = { commitment_id: string; commitment_name: string; budgeted: number; actual: number; buffer: number };
type CommitmentOverrun = { commitment_id: string; commitment_name: string; budgeted: number; actual: number; overrun: number };
type UnlabeledTransaction = { id: string; merchant: string | null; amount: number; occurred_at: string; category?: string | null };

// D.60 + D.62 (Stream 0.5v) — Edge Function now returns one_off_breakdown,
// recap, and guidance. unlabeled_transactions retained on the wire for
// backward compat with other consumers; not rendered here post-D.61.
type MerchantTotal = { merchant: string; total: number };

export type CloseOutData = {
  month: string;
  total_leftover: number;
  discretionary_leftover: number;
  commitment_buffers: CommitmentBuffer[];
  commitment_overruns: CommitmentOverrun[];
  unlabeled_transactions: UnlabeledTransaction[];
  // D.60 + D.62 fields are OPTIONAL on the TypeScript side — the Edge
  // Function deploy can lag behind the frontend deploy briefly, and
  // during that window the response shape is pre-0.5v (no recap, no
  // one_off_breakdown, no guidance). Render guards in the component
  // fall back gracefully when these are undefined.
  one_off_breakdown?: {
    top: MerchantTotal[];
    other_total: number;
    other_count: number;
    total: number;
    full_list: MerchantTotal[];
  };
  recap?: {
    income: number;
    fixed_commitments: number;
    goal_contributions: number;
    variable_category_net: number;
    one_off_discretionary: number;
    net_leftover: number;
  };
  guidance?: {
    show: boolean;
    severity: 'small_short' | 'deficit_safe' | 'deficit_breached' | 'repeated_deficit';
    heading: string;
    body: string;
  };
};

const formatINRInt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n));

export function MonthlyRitualCloseOut() {
  const { month = '2026-04' } = useParams();
  const navigate = useNavigate();
  // D.60 — recap card's "One-off spending" row expands inline to show
  // top-4 merchants + the "N others" bucket. Per-mount state; collapses
  // by default to keep the recap card scannable.
  const [oneOffExpanded, setOneOffExpanded] = useState(false);

  const [data, setData] = useState<CloseOutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: res, error: err } = await supabase.functions.invoke('ritual-close-out', { body: { month } });
      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else if (res?.error) {
        setError(res.error);
      } else {
        setData(res as CloseOutData);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [month]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#5F5E5A] mt-3">Closing out…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center p-6 text-center">
        <p className="font-medium text-[#1A1A1A] mb-2">Could not load close-out</p>
        <p className="text-sm text-[#5F5E5A] mb-4">{error ?? 'Unknown error'}</p>
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="px-4 py-2 rounded-full bg-[#1A1A1A] text-white text-sm font-medium"
        >
          Back to home
        </button>
      </div>
    );
  }

  const monthName = formatMonthName(data.month); // e.g. "April"
  const nextMonthName = getNextMonthName(data.month); // e.g. "May" — for "X starts fresh" copy
  const isPositive = data.total_leftover > 0;
  const isExact = Math.abs(data.total_leftover) < 1; // within ₹1 of zero
  const continueLabel = isPositive ? 'Continue to rollover' : `Close out ${monthName}`;

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      {/* Stream 0F: vertical-stack ritual header — back arrow row, then
          eyebrow "Monthly check-in · N of 6", then title at 36px.
          CloseOut is Step 1 of 6 per master plan §5.1. */}
      <header className="flex-shrink-0" style={{ padding: '14px 22px 8px' }}>
        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => navigate('/home')}
            aria-label="Cancel and return home"
            className="text-[#1A1A1A] hover:opacity-70 transition-opacity"
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
          Monthly check-in · 1 of 7
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 400, color: '#1A1A1A', lineHeight: 1.2, letterSpacing: '-0.8px', margin: 0 }}>
          Closing out {monthName}
        </h1>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4">
        {/* Hero: total leftover */}
        <Card variant="hero" className="mb-3 flex flex-col items-start">
          <div className="text-xs font-medium tracking-wider uppercase text-[#5F5E5A] mb-2">
            {isPositive ? 'You finished with' : isExact ? 'You finished at' : `${monthName} closed at a deficit of`}
          </div>
          <div
            className="mb-3"
            style={{
              fontSize: 56,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-1.5px',
              color: isPositive || isExact ? '#1A1A1A' : '#791F1F',
            }}
          >
            {!isPositive && !isExact ? '−' : ''}{formatINRInt(data.total_leftover)}
          </div>
          <div className="text-sm text-[#5F5E5A] leading-relaxed">
            {isPositive
              ? 'Across discretionary spending and commitment buffers.'
              : isExact
                ? 'You spent almost exactly what you had to spend.'
                : `${monthName} closed at a deficit. ${nextMonthName} starts fresh — nothing to roll forward.`}
          </div>
        </Card>

        {/* Spending-category breakdown. D.20 (Stream 0.5p #4): rows here are
            variable spending categories (Eating out, Transport, Groceries)
            with budget caps, not fixed commitments. Real fixed commitments
            (Rent, SIPs, EMIs) have no variance to display so they don't
            appear on this screen. Schema unchanged — commitments table still
            holds both kinds; the is_fixed split is V2 work. */}
        {(data.commitment_overruns.length > 0 || data.commitment_buffers.length > 0) && (
          <Card className="mb-3">
            <SectionHeader title="Spending categories" />
            <div className="flex flex-col divide-y divide-borderSoft">
              {/* Overruns first (the felt-consequence stories) */}
              {data.commitment_overruns.map(o => (
                <div key={o.commitment_id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#1A1A1A] truncate">{o.commitment_name}</div>
                    <div className="text-xs text-[#5F5E5A] truncate">
                      Budgeted {formatINRInt(o.budgeted)} · Actual {formatINRInt(o.actual)}
                    </div>
                  </div>
                  <Pill variant="red">−{formatINRInt(o.overrun)}</Pill>
                </div>
              ))}
              {/* Buffers next, sorted largest first by Edge Function */}
              {data.commitment_buffers.map(b => (
                <div key={b.commitment_id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#1A1A1A] truncate">{b.commitment_name}</div>
                    <div className="text-xs text-[#5F5E5A] truncate">
                      Budgeted {formatINRInt(b.budgeted)} · Actual {formatINRInt(b.actual)}
                    </div>
                  </div>
                  <Pill variant="sage">+{formatINRInt(b.buffer)}</Pill>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* D.60 (Stream 0.5v #1+#3) — math-reveal recap card. Replaces
            the standalone "Spending leftover" card (now demoted to the
            total row here) and the previously-opaque jump from
            Spending Categories → giant red leftover number. Every line
            ties back to a value in the recap payload from the Edge
            Function; the user can audit the math row by row. The
            "One-off spending" row is tappable — expands to show top-4
            merchants + "N others" bucket so the largest single drivers
            are visible without overwhelming the surface.
            Defensive guard: if the Edge Function hasn't been redeployed
            past 0.5v yet (front/back schema race), data.recap is undefined.
            Render the screen without the recap + guidance rather than
            crashing — falls back to the pre-0.5v look until deploy lands. */}
        {data.recap && data.one_off_breakdown && (
        <Card className="mb-3" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#5A6B5F', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 12 }}>
            The math
          </div>

          <RecapRow label="Income" amount={data.recap.income} positive />
          <RecapRow label="Fixed commitments" amount={data.recap.fixed_commitments} positive={false} />
          <RecapRow label="Goal contributions" amount={data.recap.goal_contributions} positive={false} />
          <RecapRow label="Variable category net" amount={data.recap.variable_category_net} positive={data.recap.variable_category_net >= 0} />

          {/* Tappable one-off-spending row + inline expansion. */}
          <button
            type="button"
            onClick={() => setOneOffExpanded(e => !e)}
            aria-expanded={oneOffExpanded}
            className="hover:bg-black/[0.02] transition-colors"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', padding: '6px 0', gap: 12,
              background: 'transparent', border: 'none', textAlign: 'left',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13, color: '#1A1A1A', flex: 1 }}>One-off spending</span>
            <span style={{ fontSize: 13, color: '#501313', fontVariantNumeric: 'tabular-nums' }}>
              −{formatINRInt(data.recap.one_off_discretionary)}
            </span>
            <ChevronDown
              size={14}
              color="#5A6B5F"
              style={{
                transform: oneOffExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms ease',
                flexShrink: 0,
              }}
              aria-hidden
            />
          </button>
          {oneOffExpanded && (
            <div style={{ paddingLeft: 14, paddingTop: 4, paddingBottom: 6 }}>
              {data.one_off_breakdown.top.map(m => (
                <div key={m.merchant} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, color: '#5F5E5A', padding: '3px 0',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  <span>{m.merchant}</span>
                  <span>−{formatINRInt(m.total)}</span>
                </div>
              ))}
              {data.one_off_breakdown.other_count > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, color: '#5F5E5A', padding: '3px 0',
                  fontVariantNumeric: 'tabular-nums', fontStyle: 'italic',
                }}>
                  <span>{data.one_off_breakdown.other_count} others</span>
                  <span>−{formatINRInt(data.one_off_breakdown.other_total)}</span>
                </div>
              )}
            </div>
          )}

          {/* Hairline divider above the net leftover total */}
          <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.07)', margin: '10px 0 8px' }} />

          {/* D.60 piece #2 — "Spending leftover" rename lands here as the
              total row label. Old standalone card title was "Discretionary
              leftover"; per the spec the rename was banked but never
              shipped in 0.5p — landing now as part of the recap. */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '4px 0',
          }}>
            <span style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500 }}>
              Spending leftover
            </span>
            <span style={{
              fontSize: 16, fontWeight: 500,
              color: data.recap.net_leftover >= 0 ? '#173404' : '#501313',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {data.recap.net_leftover >= 0 ? '+' : '−'}{formatINRInt(data.recap.net_leftover)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#5F5E5A', marginTop: 2, lineHeight: 1.45 }}>
            Income minus commitments minus your actual spending. Negative means you went past your safe-to-spend.
          </div>
        </Card>
        )}

        {/* Legacy fallback — Edge Function still on the pre-0.5v schema
            (no recap field returned). Show a minimal "Spending leftover"
            card using the existing discretionary_leftover value, so the
            screen has SOMETHING in the leftover slot until the Edge
            Function deploy lands. Goes away once data.recap is defined. */}
        {!data.recap && (
          <Card className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[#1A1A1A]">Spending leftover</div>
              <div className="text-xs text-[#5F5E5A] mt-1">
                Income minus commitments minus your actual spending. Negative means you went past your safe-to-spend.
              </div>
            </div>
            <div className={`font-medium flex-shrink-0 ${data.discretionary_leftover >= 0 ? 'text-[#1A1A1A]' : 'text-[#791F1F]'}`}>
              {data.discretionary_leftover < 0 ? '−' : ''}{formatINRInt(data.discretionary_leftover)}
            </div>
          </Card>
        )}

        {/* D.62 (Stream 0.5v piece #5) — "What you can do now" guidance.
            Renders only when the Edge Function's rule-engine determined
            we're in the yellow/red zone (small_short / deficit_safe /
            deficit_breached / repeated_deficit). Card tint varies by
            severity — calm neutral for the lighter tiers, warmer amber
            for the more serious ones. NOT alarmist; pairs the deficit
            truth with a concrete lever tied to the user's own rules.
            Same defensive guard: if Edge Function still on pre-0.5v
            schema, data.guidance is undefined — skip silently. */}
        {data.guidance?.show && (
          <GuidanceCard guidance={data.guidance} />
        )}

        {/* Continue */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (isPositive) {
                navigate(`/ritual/${data.month}/rollover`);
              } else {
                navigate(`/ritual/${data.month}/complete`);
              }
            }}
            className="w-full px-5 py-3 rounded-full bg-[#1A1A1A] text-white text-base font-medium transition-opacity hover:opacity-90"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// D.60 — single recap-row primitive. Income / Fixed commitments /
// Goal contributions / Variable category net all use this shape;
// only the one-off-spending row is bespoke (because it's tappable).
function RecapRow({ label, amount, positive }: { label: string; amount: number; positive: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0',
    }}>
      <span style={{ fontSize: 13, color: '#1A1A1A' }}>{label}</span>
      <span style={{
        fontSize: 13,
        color: positive ? '#173404' : '#501313',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {positive ? '+' : '−'}{new Intl.NumberFormat('en-IN', {
          style: 'currency', currency: 'INR', maximumFractionDigits: 0,
        }).format(Math.abs(amount))}
      </span>
    </div>
  );
}

// D.62 (Stream 0.5v #5) — "What you can do now" card. Severity tints:
//   - small_short, deficit_safe: calm light-blue (supportive, non-alarmist)
//   - deficit_breached, repeated_deficit: light amber (attention without
//     red-alarm — the body copy carries the seriousness, not the chrome)
// No emoji, no exclamation cheerleading, no doom. Constructive +
// real lever tied to the user's own rules.
function GuidanceCard({
  guidance,
}: {
  guidance: {
    show: boolean;
    severity: 'small_short' | 'deficit_safe' | 'deficit_breached' | 'repeated_deficit';
    heading: string;
    body: string;
  };
}) {
  const isSerious = guidance.severity === 'deficit_breached' || guidance.severity === 'repeated_deficit';
  const bg = isSerious ? '#FFF4E8' : '#F0F4F8';
  const border = isSerious ? 'rgba(184,134,11,0.18)' : 'rgba(12,68,124,0.12)';

  return (
    <div
      className="mb-3"
      style={{
        backgroundColor: bg,
        border: `0.5px solid ${border}`,
        borderRadius: 14,
        padding: 16,
      }}
      role="note"
      aria-label={guidance.heading}
    >
      <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>
        {guidance.heading}
      </div>
      <div style={{ fontSize: 13, color: '#3A3A3A', lineHeight: 1.6 }}>
        {guidance.body}
      </div>
    </div>
  );
}
