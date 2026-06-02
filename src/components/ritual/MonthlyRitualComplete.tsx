import { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Check, ArrowRight, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMonthName, getNextMonthName, defaultPendingMonth } from '../../lib/dates';

type LocationState = {
  total_amount?: number;
  destination_kind?: 'goal' | 'emergency_fund' | 'carry_forward' | 'split';
  destination_label?: string;
  allocation_count?: number;
} | null;

const formatINRInt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n));

// Phase C1 Screen 3: close-out complete + transition into new-month setup.
// Removed auto-dismiss to home — instead a tactile "Set up <newMonth> →"
// button continues into Screen 4 (Income). "Finish later" exit kept for
// users who want to bail at the close-out boundary; close-out state is
// already committed (per Doc 1.2 RPC), so the new-month setup can be
// resumed any time before month-end.
export function MonthlyRitualComplete() {
  const { month: rawMonth } = useParams();
  const month = rawMonth ?? defaultPendingMonth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;

  // Negative-leftover branch: when user arrives here directly from CloseOut
  // (no rollover), the empty-allocations RPC marks close-out completed.
  useEffect(() => {
    let cancelled = false;
    async function ensureCompleted() {
      if (state?.total_amount != null) return;
      try {
        const { error } = await supabase.rpc('complete_monthly_ritual', {
          p_month_year: month,
          p_allocations: [],
        });
        if (cancelled) return;
        if (error) console.error('[RitualComplete] skip-rollover RPC failed:', error);
      } catch (err) {
        if (!cancelled) console.error('[RitualComplete] error:', err);
      }
    }
    ensureCompleted();
    return () => { cancelled = true; };
  }, [month, state]);

  const monthName = formatMonthName(month);
  const newMonthName = getNextMonthName(month);
  const isRollover = state?.total_amount != null && state.total_amount > 0;

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      {/* Phase C1: step counter header, replaces prior centered-only layout.
          Pattern matches CloseOut / Rollover top strip. */}
      <header
        className="flex-shrink-0 flex items-center justify-between"
        style={{ padding: '14px 22px' }}
      >
        <button
          type="button"
          onClick={() => navigate('/home')}
          aria-label="Exit ritual"
          className="text-[#1A1A1A] hover:opacity-70 transition-opacity"
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
        <div style={{ fontSize: 11, color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Monthly check-in · 3 of 7
        </div>
        <div style={{ width: 20 }} />
      </header>

      <div className="flex-1 flex items-center justify-center px-6">
        <div
          className="w-full"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            border: '1px solid rgba(0,0,0,0.07)',
            padding: '36px 32px',
            maxWidth: 360,
            textAlign: 'center',
          }}
        >
          <div className="w-16 h-16 rounded-full bg-[#DEF2CB] flex items-center justify-center mx-auto mb-6">
            <Check size={28} strokeWidth={2.5} className="text-[#3B6D11]" />
          </div>

          <h1
            className="mb-3"
            style={{ fontSize: 36, fontWeight: 400, color: '#1A1A1A', lineHeight: 1.2, letterSpacing: '-0.8px' }}
          >
            {monthName} closed.
          </h1>

          <p
            className="mx-auto mb-6"
            style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.45, maxWidth: 280 }}
          >
            {isRollover ? (
              (state?.allocation_count ?? 1) > 1 ? (
                <>
                  {formatINRInt(state!.total_amount!)} split across{' '}
                  <span style={{ fontWeight: 500, color: '#1A1A1A' }}>{state!.allocation_count} destinations</span>.
                </>
              ) : (
                <>
                  {formatINRInt(state!.total_amount!)} rolled to{' '}
                  <span style={{ fontWeight: 500, color: '#1A1A1A' }}>{state?.destination_label ?? 'next month'}</span>.
                </>
              )
            ) : (
              <>Closed at a deficit — no rollover.</>
            )}
            {' '}Now let&rsquo;s set up {newMonthName}.
          </p>

          {/* Transition CTA — continues into Screen 4 */}
          <button
            type="button"
            onClick={() => navigate(`/ritual/${month}/income`)}
            className="hover:opacity-90 transition-opacity"
            style={{
              width: '100%',
              padding: '14px 24px',
              backgroundColor: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            Set up {newMonthName} <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={() => navigate('/home')}
            className="hover:text-[#5F5E5A] transition-colors"
            style={{
              marginTop: 12,
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: 'none',
              fontSize: 13,
              color: '#888780',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Finish later
          </button>
        </div>
      </div>
    </div>
  );
}
