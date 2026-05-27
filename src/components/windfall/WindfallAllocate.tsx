import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { tokens } from '../../lib/design-tokens';
import { formatRupeesIndian } from '../../lib/formatters';
import { computeWindfallBuckets, type Bucket, type BucketKey } from '../../lib/windfall-buckets';
import { RitualHeader } from '../ritual/RitualPrimitives';
import { Card } from '../primitives';

type Windfall = {
  id: string;
  amount: number;
  status: string;
};
type Goal = {
  id: string;
  label: string;
  current_amount: number;
  target_amount: number;
  status: string;
};

export function WindfallAllocate() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [windfall, setWindfall] = useState<Windfall | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [allocations, setAllocations] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stream 0.5k — snapshot of the initially-computed allocation so the
  // "Reset to suggested" link can restore it after the user drags sliders.
  // Captured once on first compute; never overwritten by user edits.
  const initialAllocationsRef = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) { setError('Not authenticated'); setLoading(false); return; }
      const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).single();
      if (!profile) { setError('Profile not found'); setLoading(false); return; }

      const [{ data: wf }, { data: gs }] = await Promise.all([
        supabase.from('windfalls').select('id, amount, status').eq('id', eventId).eq('user_id', profile.id).maybeSingle(),
        supabase.from('goals').select('id, label, current_amount, target_amount, status').eq('user_id', profile.id).eq('status', 'active'),
      ]);
      if (cancelled) return;

      if (!wf) { setError('Windfall not found'); setLoading(false); return; }
      if (wf.status !== 'pending_allocation') {
        // Already allocated — bounce back to home
        navigate('/home', { replace: true });
        return;
      }
      setWindfall(wf as Windfall);
      setGoals(gs ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [eventId, navigate]);

  const buckets = useMemo<Bucket[]>(() => {
    if (!windfall || !goals) return [];
    const emergencyGoal = goals.find(g => g.label === 'Emergency fund') ?? null;
    const phoneGoal = goals.find(g => g.label === 'Phone fund') ?? null;
    return computeWindfallBuckets({
      windfallAmount: Number(windfall.amount),
      emergencyGoal,
      phoneGoal,
      loanPrincipal: null,   // PM_DECISIONS.C.3 — no principal data, bucket dropped
    });
  }, [windfall, goals]);

  // Seed allocations once buckets are computed, and capture the initial
  // snapshot for the reset affordance.
  useEffect(() => {
    if (buckets.length > 0 && allocations == null) {
      const initial = Object.fromEntries(buckets.map(b => [b.key, b.amount]));
      initialAllocationsRef.current = initial;
      setAllocations(initial);
    }
  }, [buckets, allocations]);

  if (loading || !windfall || !allocations || buckets.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center p-6 text-center">
        <p className="font-medium text-[#1A1A1A] mb-2">Could not load windfall</p>
        <p className="text-sm text-[#5F5E5A] mb-4">{error}</p>
        <button onClick={() => navigate('/home')} className="px-4 py-2 rounded-full bg-[#1A1A1A] text-white text-sm font-medium">
          Back to home
        </button>
      </div>
    );
  }

  const TOTAL = Number(windfall.amount);
  const sum = Object.values(allocations).reduce((a, b) => a + b, 0);

  // Stream 0.5k — "clamp the dragged value" rebalance.
  //   Invariant: sum(allocations) === TOTAL across every interaction.
  //   - A non-free bucket can grow at most to TOTAL - sum(other non-free); Free
  //     absorbs the rest down to 0. The dragged value itself is clamped (not
  //     just Free), which prevents the prior overshoot bug (₹52,700 on a
  //     ₹50,000 windfall when Free hit 0 but Emergency kept climbing).
  //   - Free is purely a residual indicator. Dragging it is a no-op — the
  //     thumb snaps back to TOTAL - sum(non-free). If users want more in
  //     Free, they drag the other buckets down. This preserves the invariant
  //     in both directions; the alternative (allowing Free to drop arbitrarily)
  //     leaves sum < TOTAL with no bucket absorbing the delta.
  const update = (key: BucketKey, value: number) => {
    if (key === 'free') return;  // Free is derivative; no direct edits.

    setAllocations(a => {
      if (!a) return a;
      const otherNonFreeSum = buckets
        .filter(b => b.key !== key && b.key !== 'free')
        .reduce((s, b) => s + a[b.key], 0);
      const maxValue = TOTAL - otherNonFreeSum;
      const clamped = Math.max(0, Math.min(value, maxValue));
      const newFree = TOTAL - clamped - otherNonFreeSum;
      return { ...a, [key]: clamped, free: Math.max(0, newFree) };
    });
  };

  const handleReset = () => {
    if (initialAllocationsRef.current) {
      setAllocations({ ...initialAllocationsRef.current });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      <RitualHeader sectionLabel="Windfall" stepLabel="Step 1 of 2" onClose={() => navigate('/home')} />

      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ padding: '8px 16px 24px' }}>
        <div style={{ padding: '0 6px 18px' }}>
          <div style={{
            fontSize: 28, fontWeight: 400, color: tokens.p,
            lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 8,
          }}>
            Allocate your {formatRupeesIndian(TOTAL)}
          </div>
          <div style={{ fontSize: 13.5, color: tokens.s, lineHeight: 1.5 }}>
            Here's a suggested split based on your current state. Adjust as needed — the {buckets.length} buckets keep things in your existing structure.
          </div>
        </div>

        <Card variant="hero" style={{ padding: '20px 20px' }}>
          {/* Progress bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: tokens.s }}>Allocated</span>
            <span style={{ fontSize: 13, color: tokens.t }}>{formatRupeesIndian(sum)} / {formatRupeesIndian(TOTAL)}</span>
          </div>
          <div style={{
            height: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.05)',
            overflow: 'hidden', marginBottom: 18,
          }}>
            <div style={{
              width: `${(sum / TOTAL) * 100}%`, height: '100%',
              backgroundColor: tokens.avAccent, borderRadius: 999,
              transition: 'width 120ms ease-out',
            }} />
          </div>

          {buckets.map((b, i) => (
            <div key={b.key} style={{ marginBottom: i < buckets.length - 1 ? 18 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 13.5, color: tokens.p, fontWeight: 500 }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: tokens.t, marginTop: 2 }}>{b.sub}</div>
                </div>
                <span
                  style={{
                    fontSize: 11, fontWeight: 500,
                    padding: '2px 8px', borderRadius: 999,
                    backgroundColor: b.plate, color: b.stop,
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                >
                  {formatRupeesIndian(allocations[b.key])}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={b.max}
                step={100}
                value={allocations[b.key]}
                onChange={(e) => update(b.key, Number(e.target.value))}
                style={{ width: '100%', accentColor: b.stop, cursor: 'pointer' }}
                aria-label={`${b.label} amount`}
              />
            </div>
          ))}
        </Card>

        {/* SEBI disclaimer — exact copy per JSX preview lines 1031-1033 */}
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 14,
          backgroundColor: tokens.yPlate, color: tokens.yStop,
          fontSize: 11.5, lineHeight: 1.5,
        }}>
          Savio only allocates into your own buckets — goals, debt, free spend. No specific instrument recommendations (that's a SEBI-regulated area).
        </div>

        {/* Stream 0.5k — subtle reset to initially-computed split. */}
        <button
          type="button"
          onClick={handleReset}
          style={{
            marginTop: 8, width: '100%', padding: '10px',
            background: 'transparent', border: 'none',
            fontSize: 12.5, color: tokens.t,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            textDecoration: 'underline', textUnderlineOffset: 2,
          }}
        >
          <RotateCcw size={12} strokeWidth={2} /> Reset to suggested
        </button>

        <button
          type="button"
          onClick={() => navigate(`/windfall/${eventId}/review`, { state: { allocations, buckets } })}
          className="hover:opacity-90 transition-opacity"
          style={{
            marginTop: 6, width: '100%', padding: '14px',
            backgroundColor: tokens.p, color: tokens.card, border: 'none',
            borderRadius: 999, fontSize: 15, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          Review allocation <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
