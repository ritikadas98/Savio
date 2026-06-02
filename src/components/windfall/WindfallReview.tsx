import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { tokens } from '../../lib/design-tokens';
import { formatRupeesIndian } from '../../lib/formatters';
import type { Bucket } from '../../lib/windfall-buckets';
import { RitualHeader } from '../ritual/RitualPrimitives';
import { Card } from '../primitives';

type LocationState = {
  allocations: Record<string, number>;
  buckets: Bucket[];
};

export function WindfallReview() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as LocationState | null;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direct navigation without state — bounce back to Step 1
  if (!state || !state.allocations || !state.buckets) {
    navigate(`/windfall/${eventId}/allocate`, { replace: true });
    return null;
  }

  const { allocations, buckets } = state;
  const sum = Object.values(allocations).reduce((a, b) => a + b, 0);

  const handleLockIn = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('record_windfall_allocations', {
        p_event_id: eventId,
        p_allocations: buckets.map(b => ({
          bucket_kind: b.key,
          amount: allocations[b.key],
        })),
      });
      if (rpcErr) throw rpcErr;
      // Hybrid persistence (PM_DECISIONS.C.1): goal current_amounts and
      // monthly_rituals.safe_to_spend_locked are intentionally NOT mutated.
      navigate('/home', { replace: true });
    } catch (e: any) {
      setError(e?.message ?? 'Allocation failed. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      {/* D.56 (Stream 0.5u piece #2) — Allocate flow section label across
          both steps. Page identity is the action; windfall identity lives
          in the C.28 labeled header. */}
      <RitualHeader sectionLabel="Allocate" stepLabel="Step 2 of 2" onClose={() => navigate('/home')} />

      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ padding: '8px 16px 24px' }}>
        <div style={{ padding: '0 6px 18px' }}>
          <div style={{
            fontSize: 28, fontWeight: 400, color: tokens.p,
            lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 8,
          }}>
            Lock it in?
          </div>
          <div style={{ fontSize: 13.5, color: tokens.s, lineHeight: 1.5 }}>
            Here's what you decided. You can adjust this within 24 hours from your transactions view.
          </div>
        </div>

        <Card variant="hero">
          {buckets.map((b, i) => (
            <div
              key={b.key}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < buckets.length - 1 ? `0.5px solid ${tokens.border}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 999,
                    backgroundColor: b.plate, color: b.stop,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={14} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: 14, color: tokens.p }}>{b.label}</span>
              </div>
              <span style={{ fontSize: 15, color: tokens.p, fontWeight: 500 }}>
                {formatRupeesIndian(allocations[b.key])}
              </span>
            </div>
          ))}
          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${tokens.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span style={{ fontSize: 13, color: tokens.s }}>Total</span>
            <span style={{ fontSize: 22, color: tokens.p, fontWeight: 500 }}>{formatRupeesIndian(sum)}</span>
          </div>
        </Card>

        {error && (
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 14,
            backgroundColor: tokens.rPlate, color: tokens.rStop,
            fontSize: 12, lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={submitting}
            style={{
              flex: 1, padding: '13px', borderRadius: 999,
              backgroundColor: 'transparent', color: tokens.p,
              border: `0.5px solid ${tokens.borderHover}`,
              fontSize: 14, fontWeight: 500,
              cursor: submitting ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleLockIn}
            disabled={submitting}
            className="hover:opacity-90 transition-opacity"
            style={{
              flex: 2, padding: '13px', borderRadius: 999,
              backgroundColor: tokens.p, color: tokens.card, border: 'none',
              fontSize: 14, fontWeight: 500,
              cursor: submitting ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Locking in…' : 'Lock it in'}
          </button>
        </div>
      </div>
    </div>
  );
}
