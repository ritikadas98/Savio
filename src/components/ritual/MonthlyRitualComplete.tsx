import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMonthName } from '../../lib/dates';

type LocationState = {
  total_amount?: number;
  destination_kind?: 'goal' | 'emergency_fund' | 'carry_forward';
  destination_label?: string;
} | null;

const formatINRInt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n));

export function MonthlyRitualComplete() {
  const { month = '2026-04' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;

  const [autoDismiss, setAutoDismiss] = useState(true);

  // The component supports two entry paths:
  //   1. From rollover screen: location.state has total_amount + destination
  //   2. Direct nav (negative-leftover branch from close-out): no state →
  //      we need to mark the ritual completed with skip_rollover=true. The
  //      close-out screen could have done this before navigating, but doing
  //      it here keeps the "Close out month" button simple (one navigate).
  useEffect(() => {
    let cancelled = false;
    async function ensureCompleted() {
      if (state?.total_amount != null) return; // rollover already wrote the row
      try {
        const { error: rpcErr } = await supabase.rpc('complete_monthly_ritual', {
          p_month_year: month,
          p_skip_rollover: true,
          p_source_breakdown: null,
          p_total_amount: null,
          p_destination_kind: null,
          p_destination_goal_id: null,
          p_close_out_snapshot: null,
        });
        if (cancelled) return;
        if (rpcErr) console.error('[RitualComplete] skip-rollover RPC failed:', rpcErr);
      } catch (err) {
        if (!cancelled) console.error('[RitualComplete] error:', err);
      }
    }
    ensureCompleted();
    return () => { cancelled = true; };
  }, [month, state]);

  // Auto-dismiss to home after 4s unless user navigates manually
  useEffect(() => {
    if (!autoDismiss) return;
    const t = setTimeout(() => navigate('/home'), 4000);
    return () => clearTimeout(t);
  }, [autoDismiss, navigate]);

  const monthName = formatMonthName(month);
  const isRollover = state?.total_amount != null && state.total_amount > 0;

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#DEF2CB] flex items-center justify-center mb-6">
        <Check size={28} strokeWidth={2.5} className="text-[#3B6D11]" />
      </div>

      <h1 className="text-2xl font-semibold text-[#0C447C] mb-3">{monthName} closed.</h1>

      <p className="text-base text-[#1A1A1A] leading-relaxed max-w-[280px] mb-8">
        {isRollover ? (
          <>
            {formatINRInt(state!.total_amount!)} rolled to{' '}
            <span className="font-semibold">{state?.destination_label ?? 'next month'}</span>.
          </>
        ) : (
          <>Closed at a deficit — no rollover. Next month starts fresh.</>
        )}
      </p>

      <button
        type="button"
        onClick={() => { setAutoDismiss(false); navigate('/home'); }}
        className="px-6 py-3 rounded-full bg-[#0C447C] text-white text-base font-medium transition-opacity hover:opacity-90"
      >
        Back to home
      </button>

      <div className="text-xs text-[#8B948E] mt-6">Returning to home in a few seconds…</div>
    </div>
  );
}
